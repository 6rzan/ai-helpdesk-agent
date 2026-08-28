import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

// T086: three separate 24-hour windows were destroyed by demo-machine reboots
// and sleep, because the attempt counter lived only in memory -- a restart
// began again at attempt 1 and the partial log had to be thrown away. The
// counter now lives in the log itself, so a restart picks the window back up
// where it stopped instead of discarding it.

export interface ResumeState {
  /** Attempts already recorded in the log. */
  completed: number;
  /** How many of those passed. */
  passed: number;
  /** Timestamp of the first recorded attempt (the window's real start). */
  firstTimestamp: string | null;
  /** Timestamp of the last recorded attempt (what the next one is spaced from). */
  lastTimestamp: string | null;
  /** True once a run has written its closing summary — nothing left to resume. */
  finished: boolean;
}

const ROW_PATTERN = /^\|\s*(\d+)\s*\|\s*(\S+)\s*\|[^|]*\|[^|]*\|[^|]*\|\s*(Passed|Failed)\s*\|/;

/** Recovers the window's progress from a log written by an earlier process. */
export function parseResumeState(log: string): ResumeState {
  const state: ResumeState = {
    completed: 0,
    passed: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    finished: /^\*\*Summary\*\*:/m.test(log),
  };

  for (const line of log.split("\n")) {
    const match = ROW_PATTERN.exec(line.trim());
    if (!match) {
      continue;
    }
    state.completed += 1;
    if (match[3] === "Passed") {
      state.passed += 1;
    }
    state.firstTimestamp ??= match[2] ?? null;
    state.lastTimestamp = match[2] ?? null;
  }

  return state;
}

/**
 * Milliseconds to wait before the next attempt. Spacing is measured from the
 * *last recorded* attempt, not from process start, so a machine that was off
 * for hours resumes on the next interval rather than firing every missed slot
 * back to back — which would compress the window and misrepresent the spread
 * the evidence claims.
 */
export function delayUntilNextAttempt(lastTimestamp: string | null, intervalMs: number, now: number): number {
  if (!lastTimestamp) {
    return 0;
  }
  const last = Date.parse(lastTimestamp);
  if (Number.isNaN(last)) {
    return 0;
  }
  return Math.max(0, last + intervalMs - now);
}

/** Spans longer than 1.5 intervals mean the probe was not running — the window
 * has a hole in it, and the log has to say so rather than imply an unbroken
 * hourly cadence. */
export function describeGaps(log: string, intervalMs: number): string[] {
  const timestamps: string[] = [];
  for (const line of log.split("\n")) {
    const match = ROW_PATTERN.exec(line.trim());
    if (match?.[2]) {
      timestamps.push(match[2]);
    }
  }

  const gaps: string[] = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    const previous = Date.parse(timestamps[i - 1] ?? "");
    const current = Date.parse(timestamps[i] ?? "");
    if (Number.isNaN(previous) || Number.isNaN(current)) {
      continue;
    }
    if (current - previous > intervalMs * 1.5) {
      const hours = ((current - previous) / 3_600_000).toFixed(1);
      gaps.push(`${timestamps[i - 1]} → ${timestamps[i]} (${hours} h, probe not running)`);
    }
  }
  return gaps;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const totalAttempts = MAX_ATTEMPTS_OVERRIDE ?? Math.floor((DURATION_HOURS * 60) / INTERVAL_MINUTES) + 1;
  const intervalMs = INTERVAL_MINUTES * 60_000;
  await ensureLogFile();

  const existingLog = await readFile(OUTPUT_PATH, "utf-8").catch(() => "");
  const resumed = parseResumeState(existingLog);

  if (resumed.finished) {
    console.log(`Window already closed (${resumed.passed}/${resumed.completed} attempts). Log: ${OUTPUT_PATH}`);
    return;
  }

  let passed = resumed.passed;
  if (resumed.completed > 0) {
    console.log(
      `Resuming at attempt ${resumed.completed + 1}/${totalAttempts} — ${resumed.passed}/${resumed.completed} recorded so far, window opened ${resumed.firstTimestamp}.`,
    );
  }

  for (let i = resumed.completed + 1; i <= totalAttempts; i += 1) {
    const wait = i === resumed.completed + 1 ? delayUntilNextAttempt(resumed.lastTimestamp, intervalMs, Date.now()) : intervalMs;
    if (wait > 0) {
      await sleep(wait);
    }

    const attempt = await probeOnce();
    if (attempt.sessionCreated && attempt.messageAccepted) {
      passed += 1;
    }
    await appendFile(OUTPUT_PATH, `${toRow(attempt, i)}\n`, "utf-8");
    console.log(`[${i}/${totalAttempts}] ${attempt.timestamp} -> ${attempt.error ?? "ok"}`);
  }

  // The window's real span, not the one the header assumes: a resumed run that
  // lost hours to a reboot covers more than DURATION_HOURS, and SC-006 is
  // judged on what the log actually evidences.
  const finalLog = await readFile(OUTPUT_PATH, "utf-8").catch(() => "");
  const final = parseResumeState(finalLog);
  const gaps = describeGaps(finalLog, intervalMs);
  const spanHours =
    final.firstTimestamp && final.lastTimestamp
      ? ((Date.parse(final.lastTimestamp) - Date.parse(final.firstTimestamp)) / 3_600_000).toFixed(1)
      : "0.0";

  const summary = [
    "",
    `**Summary**: ${passed}/${totalAttempts} attempts succeeded.`,
    `**Window**: ${final.firstTimestamp} → ${final.lastTimestamp} (${spanHours} h).`,
    gaps.length === 0
      ? "**Continuity**: no gap longer than one interval — the probe ran uninterrupted."
      : `**Continuity**: ${gaps.length} interruption(s) — ${gaps.join("; ")}.`,
    "",
  ].join("\n");

  await appendFile(OUTPUT_PATH, summary, "utf-8");
  console.log(`Done. ${passed}/${totalAttempts} attempts succeeded over ${spanHours} h. Log: ${OUTPUT_PATH}`);
  if (passed !== totalAttempts) {
    process.exitCode = 1;
  }
}

// OBS-16: this script used to call main() unconditionally at module load. Now
// that T086 exports pure functions from it, importing it for a unit test would
// otherwise start a live 24-hour probe run and write a log file as a side
// effect. Same guard, and the same Windows reasoning, as demo-path.ts: use
// pathToFileURL rather than string concatenation, because a naive
// `file://${process.argv[1]}` never equals the real drive-lettered URL.
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
