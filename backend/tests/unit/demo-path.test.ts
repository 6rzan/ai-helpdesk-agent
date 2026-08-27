import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { allLegsPassed, buildLog, LEG_ORDER, type LegResult } from "../../scripts/demo-path.js";

// T009: the script ships with its own test (Principle IV). This exercises
// only the pure, testable surface — LEG_ORDER, allLegsPassed, buildLog — with
// no network or DB involved; the live run against the real demo machine is
// T014/T066, not this suite.

function passResult(leg: LegResult["leg"]): LegResult {
  return { leg, status: "PASS", detail: `${leg} ok` };
}

describe("demo-path script structure", () => {
  it("TC: declares exactly the seven legs FR-002/SC-008 require, in order", () => {
    expect(LEG_ORDER).toEqual([
      "intake",
      "classification",
      "ticket-creation",
      "guided-troubleshooting",
      "escalation",
      "staff-takeover",
      "whitelisted-remediation",
    ]);
    expect(LEG_ORDER).toHaveLength(7);
  });

  it("TC: passes only when every leg is present and PASS", () => {
    const allPass = LEG_ORDER.map(passResult);
    expect(allLegsPassed(allPass)).toBe(true);
  });

  it("TC: fails the run when any leg reports FAIL", () => {
    const results = LEG_ORDER.map(passResult);
    results[3] = { leg: "guided-troubleshooting", status: "FAIL", detail: "guide never advanced" };
    expect(allLegsPassed(results)).toBe(false);
  });

  it("TC: fails the run when a leg is skipped entirely (never reached)", () => {
    // Every leg but the last — a leg that never ran is exactly as bad as one
    // that ran and failed; nothing may be missing from the results list.
    const partial = LEG_ORDER.slice(0, 6).map(passResult);
    expect(allLegsPassed(partial)).toBe(false);
  });
});

describe("demo-path log format", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("TC: a PASS log names the result, all seven legs, and their detail", () => {
    const results = LEG_ORDER.map(passResult);
    const log = buildLog(results, "2026-08-27T00:00:00.000Z", "2026-08-27T00:05:00.000Z");

    expect(log).toContain("PASS — all 7 legs");
    for (const leg of LEG_ORDER) {
      expect(log).toContain(`${leg} ok`);
    }
    // Well-formed markdown table: a header row and a separator row precede
    // exactly seven data rows.
    const tableRows = log.split("\n").filter((line) => line.startsWith("|"));
    expect(tableRows).toHaveLength(2 + 7);
  });

  it("TC: a run with a skipped leg produces a FAIL log naming it SKIPPED, never silently PASS", () => {
    const results = LEG_ORDER.slice(0, 5).map(passResult); // staff-takeover, whitelisted-remediation never ran
    const log = buildLog(results, "2026-08-27T00:00:00.000Z", "2026-08-27T00:03:00.000Z");

    expect(log).toContain("**Result**: FAIL");
    expect(log).toMatch(/Staff takeover.*\*\*SKIPPED\*\*/);
    expect(log).toMatch(/Whitelisted remediation.*\*\*SKIPPED\*\*/);
  });

  it("TC: the log is written to a well-formed, parseable file on disk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "demo-path-log-"));
    tmpDirs.push(dir);
    const results = LEG_ORDER.map(passResult);
    const log = buildLog(results, "2026-08-27T00:00:00.000Z", "2026-08-27T00:05:00.000Z");
    const filePath = path.join(dir, "run.md");

    await import("node:fs/promises").then((fs) => fs.writeFile(filePath, log, "utf-8"));
    const written = await readFile(filePath, "utf-8");

    expect(written).toBe(log);
    expect(written.startsWith("# Demo Path Run")).toBe(true);
    expect(written.split("\n").filter((l) => l.startsWith("|")).length).toBe(9);
  });
});
