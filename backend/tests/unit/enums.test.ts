import { describe, expect, it } from "vitest";
import { ACTION_OUTCOMES, ACTION_TIERS, REFUSAL_REASONS } from "../../src/models/enums.js";

// T010: exact membership of the new remediation enums (data-model.md §1, §5).
describe("remediation enums", () => {
  it("ACTION_TIERS has exactly read_only and state_changing", () => {
    expect(ACTION_TIERS).toEqual(["read_only", "state_changing"]);
  });

  it("ACTION_OUTCOMES has exactly the five outcomes", () => {
    expect(ACTION_OUTCOMES).toEqual(["succeeded", "failed", "timed_out", "attempted_unverified", "refused"]);
  });

  it("REFUSAL_REASONS has exactly the twelve reasons from data-model.md §5", () => {
    expect(REFUSAL_REASONS).toEqual([
      "no_matching_entry",
      "argument_mismatch",
      "unregistered_target",
      "endpoint_not_permitted",
      "missing_consent",
      "missing_approval",
      "remediation_disabled",
      "low_confidence",
      "degraded_model",
      "not_ticket_owner",
      "already_attempted",
      "step_cap_reached",
    ]);
    expect(REFUSAL_REASONS).toHaveLength(12);
  });
});
