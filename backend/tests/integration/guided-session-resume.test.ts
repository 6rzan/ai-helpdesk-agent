import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { connectDb, disconnectDb } from "../../src/lib/db.js";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import { Guide } from "../../src/models/guide.js";
import { GuidedSession } from "../../src/models/guided-session.js";

async function startSession(app: Express, orgId: string) {
  const res = await request(app).post("/api/sessions").send({ orgId, displayName: "Alex Chen" });
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string };
}

async function postMessage(app: Express, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(app)
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

describe("Guided session resumes after restart (US1, FR-011/SC-006)", () => {
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

  it("GR-001: currentStepIndex and guide content are read fresh from MongoDB after the DB connection cycles, not held in server memory", async () => {
    await seedTwoStepPasswordGuide();
    const session = await startSession(ctx.app, "GR111111");

    await postMessage(ctx.app, session, "I forgot my password and can't log into my computer");
    const ticket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, ticket.reference);

    await postMessage(ctx.app, session, "didn't work");
    await waitForAgentReplyContaining(session.conversationId, "Step 2 of 2");

    const persisted = await GuidedSession.findOne({ conversationId: session.conversationId });
    expect(persisted?.currentStepIndex).toBe(1);
    expect(persisted?.state).toBe("active");

    // Simulate a service restart: drop and re-establish the MongoDB connection,
    // then build a brand new Express app instance (no shared in-memory closures
    // with the one that handled the messages above).
    await disconnectDb();
    await connectDb(ctx.mongoUri);
    const restartedApp = createApp();

    await postMessage(restartedApp, session, "that worked");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const resolvedTicket = await Ticket.findById(ticket._id);
    expect(resolvedTicket?.status).toBe("resolved");

    const resolvedSession = await GuidedSession.findOne({ conversationId: session.conversationId });
    expect(resolvedSession?.state).toBe("resolved");
    expect(resolvedSession?.currentStepIndex).toBe(1);
    expect(resolvedSession?.stepAttempts).toHaveLength(1);
    expect(resolvedSession?.stepAttempts[0]?.stepIndex).toBe(0);
  });
});
