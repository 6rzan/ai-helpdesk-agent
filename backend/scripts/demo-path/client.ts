/**
 * Demo-path HTTP/SSE client (T007, split out by T082).
 *
 * Everything the seven legs need to talk to the running stack: account
 * provisioning, session and message calls, ticket polling, and a minimal SSE
 * listener. The legs themselves live in `demo-path.ts`; this module holds no
 * leg logic, only the transport it runs over.
 */

// R10: no HTTP surface may grant the staff role, so provisioning the staff
// account this script needs has to reach the model directly -- the same
// technique `src/scripts/seed-staff.ts` itself uses -- rather than opening a
// new grant path (FR-016).
import { connectDb, disconnectDb } from "../../src/lib/db.js";
import { UserAccount } from "../../src/models/user-account.js";
import { hashPassword } from "../../src/services/auth/password-service.js";

export const BASE_URL = process.env.DEMO_PATH_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const EMPLOYEE_EMAIL = process.env.DEMO_PATH_EMPLOYEE_EMAIL ?? "demo-path-employee@local.test";
const EMPLOYEE_PASSWORD = process.env.DEMO_PATH_EMPLOYEE_PASSWORD ?? "demo-path-employee-local";
const STAFF_EMAIL = process.env.DEMO_PATH_STAFF_EMAIL ?? "demo-path-staff@local.test";
const STAFF_PASSWORD = process.env.DEMO_PATH_STAFF_PASSWORD ?? "demo-path-staff-local";

export interface TicketSummary {
  reference: string;
  category: string | null;
  status: string;
  escalated: boolean;
  escalationReason: string | null;
  handlingMode: string;
  guidance?: { state: string; stepAttempts: Array<{ stepIndex: number; outcome: string }> };
}

export function readSessionCookie(res: Response): string | null {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const pairs = setCookies.map((entry) => entry.split(";")[0]?.trim()).filter((p): p is string => Boolean(p));
  return pairs.length > 0 ? pairs.join("; ") : null;
}

/** Signs an employee account in, registering it the first time the script runs. */
export async function authenticateEmployee(): Promise<string> {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMPLOYEE_EMAIL, password: EMPLOYEE_PASSWORD }),
  });
  if (loginRes.status === 200) {
    const cookie = readSessionCookie(loginRes);
    if (!cookie) throw new Error("employee login succeeded but returned no session cookie");
    return cookie;
  }
  if (loginRes.status !== 401) throw new Error(`employee login returned ${loginRes.status}`);

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMPLOYEE_EMAIL, displayName: "Demo Path Employee", password: EMPLOYEE_PASSWORD }),
  });
  if (registerRes.status !== 201) throw new Error(`employee registration returned ${registerRes.status}`);
  const cookie = readSessionCookie(registerRes);
  if (!cookie) throw new Error("employee registration succeeded but returned no session cookie");
  return cookie;
}

/** Upserts a known staff account with a known password, directly via the
 * model -- see the R10 note at the top of the file. Idempotent so re-runs
 * don't accumulate accounts or drift the password. */
export async function ensureStaffAccount(): Promise<void> {
  await connectDb();
  const { passwordHash, passwordSalt } = await hashPassword(STAFF_PASSWORD);
  await UserAccount.findOneAndUpdate(
    { email: STAFF_EMAIL.toLowerCase() },
    {
      email: STAFF_EMAIL,
      displayName: "Demo Path Staff",
      role: "staff",
      passwordHash,
      passwordSalt,
      usingInitialPassword: false,
      availability: "available",
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  await disconnectDb();
}

export async function authenticateStaff(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`staff login returned ${res.status}`);
  const cookie = readSessionCookie(res);
  if (!cookie) throw new Error("staff login succeeded but returned no session cookie");
  return cookie;
}

export async function createSession(cookie: string): Promise<{ sessionId: string; conversationId: string }> {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  if (res.status !== 201) throw new Error(`session creation returned ${res.status}`);
  return (await res.json()) as { sessionId: string; conversationId: string };
}

export async function postMessage(conversationId: string, sessionId: string, text: string, inputOrigin: "typed" | "voice" = "typed"): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, text, inputOrigin }),
  });
  if (res.status !== 202) throw new Error(`message submission returned ${res.status} for "${text}"`);
}

export async function listTickets(sessionId: string): Promise<TicketSummary[]> {
  const res = await fetch(`${BASE_URL}/api/tickets?sessionId=${encodeURIComponent(sessionId)}`);
  if (res.status !== 200) throw new Error(`ticket list returned ${res.status}`);
  const body = (await res.json()) as { tickets: TicketSummary[] };
  return body.tickets;
}

// GET /api/tickets is scoped by reporterId (ticket-service.ts), not by this one
// session -- and this script's employee/staff accounts are the same across
// re-runs (they sign back in rather than re-registering). Across a second or
// later run that reporter already has tickets, so a bare `listTickets(...)[0]`
// resolves to a pre-existing ticket on its very first poll, before the new
// report has even been classified -- a race, not a wait. Snapshot references
// before filing the report, then wait for one that is genuinely new.
export async function snapshotTicketReferences(sessionId: string): Promise<Set<string>> {
  return new Set((await listTickets(sessionId)).map((t) => t.reference));
}

export async function waitForNewTicket(sessionId: string, priorReferences: Set<string>, timeoutMs: number): Promise<TicketSummary> {
  return waitFor(async () => {
    const tickets = await listTickets(sessionId);
    return tickets.find((t) => !priorReferences.has(t.reference)) ?? null;
  }, timeoutMs);
}

export async function getTicketDetail(reference: string, sessionId: string): Promise<TicketSummary> {
  const res = await fetch(`${BASE_URL}/api/tickets/${encodeURIComponent(reference)}?sessionId=${encodeURIComponent(sessionId)}`);
  if (res.status !== 200) throw new Error(`ticket detail returned ${res.status}`);
  const body = (await res.json()) as { ticket: TicketSummary };
  return body.ticket;
}

export async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs: number, intervalMs = 300): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError instanceof Error ? lastError : new Error("Timed out waiting for condition");
}

// --- minimal SSE client, just enough to catch one `action_proposed` event ---

export interface SseFrame {
  event: string;
  data: unknown;
}

export class SseListener {
  private constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly controller: AbortController,
  ) {}

  static async open(sessionId: string): Promise<SseListener> {
    const controller = new AbortController();
    const res = await fetch(`${BASE_URL}/api/events?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE connect returned ${res.status}`);
    // By the time fetch() resolves with headers, the server has already run
    // its synchronous subscribe() call (events-route.ts) — safe to trigger
    // the event immediately after this returns.
    return new SseListener(res.body.getReader(), controller);
  }

  /** Waits for the next frame matching `eventName`, within `timeoutMs`. */
  async waitFor(eventName: string, timeoutMs: number): Promise<unknown> {
    const decoder = new TextDecoder();
    let buffer = "";
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const timeout = new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      );
      const { done, value } = await Promise.race([this.reader.read(), timeout]);
      if (done || !value) break;

      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const frame = parseSseFrame(raw);
        if (frame && frame.event === eventName) return frame.data;
      }
    }
    throw new Error(`Timed out waiting for SSE event "${eventName}"`);
  }

  close(): void {
    this.controller.abort();
  }
}

export function parseSseFrame(raw: string): SseFrame | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event: eventName, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
