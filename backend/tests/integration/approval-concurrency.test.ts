import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createApprovalRequestFixture, createTicketFixture } from "../helpers/factories.js";
import { ApprovalRequest } from "../../src/models/approval-request.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// T064/R6 edge case: two staff deciding at nearly the same moment must
// resolve with the first writer winning -- exactly one execution, the second
// attempt refused with `APPROVAL_ALREADY_DECIDED`, and both attempts
// attributed via their own StaffActionRecord.

describe("concurrent approval decisions resolve with the first writer winning (R6)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("exactly one of two near-simultaneous approve calls executes; the other gets APPROVAL_ALREADY_DECIDED", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });

    let executions = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      executions += 1;
      return { outcome: "succeeded", observedOutput: "locked=false\npassword_change_required=false", durationMs: 5 };
    });

    const fixture = await createTicketFixture({ category: "password_login" });
    const approvalRequest = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
    });

    const staffA = await seedStaff({ displayName: "Staff A" });
    const staffB = await seedStaff({ displayName: "Staff B" });

    const [resA, resB] = await Promise.all([
      request(ctx.app).post(`/api/staff/approvals/${approvalRequest._id.toString()}/approve`).set("Cookie", staffA.cookie).send({}),
      request(ctx.app).post(`/api/staff/approvals/${approvalRequest._id.toString()}/approve`).set("Cookie", staffB.cookie).send({}),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? resA : resB;
    const loser = resA.status === 200 ? resB : resA;
    expect(winner.body.result.status).toBe("approved");
    expect(loser.body.error.code).toBe("APPROVAL_ALREADY_DECIDED");

    // Exactly one decision ever reached the executor -- two calls (the
    // unlock itself, then its R10 verification read), never four.
    expect(executions).toBe(2);

    const records = await ActionRecord.find({ ticketId: fixture.ticket._id });
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe("succeeded");

    const persisted = await ApprovalRequest.findById(approvalRequest._id);
    expect(persisted?.status).toBe("approved");

    // Both attempts are attributed -- the winner's execution and the loser's
    // lost race both leave their own StaffActionRecord (R6 edge case).
    const staffActions = await StaffActionRecord.find({ targetId: approvalRequest._id }).sort({ at: 1 });
    expect(staffActions).toHaveLength(2);
    expect(staffActions.every((a) => a.action === "approval_decision")).toBe(true);
    expect(staffActions.some((a) => a.details?.conflict === true)).toBe(true);
    expect(staffActions.some((a) => a.details?.conflict !== true)).toBe(true);
  });
});
