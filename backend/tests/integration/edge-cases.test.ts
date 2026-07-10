import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}

// Sends a message and waits for the next agent reply that follows it (not just
// any reply — a prior turn may already have one queued).
async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const before = await Message.countDocuments({ conversationId: session.conversationId, author: "agent" });
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);

  return waitFor(async () => {
    const after = await Message.countDocuments({ conversationId: session.conversationId, author: "agent" });
    if (after <= before) return undefined;
    const reply = await Message.findOne({ conversationId: session.conversationId, author: "agent" }).sort({ sentAt: -1 });
    return reply ?? undefined;
  });
}

describe("Edge cases (spec Edge Cases, T040)", () => {
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

  it("TC-051: a message describing two problems is acknowledged one at a time and creates no ticket", async () => {
    const session = await startSession(ctx, "TP710001");
    const reply = await postMessage(ctx, session, "my password expired and also the printer is jammed");

    expect(reply.text.toLowerCase()).toContain("password");
    expect(reply.text.toLowerCase()).toContain("printer");
    expect(reply.text.toLowerCase()).toMatch(/one at a time|which/);

    const ticket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(ticket).toBeNull();
  });

  it("TC-052: a duplicate report in the same category surfaces the existing ticket instead of creating a new one", async () => {
    const session = await startSession(ctx, "TP720001");
    const firstReply = await postMessage(ctx, session, "the printer on the 3rd floor is jammed again");
    expect(firstReply.text).toMatch(/HD-\d{4}/);

    const prompt = await postMessage(ctx, session, "the printer is still jammed and now making noise");
    expect(prompt.text.toLowerCase()).toContain("same problem");

    const count = await Ticket.countDocuments({ conversationId: session.conversationId });
    expect(count).toBe(1);
  });

  it("TC-053: confirming a duplicate is the same problem leaves the existing ticket untouched", async () => {
    const session = await startSession(ctx, "TP730001");
    await postMessage(ctx, session, "the printer on the 3rd floor is jammed again");
    await postMessage(ctx, session, "the printer is still jammed and now making noise");

    const confirmation = await postMessage(ctx, session, "yes, same problem");
    expect(confirmation.text.toLowerCase()).toContain("no need to open a new one");

    const count = await Ticket.countDocuments({ conversationId: session.conversationId });
    expect(count).toBe(1);
  });

  it("TC-054: denying a duplicate is the same problem opens a second ticket", async () => {
    const session = await startSession(ctx, "TP740001");
    await postMessage(ctx, session, "the printer on the 3rd floor is jammed again");
    const firstTicket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(firstTicket).not.toBeNull();

    await postMessage(ctx, session, "the printer is still jammed and now making noise");
    const secondReply = await postMessage(ctx, session, "no, this is a different printer entirely");
    expect(secondReply.text).toMatch(/HD-\d{4}/);

    const tickets = await Ticket.find({ conversationId: session.conversationId }).sort({ createdAt: 1 });
    expect(tickets).toHaveLength(2);
    expect(tickets[1]?.reference).not.toBe(firstTicket!.reference);
    expect(tickets[1]?.category).toBe("printer");
  });

  it("TC-055: vowel-less gibberish input is treated as content-free and creates no ticket", async () => {
    const session = await startSession(ctx, "TP750001");
    const reply = await postMessage(ctx, session, "qwrtplkj");

    expect(reply.text.toLowerCase()).toMatch(/describe|catch a problem/);

    const ticket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(ticket).toBeNull();
  });

  it("TC-056: punctuation-only input is treated as content-free and creates no ticket", async () => {
    const session = await startSession(ctx, "TP760001");
    const reply = await postMessage(ctx, session, "??!!...");

    expect(reply.text.toLowerCase()).toMatch(/describe|catch a problem/);

    const ticket = await Ticket.findOne({ conversationId: session.conversationId });
    expect(ticket).toBeNull();
  });
});
