import { describe, expect, it, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { matchAction, attemptAction, setExecutorForTest } from "../../src/services/remediation/policy-engine.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";

// T024: exact matching only (FR-002, US2 AS3). Every one of these must
// refuse with the correct reason and must never reach the executor.
describe("policy-engine.matchAction — exact matching", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("matches a known, well-formed request", () => {
    const result = matchAction("account-status", { username: "test-user-locked" }, "test-node-a");
    expect(result.ok).toBe(true);
  });

  it("refuses an unknown action id with no_matching_entry", () => {
    const result = matchAction("delete-everything", {}, "test-node-a");
    expect(result).toEqual({ ok: false, reason: "no_matching_entry" });
  });

  it("refuses a near-miss variant of an approved action id with no_matching_entry", () => {
    const result = matchAction("account-statuses", { username: "test-user-locked" }, "test-node-a");
    expect(result).toEqual({ ok: false, reason: "no_matching_entry" });
  });

  it("refuses an altered/unknown argument key with argument_mismatch", () => {
    const result = matchAction("account-status", { user: "test-user-locked" }, "test-node-a");
    expect(result).toEqual({ ok: false, reason: "argument_mismatch" });
  });

  it("refuses an argument value outside its declared enum with argument_mismatch", () => {
    const result = matchAction("account-status", { username: "root" }, "test-node-a");
    expect(result).toEqual({ ok: false, reason: "argument_mismatch" });
  });

  it("refuses an argument failing its declared pattern with argument_mismatch", () => {
    const result = matchAction("network-probe", { target: "not-a-real-target; rm -rf /" }, "test-node-a");
    expect(result).toEqual({ ok: false, reason: "argument_mismatch" });
  });

  it("refuses an unregistered endpoint id with unregistered_target", () => {
    const result = matchAction("account-status", { username: "test-user-locked" }, "someone-elses-laptop");
    expect(result).toEqual({ ok: false, reason: "unregistered_target" });
  });

  it("refuses a registered endpoint not in the entry's allowedEndpointIds with endpoint_not_permitted", () => {
    // account-status is only permitted against test-node-a.
    const result = matchAction("account-status", { username: "test-user-locked" }, "test-node-b");
    expect(result).toEqual({ ok: false, reason: "endpoint_not_permitted" });
  });
});

describe("policy-engine.attemptAction — refusals never reach the executor", () => {
  const executorSpy = vi.fn();

  beforeAll(async () => {
    await startTestApp();
  });
  beforeEach(() => {
    executorSpy.mockReset();
    setExecutorForTest(executorSpy);
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("audits and refuses an unmatched action without calling the executor", async () => {
    const result = await attemptAction({
      actor: "agent",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "reinstall software",
      policyEntryId: "reinstall-software",
      arguments: {},
      endpointId: "test-node-a",
    });
    expect(result).toEqual({ outcome: "refused", refusalReason: "no_matching_entry", observedOutput: null });
    expect(executorSpy).not.toHaveBeenCalled();
  });

  it("refuses with remediation_disabled when the kill switch is off, without calling the executor", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: false, disabledEndpointIds: [] });
    const result = await attemptAction({
      actor: "agent",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "check service status",
      policyEntryId: "service-status",
      arguments: { service: "widget-service" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
    });
    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("remediation_disabled");
    expect(executorSpy).not.toHaveBeenCalled();
  });

  it("refuses with missing_consent when no consent was given, without calling the executor", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const result = await attemptAction({
      actor: "agent",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "check service status",
      policyEntryId: "service-status",
      arguments: { service: "widget-service" },
      endpointId: "test-node-a",
    });
    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("missing_consent");
    expect(executorSpy).not.toHaveBeenCalled();
  });
});
