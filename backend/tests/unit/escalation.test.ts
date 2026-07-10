import { describe, expect, it } from "vitest";
import {
  decideEscalation,
  type EscalationDecision,
  type EscalationDecisionInput,
} from "../../src/services/escalation/escalation-service.js";

const base: EscalationDecisionInput = {
  userRequestedHuman: false,
  outcome: "classified",
  outOfScope: false,
  clarificationRoundsUsed: 0,
  maxClarificationRounds: 2,
};

function expectEscalation(decision: EscalationDecision, reason: string) {
  expect(decision).toEqual({
    action: "escalate",
    reason,
    handlingMode: "human_involved",
    escalated: true,
  });
}

describe("escalation decision matrix", () => {
  it("TC-037: an explicit human request escalates immediately, regardless of any other signal", () => {
    expectEscalation(decideEscalation({ ...base, userRequestedHuman: true }), "user_request");
    expectEscalation(
      decideEscalation({ ...base, userRequestedHuman: true, outcome: "needs_clarification" }),
      "user_request",
    );
    expectEscalation(
      decideEscalation({
        ...base,
        userRequestedHuman: true,
        outcome: "needs_clarification",
        clarificationRoundsUsed: 2,
      }),
      "user_request",
    );
    expectEscalation(
      decideEscalation({ ...base, userRequestedHuman: true, outcome: "llm_unavailable" }),
      "user_request",
    );
  });

  it("TC-038: low confidence asks for clarification below the round limit and escalates only once rounds are exhausted", () => {
    expect(decideEscalation({ ...base, outcome: "needs_clarification", clarificationRoundsUsed: 0 })).toEqual({
      action: "clarify",
    });
    expect(decideEscalation({ ...base, outcome: "needs_clarification", clarificationRoundsUsed: 1 })).toEqual({
      action: "clarify",
    });
    expectEscalation(
      decideEscalation({ ...base, outcome: "needs_clarification", clarificationRoundsUsed: 2 }),
      "low_confidence",
    );
    expectEscalation(
      decideEscalation({ ...base, outcome: "needs_clarification", clarificationRoundsUsed: 3 }),
      "low_confidence",
    );
  });

  it("TC-039: out-of-scope reports escalate with reason out_of_scope", () => {
    expectEscalation(decideEscalation({ ...base, outOfScope: true }), "out_of_scope");
    expectEscalation(
      decideEscalation({ ...base, outOfScope: true, outcome: "needs_clarification" }),
      "out_of_scope",
    );
  });

  it("TC-040: LLM unavailability escalates with reason llm_unavailable", () => {
    expectEscalation(decideEscalation({ ...base, outcome: "llm_unavailable" }), "llm_unavailable");
  });

  it("TC-041: every escalation decision flags escalated and routes to human_involved", () => {
    const escalatingInputs: EscalationDecisionInput[] = [
      { ...base, userRequestedHuman: true },
      { ...base, outOfScope: true },
      { ...base, outcome: "llm_unavailable" },
      { ...base, outcome: "needs_clarification", clarificationRoundsUsed: 2 },
    ];
    for (const input of escalatingInputs) {
      const decision = decideEscalation(input);
      expect(decision.action).toBe("escalate");
      if (decision.action === "escalate") {
        expect(decision.escalated).toBe(true);
        expect(decision.handlingMode).toBe("human_involved");
        expect(decision.reason).toBeTruthy();
      }
    }
  });

  it("TC-042: never-silent-guess — a low-confidence outcome never proceeds to an unescalated categorised ticket", () => {
    for (let rounds = 0; rounds <= 5; rounds += 1) {
      const decision = decideEscalation({
        ...base,
        outcome: "needs_clarification",
        clarificationRoundsUsed: rounds,
      });
      expect(decision.action).not.toBe("proceed");
      expect(["clarify", "escalate"]).toContain(decision.action);
    }
  });

  it("TC-043: a confident classification with no other signals proceeds without escalation", () => {
    expect(decideEscalation(base)).toEqual({ action: "proceed" });
  });
});
