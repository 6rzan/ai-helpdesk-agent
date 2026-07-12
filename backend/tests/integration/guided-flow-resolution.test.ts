import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import { Guide } from "../../src/models/guide.js";

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
      text: new RegExp(escapeRegex(substring)),
    }).sort({ sentAt: -1 });
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for agent reply containing "${substring}"`);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Overrides the 1-step test-seed guide with a 2-step guide so this suite can
// exercise a full advance -> resolve walk without depending on real seed content.
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

describe("Guided flow to resolution (US1)", () => {
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

  it("GF-001: classification + ticket + Step 1 land in one reply, then advance and resolve, recording both attempts", async () => {
    await seedTwoStepPasswordGuide();
    const session = await startSession(ctx, "GF111111");

    await postMessage(ctx, session, "I forgot my password and can't log into my computer");
    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("password_login");

    const step1Message = await waitForAgentReplyContaining(session.conversationId, ticket.reference);
    expect(step1Message.text).toMatch(/Step 1 of 2/);
    expect(step1Message.guidance).toMatchObject({ stepIndex: 0, stepCount: 2 });

    await postMessage(ctx, session, "didn't work");
    await waitForAgentReplyContaining(session.conversationId, "Step 2 of 2");

    await postMessage(ctx, session, "that worked");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const resolved = await Ticket.findById(ticket._id);
    expect(resolved?.status).toBe("resolved");

    const detail = await getTicket(ctx, session.sessionId, ticket.reference);
    expect(detail.guidance.state).toBe("resolved");
    expect(detail.guidance.stepAttempts).toHaveLength(1);
    expect(detail.guidance.stepAttempts[0]).toMatchObject({ stepIndex: 0, outcome: "not_worked" });
  });

  it("GF-002: re-reporting the same problem after resolution starts a fresh session on a new ticket, while the prior attempt record stays visible in history", async () => {
    await seedTwoStepPasswordGuide();
    const session = await startSession(ctx, "GF222222");

    await postMessage(ctx, session, "I forgot my password and can't log into my computer");
    const firstTicket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, firstTicket.reference);

    await postMessage(ctx, session, "didn't work");
    await waitForAgentReplyContaining(session.conversationId, "Step 2 of 2");
    await postMessage(ctx, session, "that worked");
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Reporting the same problem again is read as a possible duplicate of the
    // resolved-but-not-closed ticket; confirming it's new opens a fresh ticket.
    await postMessage(ctx, session, "I forgot my password and can't log into my computer");
    await waitForAgentReplyContaining(session.conversationId, "same problem, or something new");
    await postMessage(ctx, session, "it's a different problem this time");

    const secondTicket = await waitForTicket2(session.conversationId, firstTicket._id.toString());
    const secondStepMessage = await waitForAgentReplyContaining(session.conversationId, secondTicket.reference);
    expect(secondStepMessage.text).toMatch(/Step 1 of 2/);

    const priorDetail = await getTicket(ctx, session.sessionId, firstTicket.reference);
    expect(priorDetail.guidance.state).toBe("resolved");
    expect(priorDetail.guidance.stepAttempts).toHaveLength(1);
  });
});

async function waitForTicket2(conversationId: string, excludeId: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ticket = await Ticket.findOne({ conversationId, _id: { $ne: excludeId } }).sort({ createdAt: -1 });
    if (ticket) return ticket;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for second ticket creation");
}
