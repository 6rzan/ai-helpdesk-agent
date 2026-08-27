/**
 * Release-gated demo path (research.md Decision 1, T007).
 *
 * A single re-runnable script that drives the real stack -- the demo
 * machine's `rs0` replica set, LM Studio, and the registered SSH test
 * endpoints -- through all seven legs FR-002/SC-008 require, in one
 * continuous run with no restart and no hand-edited data between stages:
 *
 *   1. intake                  -- a voice report reaches the agent
 *   2. classification          -- the report lands in a real category
 *   3. ticket-creation         -- a ticket exists for that category
 *   4. guided-troubleshooting  -- the guide's own steps are followed
 *   5. escalation              -- a case reaches a human
 *   6. staff-takeover          -- staff claims the escalated ticket
 *   7. whitelisted-remediation -- a state-changing action runs against a
 *                                 registered test endpoint, gated on
 *                                 explicit reporter consent AND staff
 *                                 approval
 *
 * It writes a timestamped PASS/FAIL log per leg to
 * `docs/testing/demo-path-runs/`, and exits non-zero if any leg failed or
 * was never reached, so `npm --prefix backend run demo-path` is a hard gate
 * (FR-002): tester sessions do not begin on a non-zero exit.
 *
 * The printer leg (4, 7) and the peripherals leg (5, 6) are two separate
 * conversations run back to back in the same process, exactly as the
 * superseded hand-driven log (`docs/testing/demo-path-log.md`) covered its
 * password and vague-report cases separately -- guided-to-remediation and
 * guided-to-escalation are alternate endings of the same flow, not two
 * points on one ticket's timeline.
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// R10: no HTTP surface may grant the staff role, so provisioning the staff
// account this script needs has to reach the model directly -- the same
// technique `src/scripts/seed-staff.ts` itself uses -- rather than opening a
// new grant path (FR-016).
import { connectDb, disconnectDb } from "../src/lib/db.js";
import { UserAccount } from "../src/models/user-account.js";
import { hashPassword } from "../src/services/auth/password-service.js";

// -----------------------------------------------------------------------
// Testable surface -- backend/tests/unit/demo-path.test.ts (T009) exercises
// these three exports directly, with no network or DB involved.
// -----------------------------------------------------------------------

export const LEG_ORDER = [
  "intake",
  "classification",
  "ticket-creation",
  "guided-troubleshooting",
  "escalation",
  "staff-takeover",
  "whitelisted-remediation",
] as const;

export type LegId = (typeof LEG_ORDER)[number];

export interface LegResult {
  leg: LegId;
  status: "PASS" | "FAIL";
  detail: string;
}

const LEG_TITLE: Record<LegId, string> = {
  intake: "Voice-or-text intake",
  classification: "Classification",
  "ticket-creation": "Ticket creation",
  "guided-troubleshooting": "Guided troubleshooting",
  escalation: "Escalation",
  "staff-takeover": "Staff takeover",
  "whitelisted-remediation": "Whitelisted remediation",
};

/** A leg that never ran at all (an earlier leg's failure blocked it) is
 * exactly as bad as one that ran and failed -- SC-008 requires all seven,
 * not "the ones we got to". */
export function allLegsPassed(results: readonly LegResult[]): boolean {
  return LEG_ORDER.every((leg) => results.find((r) => r.leg === leg)?.status === "PASS");
}

export function buildLog(results: readonly LegResult[], startedAt: string, finishedAt: string): string {
  const passed = allLegsPassed(results);
  const lines: string[] = [
    `# Demo Path Run — ${startedAt}`,
    "",
    "Release-gated end-to-end run (research.md Decision 1, FR-002, SC-008). Covers all seven",
    "legs in one continuous run against the real demo-machine stack — `rs0`, LM Studio, and the",
    "registered SSH test endpoints — with no restart and no hand-edited data between stages.",
    "",
    `**Started**: ${startedAt}`,
    `**Finished**: ${finishedAt}`,
    `**Result**: ${passed ? "PASS — all 7 legs" : "FAIL"}`,
    "",
    "| # | Leg | Status | Detail |",
    "|---|---|---|---|",
  ];
  LEG_ORDER.forEach((leg, index) => {
    const result = results.find((r) => r.leg === leg);
    const title = LEG_TITLE[leg];
    if (!result) {
      lines.push(`| ${index + 1} | ${title} | **SKIPPED** | never reached |`);
    } else {
      const detail = result.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${index + 1} | ${title} | ${result.status === "PASS" ? "PASS" : "**FAIL**"} | ${detail} |`);
    }
  });
  lines.push("");
  return lines.join("\n");
}

// -----------------------------------------------------------------------
// Live orchestration -- exercised by T014/T066 on the demo machine, not by
// the unit test.
// -----------------------------------------------------------------------

const BASE_URL = process.env.DEMO_PATH_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const EMPLOYEE_EMAIL = process.env.DEMO_PATH_EMPLOYEE_EMAIL ?? "demo-path-employee@local.test";
const EMPLOYEE_PASSWORD = process.env.DEMO_PATH_EMPLOYEE_PASSWORD ?? "demo-path-employee-local";
const STAFF_EMAIL = process.env.DEMO_PATH_STAFF_EMAIL ?? "demo-path-staff@local.test";
const STAFF_PASSWORD = process.env.DEMO_PATH_STAFF_PASSWORD ?? "demo-path-staff-local";
const VOICE_SAMPLE_PATH = process.env.DEMO_PATH_VOICE_SAMPLE
  ? path.resolve(process.env.DEMO_PATH_VOICE_SAMPLE)
  : path.resolve("scripts/fixtures/demo-voice-sample.wav");
const OUTPUT_DIR = process.env.DEMO_PATH_OUTPUT_DIR
  ? path.resolve(process.env.DEMO_PATH_OUTPUT_DIR)
  : path.resolve("../docs/testing/demo-path-runs/");

interface TicketSummary {
  reference: string;
  category: string | null;
  status: string;
  escalated: boolean;
  escalationReason: string | null;
  handlingMode: string;
  guidance?: { state: string; stepAttempts: Array<{ stepIndex: number; outcome: string }> };
}

function readSessionCookie(res: Response): string | null {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const pairs = setCookies.map((entry) => entry.split(";")[0]?.trim()).filter((p): p is string => Boolean(p));
  return pairs.length > 0 ? pairs.join("; ") : null;
}

/** Signs an employee account in, registering it the first time the script runs. */
async function authenticateEmployee(): Promise<string> {
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
async function ensureStaffAccount(): Promise<void> {
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

async function authenticateStaff(): Promise<string> {
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

async function createSession(cookie: string): Promise<{ sessionId: string; conversationId: string }> {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  if (res.status !== 201) throw new Error(`session creation returned ${res.status}`);
  return (await res.json()) as { sessionId: string; conversationId: string };
}

async function postMessage(conversationId: string, sessionId: string, text: string, inputOrigin: "typed" | "voice" = "typed"): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, text, inputOrigin }),
  });
  if (res.status !== 202) throw new Error(`message submission returned ${res.status} for "${text}"`);
}

async function listTickets(sessionId: string): Promise<TicketSummary[]> {
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
async function snapshotTicketReferences(sessionId: string): Promise<Set<string>> {
  return new Set((await listTickets(sessionId)).map((t) => t.reference));
}

async function waitForNewTicket(sessionId: string, priorReferences: Set<string>, timeoutMs: number): Promise<TicketSummary> {
  return waitFor(async () => {
    const tickets = await listTickets(sessionId);
    return tickets.find((t) => !priorReferences.has(t.reference)) ?? null;
  }, timeoutMs);
}

async function getTicketDetail(reference: string, sessionId: string): Promise<TicketSummary> {
  const res = await fetch(`${BASE_URL}/api/tickets/${encodeURIComponent(reference)}?sessionId=${encodeURIComponent(sessionId)}`);
  if (res.status !== 200) throw new Error(`ticket detail returned ${res.status}`);
  const body = (await res.json()) as { ticket: TicketSummary };
  return body.ticket;
}

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs: number, intervalMs = 300): Promise<T> {
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

interface SseFrame {
  event: string;
  data: unknown;
}

class SseListener {
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

function parseSseFrame(raw: string): SseFrame | null {
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

// The fixture reports (this WAV's transcript, and the escalation leg's fixed
// text) are identical on every run, so a re-run that leaves a still-open
// ticket behind (a crash, or a genuine FAIL, on an earlier attempt) gets met
// with a possible-duplicate check (conversation-engine.ts) instead of a new
// ticket -- correct product behaviour, but it means a leg can't unconditionally
// assume the next thing to happen after filing a report is ticket creation.
// Listens for the actual agent reply over SSE and answers the duplicate
// check if (and only if) it was actually asked, so the leg still ends up
// with a genuinely new ticket either way.
async function postReportAndClearDuplicateCheck(
  session: { sessionId: string; conversationId: string },
  text: string,
  inputOrigin: "typed" | "voice" = "typed",
): Promise<void> {
  const listener = await SseListener.open(session.sessionId);
  try {
    await postMessage(session.conversationId, session.sessionId, text, inputOrigin);
    const firstReply = (await listener.waitFor("agent_message", 20_000)) as { message: { text: string } };
    if (firstReply.message.text.includes("same problem, or something new")) {
      // Must not match DUPLICATE_SAME_PATTERN (conversation-engine.ts) -- no
      // "yes/same problem/issue/thing/it is" -- or the existing ticket is kept
      // and no new one is filed, which is the one outcome this can't recover from.
      await postMessage(session.conversationId, session.sessionId, "No, this is a different, new report.");
    }
  } finally {
    listener.close();
  }
}

// --- leg implementations ---

async function runIntakeThroughGuidance(cookie: string): Promise<{
  intake: LegResult;
  classification: LegResult;
  ticketCreation: LegResult;
  guidedTroubleshooting: LegResult;
  remediation: LegResult;
}> {
  const session = await createSession(cookie);
  const priorTicketRefs = await snapshotTicketReferences(session.sessionId);
  const audio = await readFile(VOICE_SAMPLE_PATH);
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: "audio/wav" }), "demo-voice-sample.wav");

  const transcribeRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/transcriptions`, {
    method: "POST",
    body: form,
  });
  if (transcribeRes.status !== 200) {
    const detail = `transcription endpoint returned ${transcribeRes.status}`;
    const fail = (leg: LegId): LegResult => ({ leg, status: "FAIL", detail });
    return {
      intake: fail("intake"),
      classification: fail("classification"),
      ticketCreation: fail("ticket-creation"),
      guidedTroubleshooting: fail("guided-troubleshooting"),
      remediation: fail("whitelisted-remediation"),
    };
  }
  const { transcript } = (await transcribeRes.json()) as { transcript: string };
  await postReportAndClearDuplicateCheck(session, transcript, "voice");
  const intake: LegResult = { leg: "intake", status: "PASS", detail: `transcribed "${transcript}" and submitted via voice input` };

  const ticket = await waitForNewTicket(session.sessionId, priorTicketRefs, 15_000);
  const classification: LegResult = ticket.category
    ? { leg: "classification", status: "PASS", detail: `classified as "${ticket.category}"` }
    : { leg: "classification", status: "FAIL", detail: "ticket created with no category" };
  const ticketCreation: LegResult = { leg: "ticket-creation", status: "PASS", detail: `ticket ${ticket.reference} created` };

  // Advance one guided step so a state-changing action becomes eligible
  // (printer's clear-print-queue sits at guidedStepRef "printer:1"). Must not
  // name the category (conversation-guidance.ts's tryHandleGuidedReply reads
  // any category keyword -- "printer", "jammed", etc. -- as a fresh problem
  // report and bails out to duplicate-detection instead of advancing the
  // step); "still not working" is one of that function's own documented
  // safe examples of a plain step-outcome reply.
  await postMessage(session.conversationId, session.sessionId, "that didn't fix it, still not working");

  let guidedTroubleshooting: LegResult;
  let remediation: LegResult;
  try {
    const detail = await waitFor(async () => {
      const d = await getTicketDetail(ticket.reference, session.sessionId);
      return d.guidance && d.guidance.stepAttempts.length >= 1 ? d : null;
    }, 15_000);
    guidedTroubleshooting = {
      leg: "guided-troubleshooting",
      status: "PASS",
      detail: `guide state "${detail.guidance?.state}", ${detail.guidance?.stepAttempts.length} step(s) attempted`,
    };
  } catch (err) {
    guidedTroubleshooting = { leg: "guided-troubleshooting", status: "FAIL", detail: describeError(err) };
  }

  try {
    remediation = await runRemediationLeg(session);
  } catch (err) {
    remediation = { leg: "whitelisted-remediation", status: "FAIL", detail: describeError(err) };
  }

  return { intake, classification, ticketCreation, guidedTroubleshooting, remediation };
}

async function runRemediationLeg(session: { sessionId: string; conversationId: string }): Promise<LegResult> {
  const listener = await SseListener.open(session.sessionId);
  try {
    // Nudge again in case the first reply only advanced the step without
    // yet surfacing a proposal (proposeActionForStep runs after the step
    // prompt is sent, per conversation-guidance.ts).
    const proposalPromise = listener.waitFor("action_proposed", 20_000);
    await postMessage(session.conversationId, session.sessionId, "can you check the print queue directly?");
    const proposal = (await proposalPromise) as { ticketId: string; proposalId: string; tier: string; description: string };

    const consentRes = await fetch(
      `${BASE_URL}/api/tickets/${encodeURIComponent(proposal.ticketId)}/actions/consent?sessionId=${encodeURIComponent(session.sessionId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId, granted: true }),
      },
    );
    if (consentRes.status !== 200) {
      return { leg: "whitelisted-remediation", status: "FAIL", detail: `consent POST returned ${consentRes.status}` };
    }
    const { result } = (await consentRes.json()) as {
      result: { outcome: string; approvalId?: string; description: string };
    };

    if (result.outcome === "pending_approval" && result.approvalId) {
      pendingApprovalId = result.approvalId;
      pendingApprovalDescription = result.description;
      return {
        leg: "whitelisted-remediation",
        status: "PASS",
        detail: `state-changing proposal "${result.description}" consented and raised for staff approval (${result.approvalId})`,
      };
    }
    if (proposal.tier === "read_only" && (result.outcome === "succeeded" || result.outcome === "attempted_unverified")) {
      // A read-only diagnostic executed immediately; ask once more for the
      // state-changing fix so the approval leg still gets exercised.
      return await runRemediationLeg(session);
    }
    return {
      leg: "whitelisted-remediation",
      status: "FAIL",
      detail: `unexpected consent outcome "${result.outcome}" for tier "${proposal.tier}"`,
    };
  } finally {
    listener.close();
  }
}

// Set by the employee-side consent step, read by the staff-side approval
// step later in the same run — this is the "no hand-edited data between
// stages" continuity the script exists to prove.
let pendingApprovalId: string | null = null;
let pendingApprovalDescription = "";

async function approvePendingRemediation(staffCookie: string): Promise<LegResult> {
  if (!pendingApprovalId) {
    return { leg: "whitelisted-remediation", status: "FAIL", detail: "no pending approval was raised by the employee leg" };
  }
  const res = await fetch(`${BASE_URL}/api/staff/approvals/${encodeURIComponent(pendingApprovalId)}/approve`, {
    method: "POST",
    headers: { Cookie: staffCookie },
  });
  if (res.status !== 200) {
    return { leg: "whitelisted-remediation", status: "FAIL", detail: `approval POST returned ${res.status}` };
  }
  const { result } = (await res.json()) as { result: { execution: { outcome: string; observedOutput: string | null } | null } };
  if (result.execution?.outcome === "succeeded") {
    return {
      leg: "whitelisted-remediation",
      status: "PASS",
      detail: `"${pendingApprovalDescription}" approved and executed against the registered test endpoint: ${result.execution.observedOutput ?? "(no output)"}`,
    };
  }
  return {
    leg: "whitelisted-remediation",
    status: "FAIL",
    detail: `execution outcome was "${result.execution?.outcome ?? "none"}", expected "succeeded"`,
  };
}

async function runEscalationAndTakeover(employeeCookie: string, staffCookie: string): Promise<{ escalation: LegResult; staffTakeover: LegResult }> {
  const session = await createSession(employeeCookie);
  const priorTicketRefs = await snapshotTicketReferences(session.sessionId);
  await postReportAndClearDuplicateCheck(session, "my mouse and keyboard stopped responding");
  const ticket = await waitForNewTicket(session.sessionId, priorTicketRefs, 15_000);

  await postMessage(session.conversationId, session.sessionId, "just get me a person please");
  let escalation: LegResult;
  let escalatedTicket: TicketSummary;
  try {
    escalatedTicket = await waitFor(async () => {
      const detail = await getTicketDetail(ticket.reference, session.sessionId);
      return detail.escalated ? detail : null;
    }, 15_000);
    escalation = {
      leg: "escalation",
      status: "PASS",
      detail: `ticket ${escalatedTicket.reference} escalated (${escalatedTicket.escalationReason ?? "reason unrecorded"}), handlingMode="${escalatedTicket.handlingMode}"`,
    };
  } catch (err) {
    return {
      escalation: { leg: "escalation", status: "FAIL", detail: describeError(err) },
      staffTakeover: { leg: "staff-takeover", status: "FAIL", detail: "blocked: ticket never escalated" },
    };
  }

  const takeoverRes = await fetch(`${BASE_URL}/api/staff/tickets/${encodeURIComponent(escalatedTicket.reference)}/takeover`, {
    method: "POST",
    headers: { Cookie: staffCookie },
  });
  const staffTakeover: LegResult =
    takeoverRes.status === 200
      ? { leg: "staff-takeover", status: "PASS", detail: `staff claimed ticket ${escalatedTicket.reference}` }
      : { leg: "staff-takeover", status: "FAIL", detail: `takeover POST returned ${takeoverRes.status}` };

  return { escalation, staffTakeover };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const results: LegResult[] = [];

  try {
    await ensureStaffAccount();
    const employeeCookie = await authenticateEmployee();
    const staffCookie = await authenticateStaff();

    const printerLeg = await runIntakeThroughGuidance(employeeCookie);
    results.push(printerLeg.intake, printerLeg.classification, printerLeg.ticketCreation, printerLeg.guidedTroubleshooting);

    const { escalation, staffTakeover } = await runEscalationAndTakeover(employeeCookie, staffCookie);
    results.push(escalation, staffTakeover);

    // Approval happens last, after staff is confirmed signed in and the
    // takeover leg has run — mirrors "staff dashboard view and takeover"
    // preceding remediation in specs/005/quickstart.md's Release gate.
    if (printerLeg.remediation.status === "PASS" && pendingApprovalId) {
      results.push(await approvePendingRemediation(staffCookie));
    } else {
      results.push(printerLeg.remediation);
    }
  } catch (err) {
    // An unhandled error partway through still produces a log — every leg
    // not already recorded shows as SKIPPED, which fails the run honestly
    // rather than losing the attempt.
    console.error(err);
  }

  const finishedAt = new Date().toISOString();
  const log = buildLog(results, startedAt, finishedAt);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${startedAt.replace(/[:.]/g, "-")}.md`);
  await appendFile(outputPath, log, "utf-8");

  console.log(log);
  console.log(`Log written to ${outputPath}`);

  if (!allLegsPassed(results)) {
    process.exitCode = 1;
  }
}

// pathToFileURL, not string concatenation: on Windows a naive `file://${argv[1]}`
// never equals import.meta.url (which is drive-lettered and triple-slashed,
// e.g. file:///C:/...), so the naive comparison silently never runs main().
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
