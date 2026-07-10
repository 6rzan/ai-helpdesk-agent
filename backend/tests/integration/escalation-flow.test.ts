import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";

const VAGUE_TEXT = "something is wrong with my thing, it just is not right";

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
}

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value !== undefined && value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}

async function waitForTicket(conversationId: string) {
  await waitFor(async () => ((await Ticket.countDocuments({ conversationId })) > 0 ? true : undefined));
  const ticket = await Ticket.findOne({ conversationId });
  expect(ticket).not.toBeNull();
  return ticket!;
}

async function waitForAgentReplies(conversationId: string, count: number) {
  return waitFor(async () => {
    const replies = await Message.find({ conversationId, author: "agent" }).sort({ sentAt: 1 });
    return replies.length >= count ? replies : undefined;
  });
}

describe("Clarification and escalation journeys (US3)", () => {
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

  it("TC-044: an ambiguous report gets a clarifying question and no ticket (US3-AS1)", async () => {
    const session = await startSession(ctx, "TP710001");
    await postMessage(ctx, session, VAGUE_TEXT);

    const replies = await waitForAgentReplies(session.conversationId, 1);
    expect(replies[0]?.text).toMatch(/\?/);

    const count = await Ticket.countDocuments({});
    expect(count).toBe(0);
  });

  it("TC-045: still unclear after the clarification rounds are exhausted → unclassified escalated ticket (US3-AS2)", async () => {
    const session = await startSession(ctx, "TP720001");

    await postMessage(ctx, session, VAGUE_TEXT);
    await waitForAgentReplies(session.conversationId, 1);
    await postMessage(ctx, session, "it really just does something odd sometimes");
    await waitForAgentReplies(session.conversationId, 2);
    expect(await Ticket.countDocuments({})).toBe(0);

    await postMessage(ctx, session, "honestly hard to describe, everything feels weird");
    const ticket = await waitForTicket(session.conversationId);

    expect(ticket.category).toBe("unclassified");
    expect(ticket.escalated).toBe(true);
    expect(ticket.handlingMode).toBe("human_involved");
    expect(ticket.escalationReason).toBe("low_confidence");
  });

  it("TC-046: an explicit human request escalates immediately with an acknowledgement (US3-AS3)", async () => {
    const session = await startSession(ctx, "TP730001");
    await postMessage(ctx, session, "can I just talk to IT staff about this?");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.escalated).toBe(true);
    expect(ticket.handlingMode).toBe("human_involved");
    expect(ticket.escalationReason).toBe("user_request");

    const replies = await waitForAgentReplies(session.conversationId, 1);
    expect(replies.some((m) => /escalat|staff|human|person/i.test(m.text))).toBe(true);
  });

  it("TC-047: an escalated ticket carries the full transcript so nothing is re-asked (US3-AS4, FR-007)", async () => {
    const session = await startSession(ctx, "TP740001");

    const userMessages = [
      VAGUE_TEXT,
      "it really just does something odd sometimes",
      "honestly hard to describe, everything feels weird",
    ];
    for (const [i, text] of userMessages.entries()) {
      await postMessage(ctx, session, text);
      await waitForAgentReplies(session.conversationId, i + 1);
    }

    const ticket = await waitForTicket(session.conversationId);

    const res = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}`)
      .query({ sessionId: session.sessionId });
    expect(res.status).toBe(200);
    const detail = res.body.ticket as Record<string, unknown>;

    expect(detail.escalationReason).toBe("low_confidence");
    expect(detail).toHaveProperty("classificationConfidence");

    const transcript = detail.transcript as Array<{ author: string; text: string }>;
    for (const text of userMessages) {
      expect(transcript.some((m) => m.author === "user" && m.text === text)).toBe(true);
    }
    // The agent's clarifying questions are part of the handover context too.
    expect(transcript.filter((m) => m.author === "agent").length).toBeGreaterThanOrEqual(2);
  });
});
