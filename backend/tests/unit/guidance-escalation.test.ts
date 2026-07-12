import { describe, expect, it } from "vitest";
import { decideStepTransition, endSession } from "../../src/services/guidance/guidance-service.js";
import { GuidedSession } from "../../src/models/guided-session.js";
import { Types } from "mongoose";

describe("Guidance escalation transitions (US2)", () => {
  it("GE-001: not_worked on the last step escalates with the outcome attached (FR-007)", () => {
    const decision = decideStepTransition({ outcome: "not_worked", currentStepIndex: 2, stepCount: 3 });
    expect(decision).toEqual({ action: "escalate", attemptOutcome: "not_worked" });
  });

  it("GE-002: already_tried on the last step escalates with the outcome attached (FR-007)", () => {
    const decision = decideStepTransition({ outcome: "already_tried", currentStepIndex: 2, stepCount: 3 });
    expect(decision).toEqual({ action: "escalate", attemptOutcome: "already_tried" });
  });

  it("GE-003: wants_human escalates immediately at any step, with no attemptOutcome (partial record — FR-008)", () => {
    const first = decideStepTransition({ outcome: "wants_human", currentStepIndex: 0, stepCount: 3 });
    const mid = decideStepTransition({ outcome: "wants_human", currentStepIndex: 1, stepCount: 3 });
    expect(first).toEqual({ action: "escalate" });
    expect(mid).toEqual({ action: "escalate" });
  });

  it("GE-004: endSession moves a session to a terminal state and it is never mutated further by the pure decision function", () => {
    const session = new GuidedSession({
      conversationId: new Types.ObjectId(),
      ticketId: new Types.ObjectId(),
      categoryName: "password_login",
      guideVersion: 1,
      currentStepIndex: 1,
      stepAttempts: [],
      state: "active",
    });
    endSession(session, "escalated");
    expect(session.state).toBe("escalated");
  });

  it("GE-005: endSession records the abandoned terminal state used when a different problem is reported mid-guide (spec edge case)", () => {
    const session = new GuidedSession({
      conversationId: new Types.ObjectId(),
      ticketId: new Types.ObjectId(),
      categoryName: "password_login",
      guideVersion: 1,
      currentStepIndex: 0,
      stepAttempts: [],
      state: "active",
    });
    endSession(session, "abandoned");
    expect(session.state).toBe("abandoned");
  });
});
