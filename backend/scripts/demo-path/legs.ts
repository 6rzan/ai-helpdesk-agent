/**
 * Demo-path leg vocabulary and run log (T007, split out by T082).
 *
 * The pure, testable surface of the release-gated demo path: what the seven
 * legs are, whether a run passed, and how a run's log reads. No network, no
 * DB, no filesystem -- `backend/tests/unit/demo-path.test.ts` (T009) drives
 * these directly, and `demo-path.ts` re-exports them so that test's import
 * path stays unchanged.
 */

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
