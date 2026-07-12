import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import { Guide } from "../../src/models/guide.js";
import { GuidedSession } from "../../src/models/guided-session.js";

async function startSession(ctx: TestContext, orgId: string) {
  const res = await request(ctx.app).post("/api/sessions").send({ orgId, displayName: "Alex Chen" });
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string };
}

async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);
  return res;
}

async function getTicket(ctx: TestContext, sessionId: string, reference: string) {
  const res = await request(ctx.app).get(`/api/tickets/${reference}`).query({ sessionId });
  expect(res.status).toBe(200);
  return res.body.ticket;
}

async function waitForTicket(conversationId: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ticket = await Ticket.findOne({ conversationId }).sort({ createdAt: -1 });
    if (ticket) return ticket;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for ticket creation");
}

async function waitForAgentReplyContaining(conversationId: string, substring: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const match = await Message.findOne({
      conversationId,
      author: "agent",
      text: new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    }).sort({ sentAt: -1 });
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for agent reply containing "${substring}"`);
}

async function seedTwoStepPasswordGuide(): Promise<void> {
  await Guide.findOneAndUpdate(
    { categoryName: "password_login", active: true },
    {
      steps: [
        { instruction: "Double-check Caps Lock is off and re-type your password.", successHint: "You can sign in." },
        { instruction: "Use the forgot-password link to reset your password.", successHint: "You can set a new password." },
      ],
    },
  );
}

describe("Mid-guide human handoff (US2, FR-009)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
    resetSessionStore();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("GE-REQ-001: \"just get me a person\" mid-guide stops guidance immediately and escalates with a partial attempted-steps record", async () => {
    await seedTwoStepPasswordGuide();
    const session = await startSession(ctx, "GH111111");

    await postMessage(ctx, session, "I forgot my password and can't log into my computer");
    const ticket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, ticket.reference);

    // Attempt step 1 (records a not_worked attempt) before asking for a person.
    await postMessage(ctx, session, "still doesn't work");
    await waitForAgentReplyContaining(session.conversationId, "Step 2 of 2");

    await postMessage(ctx, session, "just get me a person please");
    await waitForAgentReplyContaining(session.conversationId, "bringing in a person");

    const escalatedTicket = await Ticket.findById(ticket._id);
    expect(escalatedTicket?.escalated).toBe(true);
    expect(escalatedTicket?.escalationReason).toBe("user_request");
    expect(escalatedTicket?.handlingMode).toBe("human_involved");

    const guidedSession = await GuidedSession.findOne({ conversationId: session.conversationId });
    expect(guidedSession?.state).toBe("escalated");
    // Only step 0 was attempted before the handoff — step 1 was never resolved.
    expect(guidedSession?.stepAttempts).toHaveLength(1);
    expect(guidedSession?.stepAttempts[0]).toMatchObject({ stepIndex: 0, outcome: "not_worked" });

    const detail = await getTicket(ctx, session.sessionId, ticket.reference);
    expect(detail.guidance.state).toBe("escalated");
    expect(detail.guidance.stepAttempts).toHaveLength(1);
    expect(detail.transcript.length).toBeGreaterThan(0);
  });
});
