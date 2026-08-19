import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createApprovalRequestFixture, createTicketFixture } from "../helpers/factories.js";
import { ApprovalRequest } from "../../src/models/approval-request.js";
import { decideApproval, listApprovalRequests } from "../../src/services/remediation/approval-service.js";

// T063/data-model.md §4, research R6: the approval lifecycle's own rules,
// independent of any HTTP route -- lazy expiry evaluated on list and on
// decide, expiry never meaning approval, and only `pending` requests ever
// transitioning.

describe("approval lifecycle (R6, FR-004b)", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("lazily expires a past-due pending request when the queue is listed, never on a schedule", async () => {
    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      expiresAt: new Date(Date.now() - 1000),
    });

    const stillPending = await ApprovalRequest.findById(request._id);
    expect(stillPending?.status).toBe("pending");

    const listed = await listApprovalRequests();
    const found = listed.find((r) => r._id.equals(request._id));
    expect(found?.status).toBe("expired");

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("expired");
  });

  it("expiry never means approval: a decision attempted on an expired request is refused, never executed", async () => {
    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      expiresAt: new Date(Date.now() - 1000),
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_ALREADY_DECIDED",
    });

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("expired");
    expect(persisted?.resultingActionRecordId).toBeNull();
  });

  it("only a pending request transitions: deciding an already-declined request is refused", async () => {
    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      status: "declined",
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    await expect(decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true })).rejects.toMatchObject({
      code: "APPROVAL_ALREADY_DECIDED",
    });

    const persisted = await ApprovalRequest.findById(request._id);
    expect(persisted?.status).toBe("declined");
  });

  it("deciding an unknown approval id is refused as not found", async () => {
    const staff = await seedStaff({ displayName: "Staff Decider" });
    await expect(
      decideApproval({ approvalId: "64b000000000000000000000", staff: staff.account, granted: true }),
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" });
  });
});
