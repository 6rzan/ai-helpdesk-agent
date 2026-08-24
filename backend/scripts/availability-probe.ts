import { appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

interface ProbeAttempt {
  timestamp: string;
  healthStatus: string;
  sessionCreated: boolean;
  messageAccepted: boolean;
  error: string | null;
}

const BASE_URL = process.env.PROBE_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const INTERVAL_MINUTES = Number(process.env.PROBE_INTERVAL_MINUTES ?? 60);
const DURATION_HOURS = Number(process.env.PROBE_DURATION_HOURS ?? 24);
// Since feature 005, POST /api/sessions requires an authenticated account: the legacy
// { orgId, displayName } body is only honoured by the test harness. The probe therefore signs
// in as its own throwaway account, registering it on first run.
const PROBE_EMAIL = process.env.PROBE_EMAIL ?? "availability-probe@local.test";
const PROBE_PASSWORD = process.env.PROBE_PASSWORD ?? "availability-probe-local";
const PROBE_DISPLAY_NAME = process.env.PROBE_DISPLAY_NAME ?? "Availability Probe";
// Overrides the duration/interval-derived attempt count — for smoke-testing the script itself.
const MAX_ATTEMPTS_OVERRIDE = process.env.PROBE_MAX_ATTEMPTS ? Number(process.env.PROBE_MAX_ATTEMPTS) : undefined;

const OUTPUT_PATH = process.env.PROBE_OUTPUT_PATH
  ? path.resolve(process.env.PROBE_OUTPUT_PATH)
  : path.resolve("../docs/testing/availability-probe-log.md");
const TABLE_HEADER = "| # | Timestamp (UTC) | Health | Session Created | Report Accepted | Result | Error |\n|---|---|---|---|---|---|---|";

let authCookie: string | null = null;

function readSessionCookie(res: Response): string | null {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const pairs = setCookies
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair));
  return pairs.length > 0 ? pairs.join("; ") : null;
}

/** Signs the probe account in, registering it the first time the probe runs against a fresh DB. */
async function authenticate(): Promise<string> {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: PROBE_EMAIL, password: PROBE_PASSWORD }),
  });

  if (loginRes.status === 200) {
    const cookie = readSessionCookie(loginRes);
    if (!cookie) {
      throw new Error("login succeeded but returned no session cookie");
    }
    return cookie;
  }
  if (loginRes.status !== 401) {
    throw new Error(`probe login returned ${loginRes.status}`);
  }

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: PROBE_EMAIL,
      displayName: PROBE_DISPLAY_NAME,
      password: PROBE_PASSWORD,
    }),
  });
  if (registerRes.status !== 201) {
    throw new Error(`probe account registration returned ${registerRes.status}`);
  }
  const cookie = readSessionCookie(registerRes);
  if (!cookie) {
    throw new Error("registration succeeded but returned no session cookie");
  }
  return cookie;
}

function createSessionRequest(): Promise<Response> {
  return fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie ?? "" },
    body: JSON.stringify({}),
  });
}

async function probeOnce(): Promise<ProbeAttempt> {
  const timestamp = new Date().toISOString();

  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = (await healthRes.json()) as { status: string };

    let sessionRes = await createSessionRequest();
    if (sessionRes.status === 401) {
      // First attempt of the run, or the auth session lapsed mid-window — sign in and retry once.
      authCookie = await authenticate();
      sessionRes = await createSessionRequest();
    }
    if (sessionRes.status !== 201) {
      throw new Error(`session creation returned ${sessionRes.status}`);
    }
    const session = (await sessionRes.json()) as { sessionId: string; conversationId: string };

    const messageRes = await fetch(`${BASE_URL}/api/conversations/${session.conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        text: "Automated availability probe: printer on the 3rd floor is jammed",
      }),
    });
    if (messageRes.status !== 202) {
      throw new Error(`report submission returned ${messageRes.status}`);
    }

    return {
      timestamp,
      healthStatus: health.status,
      sessionCreated: true,
      messageAccepted: true,
      error: null,
    };
  } catch (error) {
    return {
      timestamp,
      healthStatus: "unreachable",
      sessionCreated: false,
      messageAccepted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toRow(attempt: ProbeAttempt, index: number): string {
  const result = attempt.sessionCreated && attempt.messageAccepted ? "Passed" : "Failed";
  return `| ${index} | ${attempt.timestamp} | ${attempt.healthStatus} | ${attempt.sessionCreated} | ${attempt.messageAccepted} | ${result} | ${attempt.error ?? "-"} |`;
}

async function ensureLogFile(): Promise<void> {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const exists = await stat(OUTPUT_PATH).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await appendFile(
      OUTPUT_PATH,
      `# SC-006 Availability Probe Log\n\nUnattended session+report attempts spread across a ${DURATION_HOURS}-hour window, one every ${INTERVAL_MINUTES} minutes.\n\n${TABLE_HEADER}\n`,
      "utf-8",
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const totalAttempts = MAX_ATTEMPTS_OVERRIDE ?? Math.floor((DURATION_HOURS * 60) / INTERVAL_MINUTES) + 1;
  await ensureLogFile();

  let passed = 0;
  for (let i = 1; i <= totalAttempts; i += 1) {
    const attempt = await probeOnce();
    if (attempt.sessionCreated && attempt.messageAccepted) {
      passed += 1;
    }
    await appendFile(OUTPUT_PATH, `${toRow(attempt, i)}\n`, "utf-8");
    console.log(`[${i}/${totalAttempts}] ${attempt.timestamp} -> ${attempt.error ?? "ok"}`);

    if (i < totalAttempts) {
      await sleep(INTERVAL_MINUTES * 60_000);
    }
  }

  await appendFile(OUTPUT_PATH, `\n**Summary**: ${passed}/${totalAttempts} attempts succeeded.\n`, "utf-8");
  console.log(`Done. ${passed}/${totalAttempts} attempts succeeded. Log: ${OUTPUT_PATH}`);
  if (passed !== totalAttempts) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
