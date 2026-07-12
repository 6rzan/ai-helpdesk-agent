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

describe("Guided escalation on exhaustion (US2, SC-003)", () => {
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

  it("GE-EXH-001: exhausting every step escalates with a plain-language notice and every step recorded", async () => {
    await seedTwoStepPasswordGuide();
    const session = await startSession(ctx, "GX111111");

    await postMessage(ctx, session, "I forgot my password and can't log into my computer");
    const ticket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, ticket.reference);

    await postMessage(ctx, session, "still doesn't work");
    await waitForAgentReplyContaining(session.conversationId, "Step 2 of 2");

    await postMessage(ctx, session, "still doesn't work");
    const escalationMessage = await waitForAgentReplyContaining(session.conversationId, "bringing in a person");
    expect(escalationMessage.text).not.toMatch(/Step \d of \d/);

    const escalatedTicket = await Ticket.findById(ticket._id);
    expect(escalatedTicket?.escalated).toBe(true);
    expect(escalatedTicket?.escalationReason).toBe("guidance_exhausted");
    expect(escalatedTicket?.handlingMode).toBe("human_involved");

    const guidedSession = await GuidedSession.findOne({ conversationId: session.conversationId });
    expect(guidedSession?.state).toBe("escalated");
    expect(guidedSession?.stepAttempts).toHaveLength(2);
    expect(guidedSession?.stepAttempts.map((a) => a.stepIndex)).toEqual([0, 1]);
  });
});
