import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { attemptAction, setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// T082 edge case: the availability gate is read fresh, uncached, immediately
// before the executor is called (never at proposal time) -- so an action
// already past that gate runs to completion and is audited normally even if
// remediation is disabled while it is executing, but the very next attempt
// is refused because it re-reads the now-disabled setting.

describe("disable-during-execution: a running action completes; nothing new starts (R6 edge case)", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("an action that already passed the availability gate finishes and is audited even if remediation is disabled mid-flight", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });

    let executed = false;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      // Simulate remediation being disabled while this in-flight action is
      // still executing -- it must still complete and be audited normally.
      await RemediationSettings.findByIdAndUpdate(REMEDIATION_SETTINGS_ID, { globallyEnabled: false });
      executed = true;
      return { outcome: "succeeded", observedOutput: "account=test-user-active\nlocked=false\npassword_change_required=false", durationMs: 4 };
    });

    const inFlightResult = await attemptAction({
      actor: "user",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "account-status",
      arguments: { username: "test-user-active" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
    });

    expect(executed).toBe(true);
    expect(inFlightResult.outcome).toBe("succeeded");
    const records = await ActionRecord.find({ policyEntryId: "account-status" });
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe("succeeded");

    // Now that the setting has taken effect, the very next attempt is
    // refused before the executor is ever called again.
    let secondExecutorCalls = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      secondExecutorCalls += 1;
      throw new Error("must never execute once remediation is disabled");
    });

    const nextResult = await attemptAction({
      actor: "user",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "account-status",
      arguments: { username: "test-user-active" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
    });

    expect(nextResult.outcome).toBe("refused");
    expect(nextResult.refusalReason).toBe("remediation_disabled");
    expect(secondExecutorCalls).toBe(0);
  });
});
