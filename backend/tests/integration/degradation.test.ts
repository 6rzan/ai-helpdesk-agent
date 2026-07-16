import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";

async function startSession(ctx: TestContext, orgId: string) {
  const res = await request(ctx.app)
    .post("/api/sessions")
    .send({ orgId, displayName: "Alex Chen" });
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

describe("LLM degradation handling", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
    resetSessionStore();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("TC-016: an unreachable LLM still produces a saved, human-flagged ticket with a quotable reference", async () => {
    vi.spyOn(ctx.llm, "classifyAndReply").mockResolvedValue({ ok: false, reason: "llm_unavailable" });

    const session = await startSession(ctx, "TP555555");
    await postMessage(ctx, session, "my screen is flickering and I don't know why");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("unclassified");
    expect(ticket.classificationConfidence).toBeNull();
    expect(ticket.handlingMode).toBe("human_involved");
    expect(ticket.escalated).toBe(true);
    expect(ticket.escalationReason).toBe("llm_unavailable");

    const replyStart = Date.now();
    while (Date.now() - replyStart < 2000) {
      if (await Message.exists({ conversationId: session.conversationId, author: "agent" })) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const agentReplies = await Message.find({
      conversationId: session.conversationId,
      author: "agent",
    }).sort({ sentAt: 1 });
    const confirmation = agentReplies.find((m) => m.text.includes(ticket.reference));
    expect(confirmation).toBeDefined();
    expect(confirmation?.text.toLowerCase()).toContain("trouble reaching the assistant");
  });

  it("TC-017: GET /api/health reports degraded (still HTTP 200) when the LLM is unreachable", async () => {
    vi.spyOn(ctx.llm, "health").mockResolvedValue(false);

    const res = await request(ctx.app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.llm.reachable).toBe(false);
    expect(res.body.db.reachable).toBe(true);
  });

  it("TC-018: GET /api/health reports degraded (still HTTP 200) when the LLM provider throws", async () => {
    vi.spyOn(ctx.llm, "health").mockRejectedValue(new Error("connection refused"));

    const res = await request(ctx.app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.llm.reachable).toBe(false);
  });
});
