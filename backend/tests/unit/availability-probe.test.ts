import { describe, expect, it } from "vitest";
import { delayUntilNextAttempt, describeGaps, parseResumeState } from "../../scripts/availability-probe.js";

// T086: the 24-hour window's progress lives in the log, not in process memory,
// so a demo-machine reboot resumes the window instead of destroying it. Three
// windows were lost to reboots and sleep before this existed. Pure functions
// only — the live run against the real stack is T013/T017.

const HEADER = [
  "# SC-006 Availability Probe Log",
  "",
  "Unattended session+report attempts spread across a 24-hour window, one every 60 minutes.",
  "",
  "| # | Timestamp (UTC) | Health | Session Created | Report Accepted | Result | Error |",
  "|---|---|---|---|---|---|---|",
].join("\n");

function logWith(...rows: string[]): string {
  return `${HEADER}\n${rows.join("\n")}\n`;
}

const HOUR_MS = 3_600_000;

describe("parseResumeState", () => {
  it("TC: reports a fresh window when the log holds only its header", () => {
    const state = parseResumeState(logWith());

    expect(state.completed).toBe(0);
    expect(state.passed).toBe(0);
    expect(state.firstTimestamp).toBeNull();
    expect(state.lastTimestamp).toBeNull();
    expect(state.finished).toBe(false);
  });

  it("TC: recovers the attempt count, pass count, and window bounds from recorded rows", () => {
    const state = parseResumeState(
      logWith(
        "| 1 | 2026-08-27T07:48:39.772Z | ok | true | true | Passed | - |",
        "| 2 | 2026-08-27T08:48:41.100Z | degraded | true | true | Passed | - |",
        "| 3 | 2026-08-27T09:48:42.500Z | unreachable | false | false | Failed | ECONNREFUSED |",
      ),
    );

    expect(state.completed).toBe(3);
    expect(state.passed).toBe(2);
    expect(state.firstTimestamp).toBe("2026-08-27T07:48:39.772Z");
    expect(state.lastTimestamp).toBe("2026-08-27T09:48:42.500Z");
    expect(state.finished).toBe(false);
  });

  it("TC: never counts the header or separator rows as attempts", () => {
    const state = parseResumeState(logWith("| 1 | 2026-08-27T07:48:39.772Z | ok | true | true | Passed | - |"));

    expect(state.completed).toBe(1);
  });

  it("TC: treats a log carrying its closing summary as finished, so a rerun does not extend it", () => {
    const log = `${logWith("| 1 | 2026-08-27T07:48:39.772Z | ok | true | true | Passed | - |")}\n**Summary**: 1/1 attempts succeeded.\n`;

    expect(parseResumeState(log).finished).toBe(true);
  });
});

describe("delayUntilNextAttempt", () => {
  const now = Date.parse("2026-08-27T10:00:00.000Z");

  it("TC: starts immediately when no attempt has been recorded yet", () => {
    expect(delayUntilNextAttempt(null, HOUR_MS, now)).toBe(0);
  });

  it("TC: waits out the remainder of the interval after a recent attempt", () => {
    expect(delayUntilNextAttempt("2026-08-27T09:30:00.000Z", HOUR_MS, now)).toBe(30 * 60_000);
  });

  it("TC: resumes immediately when the machine was down past the next slot", () => {
    // The reboot case: the last attempt is nine hours old, so the next one is
    // long overdue and runs at once.
    expect(delayUntilNextAttempt("2026-08-27T01:00:00.000Z", HOUR_MS, now)).toBe(0);
  });

  it("TC: falls back to running now when the recorded timestamp is unparseable", () => {
    expect(delayUntilNextAttempt("not-a-date", HOUR_MS, now)).toBe(0);
  });
});

describe("describeGaps", () => {
  it("TC: reports no interruption when every attempt is one interval apart", () => {
    const gaps = describeGaps(
      logWith(
        "| 1 | 2026-08-27T07:00:00.000Z | ok | true | true | Passed | - |",
        "| 2 | 2026-08-27T08:00:00.000Z | ok | true | true | Passed | - |",
        "| 3 | 2026-08-27T09:00:00.000Z | ok | true | true | Passed | - |",
      ),
      HOUR_MS,
    );

    expect(gaps).toEqual([]);
  });

  it("TC: names the hole a reboot left, so the log cannot imply an unbroken cadence", () => {
    // The exact shape of the 2026-08-27 log: two attempts 9h39m apart under a
    // header promising hourly attempts.
    const gaps = describeGaps(
      logWith(
        "| 1 | 2026-08-27T07:48:39.772Z | ok | true | true | Passed | - |",
        "| 2 | 2026-08-27T17:28:05.073Z | degraded | true | true | Passed | - |",
      ),
      HOUR_MS,
    );

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toContain("9.7 h");
    expect(gaps[0]).toContain("probe not running");
  });

  it("TC: tolerates ordinary jitter without calling it an interruption", () => {
    const gaps = describeGaps(
      logWith(
        "| 1 | 2026-08-27T07:00:00.000Z | ok | true | true | Passed | - |",
        "| 2 | 2026-08-27T08:20:00.000Z | ok | true | true | Passed | - |",
      ),
      HOUR_MS,
    );

    expect(gaps).toEqual([]);
  });
});
