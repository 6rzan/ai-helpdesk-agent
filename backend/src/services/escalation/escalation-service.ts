import type { EscalationReason } from "../../models/enums.js";

// Pure decision module (Constitution Principle II): every path that could
// silently guess must instead clarify or escalate. Precedence: an explicit
// human request always wins, then scope, then availability, then confidence.
export interface EscalationDecisionInput {
  userRequestedHuman: boolean;
  outcome: "classified" | "needs_clarification" | "llm_unavailable";
  outOfScope: boolean;
  clarificationRoundsUsed: number;
  maxClarificationRounds: number;
}

export type EscalationDecision =
  | { action: "proceed" }
  | { action: "clarify" }
  | { action: "escalate"; reason: EscalationReason; handlingMode: "human_involved"; escalated: true };

function escalate(reason: EscalationReason): EscalationDecision {
  return { action: "escalate", reason, handlingMode: "human_involved", escalated: true };
}

export function decideEscalation(input: EscalationDecisionInput): EscalationDecision {
  if (input.userRequestedHuman) {
    return escalate("user_request");
  }
  if (input.outOfScope) {
    return escalate("out_of_scope");
  }
  if (input.outcome === "llm_unavailable") {
    return escalate("llm_unavailable");
  }
  if (input.outcome === "needs_clarification") {
    if (input.clarificationRoundsUsed < input.maxClarificationRounds) {
      return { action: "clarify" };
    }
    return escalate("low_confidence");
  }
  return { action: "proceed" };
}
