// FR-016: turns an unprompted, in-chat "please just do X" request into a
// specific, auditable policy attempt instead of a single canned refusal.
// Matching is a closed, deterministic table — never fuzzy, never
// LLM-driven — the same "exact match or refused" discipline the policy
// engine itself applies (Constitution Principle II). Employee text is only
// ever tested against these fixed patterns; text embedded inside it (e.g.
// an attempted instruction override) is inert data, never something these
// patterns interpret as a directive (FR-006).

export interface AdHocAttempt {
  policyEntryId: string;
  arguments: Record<string, string>;
  endpointId: string;
}

export interface AdHocCandidate {
  description: string;
  attempt: AdHocAttempt;
}

export type AdHocInterpretation =
  | { kind: "vague" }
  | { kind: "ambiguous"; candidates: AdHocCandidate[] }
  | { kind: "attempt"; attempt: AdHocAttempt; description: string };

/** A request too generic to identify any specific approved action at all
 * (FR-015 "low confidence") — distinct from naming something concrete that
 * simply isn't approved. */
const VAGUE_PATTERN = /\b(fix|sort out|sort it out|take care of|handle|deal with)\b[^.!?]{0,30}\b(this|it|that|for me)\b/i;

const WIDGET_SERVICE_PATTERN = /\bwidget[\s-]?service\b/i;
const PRINT_QUEUE_PATTERN = /\bprint[\s-]?(queue|spooler)\b|\bspooler\b/i;

function ownDeviceEndpoint(text: string): boolean {
  return /\b(my|the) (own )?(laptop|computer|machine|pc|desktop|phone|device)\b/i.test(text);
}

function namedEndpoint(text: string, fallback: string): string {
  if (ownDeviceEndpoint(text)) {
    // Never a registered endpoint, by construction — no request shape names
    // the employee's own hardware as a target (FR-003).
    return "employee-own-device";
  }
  if (/\btest[\s-]?node[\s-]?a\b/i.test(text)) {
    return "test-node-a";
  }
  if (/\btest[\s-]?node[\s-]?b\b/i.test(text)) {
    return "test-node-b";
  }
  return fallback;
}

function usernameArgument(text: string): string {
  if (/\btest-user-active\b/i.test(text)) {
    return "test-user-active";
  }
  if (/\btest-user-locked\b/i.test(text)) {
    return "test-user-locked";
  }
  const named = text.match(/\bfor\s+([a-z][a-z0-9._-]{1,32})\b/i);
  return named?.[1] ?? "test-user-locked";
}

interface Rule {
  policyEntryId: string;
  description: string;
  match: (text: string) => boolean;
  build: (text: string) => AdHocAttempt;
}

const RULES: Rule[] = [
  {
    policyEntryId: "unlock-account",
    description: "unlock the test account",
    match: (t) => /\bunlock\b/i.test(t) && /\baccount\b/i.test(t),
    build: (t) => ({
      policyEntryId: "unlock-account",
      arguments: { username: usernameArgument(t) },
      endpointId: namedEndpoint(t, "test-node-a"),
    }),
  },
  {
    policyEntryId: "expire-password",
    description: "force a password change on the test account",
    match: (t) => /\breset\b[^.!?]{0,20}\bpassword\b/i.test(t) || /\bforce\b[^.!?]{0,20}\bpassword change\b/i.test(t),
    build: (t) => ({
      policyEntryId: "expire-password",
      arguments: { username: usernameArgument(t) },
      endpointId: namedEndpoint(t, "test-node-a"),
    }),
  },
  {
    policyEntryId: "restart-service",
    description: "restart the widget service",
    match: (t) => /\brestart\b/i.test(t) && WIDGET_SERVICE_PATTERN.test(t),
    build: (t) => ({
      policyEntryId: "restart-service",
      arguments: { service: "widget-service" },
      endpointId: namedEndpoint(t, "test-node-a"),
    }),
  },
  {
    policyEntryId: "clear-print-queue",
    description: "clear the print queue",
    match: (t) => /\b(clear|restart)\b/i.test(t) && PRINT_QUEUE_PATTERN.test(t),
    build: (t) => ({
      policyEntryId: "clear-print-queue",
      arguments: {},
      endpointId: namedEndpoint(t, "test-node-b"),
    }),
  },
];

/** No policy entry this codebase has ever registered — guaranteed to make
 * `matchAction` return `no_matching_entry` (policy-engine.ts). */
const UNMATCHED_POLICY_ENTRY_ID = "unmatched-adhoc-request";

export function interpretAdHocRequest(text: string): AdHocInterpretation {
  const matched = RULES.filter((rule) => rule.match(text));

  if (matched.length >= 2) {
    return {
      kind: "ambiguous",
      candidates: matched.map((rule) => ({ description: rule.description, attempt: rule.build(text) })),
    };
  }
  if (matched.length === 1) {
    const rule = matched[0]!;
    return { kind: "attempt", attempt: rule.build(text), description: rule.description };
  }
  if (VAGUE_PATTERN.test(text)) {
    return { kind: "vague" };
  }
  return {
    kind: "attempt",
    attempt: { policyEntryId: UNMATCHED_POLICY_ENTRY_ID, arguments: {}, endpointId: "unmatched-target" },
    description: text.length > 120 ? `${text.slice(0, 117)}...` : text,
  };
}

/** Resolves a clarifying reply against the candidates it was asked about —
 * still exact, never a guess between near-misses. Returns null when the
 * reply still doesn't clearly name exactly one of them. */
export function resolveAmbiguousReply(reply: string, candidates: AdHocCandidate[]): AdHocCandidate | null {
  const named = candidates.filter((candidate) => {
    if (candidate.attempt.policyEntryId === "restart-service") {
      return WIDGET_SERVICE_PATTERN.test(reply);
    }
    if (candidate.attempt.policyEntryId === "clear-print-queue") {
      return PRINT_QUEUE_PATTERN.test(reply);
    }
    return false;
  });
  return named.length === 1 ? named[0]! : null;
}
