import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { GuidedSession } from "../../src/models/guided-session.js";
import { Message } from "../../src/models/message.js";
import { Ticket } from "../../src/models/ticket.js";
import { nextTicketReference } from "../../src/services/ticket/counter.js";

// T083 edge case: the employee later contradicts an already-succeeded,
// already-verified state-changing action ("still locked" after a reported
// unlock). Both the original verification result and the employee's
// contradiction stay on the record, the ticket escalates, and the action is
// never re-run -- the guided flow's own deterministic step machine handles
// this without any special-cased remediation code (research R5, FR-014).

async function startAccountSession(ctx: TestContext) {
  const seeded = await seedUser({ displayName: "Jamie Fox" });
  const res = await request(ctx.app).post("/api/sessions").set("Cookie", seeded.cookie).send({});
  expect(res.status).toBe(201);
  return {
    sessionId: res.body.sessionId as string,
    conversationId: res.body.conversationId as string,
    reporterId: res.body.reporter.id as string,
  };
}

async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);
}

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 2000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}

describe("employee contradicts a verified state-changing action (US3, edge case)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("records the contradiction, escalates, and never re-runs the action", async () => {
    const session = await startAccountSession(ctx);

    const reference = await nextTicketReference();
    const ticket = await Ticket.create({
      reference,
      reporterId: new Types.ObjectId(session.reporterId),
      conversationId: new Types.ObjectId(session.conversationId),
      description: "Cannot sign in, account was locked.",
      category: "password_login",
      status: "in_progress",
      handlingMode: "automated",
    });

    // Fast-forward to the guide's last step (index 2), as if steps 0 and 1
    // already ran, and seed the already-succeeded, already-verified unlock
    // exactly as approval-service would have recorded it.
    await GuidedSession.create({
      conversationId: ticket.conversationId,
      ticketId: ticket._id,
      categoryName: "password_login",
      guideVersion: 1,
      currentStepIndex: 2,
      stepAttempts: [
        { stepIndex: 0, outcome: "not_worked" },
        { stepIndex: 1, outcome: "not_worked" },
      ],
      state: "active",
    });
    const originalRecord = await ActionRecord.create({
      actor: "staff",
      ticketId: ticket._id,
      conversationId: ticket.conversationId,
      classifiedIntent: "password_login",
      policyEntryId: "unlock-account",
      tier: "state_changing",
      requestedAction: "sudo /usr/local/bin/unlock-account.sh test-user-locked",
      endpointId: "test-node-a",
      outcome: "succeeded",
      observedOutput: "unlocked=test-user-locked",
      verification: {
        entryId: "account-status",
        outcome: "succeeded",
        observedOutput: "account=test-user-locked\nlocked=false\npassword_change_required=false",
      },
    });

    await postMessage(ctx, session, "It's still locked, that didn't work.");

    const refreshedTicket = await waitFor(async () => {
      const t = await Ticket.findById(ticket._id);
      return t?.escalated ? t : null;
    });
    expect(refreshedTicket.escalationReason).toBe("guidance_exhausted");
    expect(refreshedTicket.handlingMode).toBe("human_involved");

    // The employee's contradiction reached the transcript...
    const contradiction = await Message.findOne({ conversationId: ticket.conversationId, author: "user" }).sort({ sentAt: -1 });
    expect(contradiction?.text).toContain("still locked");

    // ...and the original verification result is untouched, immutable, and
    // still the only record of this action -- it was never re-run.
    const unlockRecords = await ActionRecord.find({ ticketId: ticket._id, policyEntryId: "unlock-account" });
    expect(unlockRecords).toHaveLength(1);
    expect(unlockRecords[0]?._id.toString()).toBe(originalRecord._id.toString());
    expect(unlockRecords[0]?.outcome).toBe("succeeded");
    expect(unlockRecords[0]?.verification?.outcome).toBe("succeeded");

    const session_ = await GuidedSession.findOne({ ticketId: ticket._id });
    expect(session_?.state).toBe("escalated");
  });
});
