import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createApprovalRequestFixture, createTicketFixture } from "../helpers/factories.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { Ticket } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { decideApproval } from "../../src/services/remediation/approval-service.js";
import { setExecutorForTest, type ExecutionResult, type ExecutionRequest } from "../../src/services/remediation/policy-engine.js";

// T067/research R10, US3 AS5: every state-changing action is verified before
// its outcome is reported, never trusted on its own exit code -- confirmed,
// contradicted (-> failed, escalate), and missing/failed verification
// (-> attempted_unverified, escalate).

describe("state-changing actions are verified before their outcome is reported (R10)", () => {
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

  async function approveAndDecide(executor: (request: ExecutionRequest) => Promise<ExecutionResult>) {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(executor);

    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      policyEntryId: "unlock-account",
      arguments: { username: "test-user-locked" },
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    const decision = await decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true });
    const ticket = await Ticket.findById(fixture.ticket._id);
    const record = await ActionRecord.findOne({ ticketId: fixture.ticket._id });
    return { decision, ticket, record };
  }

  it("verification confirms the intended state: outcome is succeeded", async () => {
    const { decision, ticket, record } = await approveAndDecide(async (request) =>
      request.command.includes("unlock-account.sh")
        ? { outcome: "succeeded", observedOutput: "unlocked=test-user-locked", durationMs: 3 }
        : { outcome: "succeeded", observedOutput: "account=test-user-locked\nlocked=false\npassword_change_required=false", durationMs: 3 },
    );

    expect(decision.execution?.outcome).toBe("succeeded");
    expect(record?.outcome).toBe("succeeded");
    expect(record?.verification).toMatchObject({ entryId: "account-status", outcome: "succeeded" });
    expect(ticket?.escalated).toBe(false);
  });

  it("verification contradicts the intended state: outcome is failed and the ticket is escalated with the full record", async () => {
    const { decision, ticket, record } = await approveAndDecide(async (request) =>
      request.command.includes("unlock-account.sh")
        ? { outcome: "succeeded", observedOutput: "unlocked=test-user-locked", durationMs: 3 }
        : { outcome: "succeeded", observedOutput: "account=test-user-locked\nlocked=true\npassword_change_required=false", durationMs: 3 },
    );

    expect(decision.execution?.outcome).toBe("failed");
    expect(record?.outcome).toBe("failed");
    expect(record?.verification).toMatchObject({
      entryId: "account-status",
      outcome: "succeeded",
      observedOutput: "account=test-user-locked\nlocked=true\npassword_change_required=false",
    });
    expect(ticket?.escalated).toBe(true);
    expect(ticket?.escalationReason).toBe("remediation_issue");
  });

  it("verification itself fails to run: outcome is attempted_unverified and the ticket is escalated", async () => {
    const { decision, ticket, record } = await approveAndDecide(async (request) =>
      request.command.includes("unlock-account.sh")
        ? { outcome: "succeeded", observedOutput: "unlocked=test-user-locked", durationMs: 3 }
        : { outcome: "timed_out", observedOutput: null, durationMs: 5000 },
    );

    expect(decision.execution?.outcome).toBe("attempted_unverified");
    expect(record?.outcome).toBe("attempted_unverified");
    expect(record?.verification).toMatchObject({ entryId: "account-status", outcome: "timed_out" });
    expect(ticket?.escalated).toBe(true);
    expect(ticket?.escalationReason).toBe("remediation_issue");
  });
});
