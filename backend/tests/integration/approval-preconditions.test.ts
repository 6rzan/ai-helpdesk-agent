import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createApprovalRequestFixture, createTicketFixture } from "../helpers/factories.js";
import { ApprovalRequest } from "../../src/models/approval-request.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { decideApproval } from "../../src/services/remediation/approval-service.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// T065/R6: approval-time preconditions are re-checked, never assumed still
// true from when the request was raised. Each failure closes the request as
// `no_longer_applicable` and calls the executor zero times (edge case).

describe("approval preconditions are re-checked at decision time (R6)", () => {
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

  function neverExecutes(): ExecutionResult {
    throw new Error("executor must never be called once a precondition has failed");
  }

  it("closes as no_longer_applicable when the ticket has since been resolved", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const fixture = await createTicketFixture({ category: "password_login", status: "resolved" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_NO_LONGER_APPLICABLE",
    });

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("no_longer_applicable");
    expect(persisted?.resultingActionRecordId).toBeNull();
  });

  it("closes as no_longer_applicable when remediation has since been disabled globally", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: false, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_NO_LONGER_APPLICABLE",
    });

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("no_longer_applicable");
  });

  it("closes as no_longer_applicable when remediation has since been disabled for this endpoint only", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: ["test-node-a"] });
    setExecutorForTest(async () => neverExecutes());

    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      endpointId: "test-node-a",
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_NO_LONGER_APPLICABLE",
    });
  });

  it("closes as no_longer_applicable when this exact action already executed for the ticket", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const fixture = await createTicketFixture({ category: "password_login" });
    await ActionRecord.create({
      actor: "staff",
      ticketId: fixture.ticket._id,
      classifiedIntent: "password_login",
      policyEntryId: "unlock-account",
      requestedAction: "sudo /usr/local/bin/unlock-account.sh test-user-locked",
      endpointId: "test-node-a",
      outcome: "succeeded",
    });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_NO_LONGER_APPLICABLE",
    });

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("no_longer_applicable");
  });
});
