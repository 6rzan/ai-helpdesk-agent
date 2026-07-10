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

async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);
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

async function reportIssue(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const before = await Ticket.countDocuments({});
  await postMessage(ctx, session, text);
  await waitFor(async () => ((await Ticket.countDocuments({})) > before ? true : undefined));
  const ticket = await Ticket.findOne({ conversationId: session.conversationId }).sort({ createdAt: -1 });
  expect(ticket).not.toBeNull();
  return ticket!;
}

async function resolveTicket(ctx: TestContext, reference: string) {
  const first = await request(ctx.app)
    .patch(`/api/tickets/${reference}/state`)
    .send({ field: "status", to: "in_progress", actor: "staff" });
  expect(first.status).toBe(200);
  const second = await request(ctx.app)
    .patch(`/api/tickets/${reference}/state`)
    .send({ field: "status", to: "resolved", actor: "staff" });
  expect(second.status).toBe(200);
}

describe("Resolution confirmation flow (US2-AS4, FR-004)", () => {
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

  it("TC-034: marking a ticket resolved prompts the reporter, and a confirmation closes it", async () => {
    const session = await startSession(ctx, "TP610001");
    const ticket = await reportIssue(ctx, session, "I forgot my password and can't log into my computer");

    await resolveTicket(ctx, ticket.reference);

    const prompt = await waitFor(async () => {
      const replies = await Message.find({ conversationId: session.conversationId, author: "agent" }).sort({ sentAt: 1 });
      return replies.find((m) => m.text.includes(ticket.reference) && /working/i.test(m.text));
    });
    expect(prompt.text).toContain(ticket.reference);

    await postMessage(ctx, session, "Yes, it's working now — thanks!");

    const closed = await waitFor(async () => {
      const doc = await Ticket.findById(ticket._id);
      return doc?.status === "closed" ? doc : undefined;
    });
    const record = closed.history.find((h) => h.field === "status" && h.from === "resolved" && h.to === "closed");
    expect(record).toBeDefined();
    expect(record?.actor).toBe("user");

    const confirmation = await waitFor(async () => {
      const replies = await Message.find({ conversationId: session.conversationId, author: "agent" }).sort({ sentAt: 1 });
      return replies.find((m) => m.text.includes(ticket.reference) && /closed/i.test(m.text));
    });
    expect(confirmation).toBeDefined();
  });

  it("TC-035: replying that the problem persists reopens the ticket to in_progress", async () => {
    const session = await startSession(ctx, "TP620001");
    const ticket = await reportIssue(ctx, session, "the printer on the 3rd floor is jammed again");

    await resolveTicket(ctx, ticket.reference);

    await postMessage(ctx, session, "It's still not working, same problem as before.");

    const reopened = await waitFor(async () => {
      const doc = await Ticket.findById(ticket._id);
      return doc?.status === "in_progress" ? doc : undefined;
    });
    const record = reopened.history.find((h) => h.field === "status" && h.from === "resolved" && h.to === "in_progress");
    expect(record).toBeDefined();
    expect(record?.actor).toBe("user");
  });

  it("TC-036: no reply leaves the ticket Resolved", async () => {
    const session = await startSession(ctx, "TP630001");
    const ticket = await reportIssue(ctx, session, "my laptop is really slow and keeps freezing");

    await resolveTicket(ctx, ticket.reference);

    await new Promise((resolve) => setTimeout(resolve, 300));
    const doc = await Ticket.findById(ticket._id);
    expect(doc?.status).toBe("resolved");
  });
});
