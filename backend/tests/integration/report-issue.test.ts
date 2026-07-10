import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import type { IssueCategory } from "../../src/models/enums.js";

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

describe("Report issue journey", () => {
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

  it("TC-012: classified report produces a plain-language confirmation carrying a quotable ticket reference (US1-AS1)", async () => {
    const session = await startSession(ctx, "TP111111");
    await postMessage(ctx, session, "I forgot my password and can't log into my computer");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("password_login");

    const agentReplies = await Message.find({
      conversationId: session.conversationId,
      author: "agent",
    }).sort({ sentAt: 1 });
    const confirmation = agentReplies.find((m) => m.text.includes(ticket.reference));
    expect(confirmation).toBeDefined();
    expect(confirmation?.text.toLowerCase()).toContain("password login");
  });

  it("TC-013: a classified ticket records timestamp, category, description, and reporter identity (US1-AS2)", async () => {
    const session = await startSession(ctx, "TP222222");
    await postMessage(ctx, session, "my printer keeps jamming and won't print anything");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("printer");
    expect(ticket.description).toBe("my printer keeps jamming and won't print anything");
    expect(ticket.reporterId).toBeDefined();
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    ["I forgot my password and can't log into my computer", "password_login"],
    ["my wifi keeps dropping and I can't reach the internet", "network"],
    ["the printer on the 3rd floor is jammed again", "printer"],
    ["my mouse and keyboard stopped responding", "peripherals"],
    ["my laptop is really slow and keeps freezing", "performance"],
    ["is there an outage affecting email right now?", "service_status"],
  ] satisfies [string, IssueCategory][])(
    "TC-014: %s classifies into %s (US1-AS3)",
    async (text, expectedCategory) => {
      const session = await startSession(ctx, `TP3${Math.floor(Math.random() * 90000 + 10000)}`);
      await postMessage(ctx, session, text);

      const ticket = await waitForTicket(session.conversationId);
      expect(ticket.category).toBe(expectedCategory);
      expect(ticket.status).toBe("open");
      expect(ticket.handlingMode).toBe("automated");
      expect(ticket.escalated).toBe(false);
    },
  );

  it("TC-015: a bare greeting gets a conversational reply and creates no ticket (US1-AS4)", async () => {
    const session = await startSession(ctx, "TP444444");
    await postMessage(ctx, session, "hi");

    await new Promise((resolve) => setTimeout(resolve, 200));
    const ticket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(ticket).toBeNull();

    const agentReply = await Message.findOne({ conversationId: session.conversationId, author: "agent" });
    expect(agentReply).not.toBeNull();
    expect(agentReply?.text.toLowerCase()).toMatch(/help|issue|problem/);
  });
});
