import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { createTicketFixture } from "../helpers/factories.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { ApprovalRequest } from "../../src/models/approval-request.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { attemptAction, setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";
import { recordConsent } from "../../src/services/remediation/consent-service.js";
import { Message } from "../../src/models/message.js";

// T066/SC-005a: zero state-changing executions ever happen without both a
// recorded consent AND a recorded staff approval -- including deliberate
// attempts to bypass the approval step.

describe("state-changing actions never execute without consent AND approval (SC-005a)", () => {
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

  it("refuses with missing_approval when consent is given but no approval is attached, and never calls the executor", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    let calls = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      calls += 1;
      throw new Error("must never execute");
    });

    const result = await attemptAction({
      actor: "user",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "unlock-account",
      arguments: { username: "test-user-locked" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
      // Deliberately no approval -- attempting to bypass the approval step.
    });

    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("missing_approval");
    expect(calls).toBe(0);
  });

  it("refuses with missing_consent when approval is attached but consent was never given, and never calls the executor", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    let calls = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      calls += 1;
      throw new Error("must never execute");
    });

    const result = await attemptAction({
      actor: "staff",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "unlock-account",
      arguments: { username: "test-user-locked" },
      endpointId: "test-node-a",
      // Deliberately no consent -- an approval reference alone is not enough.
      approval: { requestId: new Types.ObjectId(), byAccountId: new Types.ObjectId(), displayName: "Staff", at: new Date() },
    });

    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("missing_consent");
    expect(calls).toBe(0);
  });

  it("executes only once both consent and approval are present (positive control)", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async (): Promise<ExecutionResult> => ({
      outcome: "succeeded",
      observedOutput: "locked=false\npassword_change_required=false",
      durationMs: 5,
    }));

    const result = await attemptAction({
      actor: "staff",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "unlock-account",
      arguments: { username: "test-user-locked" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
      approval: { requestId: new Types.ObjectId(), byAccountId: new Types.ObjectId(), displayName: "Staff", at: new Date() },
    });

    expect(result.outcome).toBe("succeeded");
  });

  it("granting a state-changing proposal raises an approval request instead of executing: no ActionRecord yet, no executor call", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    let calls = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      calls += 1;
      throw new Error("must never execute before staff approval");
    });

    const fixture = await createTicketFixture({ category: "password_login" });
    const message = await Message.create({ conversationId: fixture.conversationId, author: "agent", text: "offer", inputOrigin: "typed" });
    const proposalId = "test-proposal-1";
    fixture.ticket.reporterAccountId = new Types.ObjectId();
    fixture.ticket.pendingActionProposal = {
      proposalId,
      toolName: "unlock_account",
      policyEntryId: "unlock-account",
      tier: "state_changing",
      description: "Unlocks a locked local test account on the endpoint.",
      arguments: { username: "test-user-locked" },
      endpointId: "test-node-a",
      endpointLabel: "Test Node A",
      raisedAt: new Date(),
      raisedInMessageId: message._id,
    };
    await fixture.ticket.save();

    const result = await recordConsent({
      sessionId: "test-session",
      reference: fixture.reference,
      reporterId: fixture.reporterId,
      proposalId,
      granted: true,
    });

    expect(result.outcome).toBe("pending_approval");
    expect(result.approvalId).toBeTruthy();
    expect(calls).toBe(0);

    const records = await ActionRecord.find({ ticketId: fixture.ticket._id });
    expect(records).toHaveLength(0);

    const approvals = await ApprovalRequest.find({ ticketId: fixture.ticket._id });
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.status).toBe("pending");
    expect(approvals[0]?.policyEntryId).toBe("unlock-account");

    // T085 (OBS-11): the two messages the reporter actually sees embed the
    // description mid-sentence, so neither may double the authored full stop
    // nor carry the planner-facing "Verified by ..." blurb.
    const reporterMessages = await Message.find({ conversationId: fixture.conversationId }).sort({ _id: 1 });
    const decision = reporterMessages.find((m) => m.text.startsWith("Yes, go ahead:"));
    const signOff = reporterMessages.find((m) => m.text.startsWith("That needs IT staff sign-off first:"));

    expect(decision?.text).toBe("Yes, go ahead: Unlocks a locked local test account on the endpoint");
    expect(signOff?.text).toBe(
      "That needs IT staff sign-off first: Unlocks a locked local test account on the endpoint. I'll let you know as soon as it's decided.",
    );
    for (const message of [decision, signOff]) {
      expect(message?.text).not.toContain("..");
      expect(message?.text).not.toContain("Verified by");
    }
  });

  it("declining a state-changing proposal raises no approval request at all: only the decline is recorded (US3 AS4)", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    let calls = 0;
    setExecutorForTest(async (): Promise<ExecutionResult> => {
      calls += 1;
      throw new Error("must never execute on a decline");
    });

    const fixture = await createTicketFixture({ category: "password_login" });
    const message = await Message.create({ conversationId: fixture.conversationId, author: "agent", text: "offer", inputOrigin: "typed" });
    const proposalId = "test-proposal-decline-1";
    fixture.ticket.reporterAccountId = new Types.ObjectId();
    fixture.ticket.pendingActionProposal = {
      proposalId,
      toolName: "unlock_account",
      policyEntryId: "unlock-account",
      tier: "state_changing",
      description: "Unlocks a locked local test account on the endpoint.",
      arguments: { username: "test-user-locked" },
      endpointId: "test-node-a",
      endpointLabel: "Test Node A",
      raisedAt: new Date(),
      raisedInMessageId: message._id,
    };
    await fixture.ticket.save();

    const result = await recordConsent({
      sessionId: "test-session",
      reference: fixture.reference,
      reporterId: fixture.reporterId,
      proposalId,
      granted: false,
    });

    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("missing_consent");
    expect(calls).toBe(0);

    const approvals = await ApprovalRequest.find({ ticketId: fixture.ticket._id });
    expect(approvals).toHaveLength(0);

    const records = await ActionRecord.find({ ticketId: fixture.ticket._id });
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe("refused");
    expect(records[0]?.refusalReason).toBe("missing_consent");
  });
});
