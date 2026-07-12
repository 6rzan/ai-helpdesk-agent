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

describe("Missing/invalid-guide and low-confidence guards (US3, FR-012)", () => {
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

  it("GG-001: a classified category with no active guide escalates immediately and never presents a step", async () => {
    await Guide.findOneAndUpdate({ categoryName: "peripherals", active: true }, { active: false });

    const session = await startSession(ctx, "GG111111");
    await postMessage(ctx, session, "my mouse and keyboard stopped responding");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("peripherals");

    const reply = await waitForAgentReplyContaining(session.conversationId, "bringing in a person");
    expect(reply.text).not.toMatch(/Step \d of \d/);

    const escalated = await Ticket.findById(ticket._id);
    expect(escalated?.escalated).toBe(true);
    expect(escalated?.escalationReason).toBe("no_guide");
  });

  it("GG-002: a vague, low-confidence report is asked for clarification and never presents guide steps from any category", async () => {
    const session = await startSession(ctx, "GG222222");
    await postMessage(ctx, session, "my computer is acting weird");

    await new Promise((resolve) => setTimeout(resolve, 200));
    const ticket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(ticket).toBeNull();

    const reply = await Message.findOne({ conversationId: session.conversationId, author: "agent" });
    expect(reply).not.toBeNull();
    expect(reply?.text).not.toMatch(/Step \d of \d/);
  });
});
