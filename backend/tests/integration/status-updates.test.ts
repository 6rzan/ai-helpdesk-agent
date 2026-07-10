import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { subscribe, type SseEvent } from "../../src/api/sse/event-bus.js";
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

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}

async function waitForTicket(conversationId: string) {
  return waitFor(async () => {
    const ticket = await Ticket.findOne({ conversationId }).sort({ createdAt: -1 });
    return ticket ?? undefined;
  });
}

async function reportIssue(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const before = await Ticket.countDocuments({});
  await postMessage(ctx, session, text);
  await waitFor(async () => ((await Ticket.countDocuments({})) > before ? true : undefined));
  return waitForTicket(session.conversationId);
}

function captureEvents(sessionId: string) {
  const events: SseEvent[] = [];
  const unsubscribe = subscribe(sessionId, undefined, (event) => events.push(event));
  return { events, unsubscribe };
}

async function patchState(
  ctx: TestContext,
  reference: string,
  body: { field: "status" | "handlingMode"; to: string; actor: "staff" | "system" },
) {
  return request(ctx.app).patch(`/api/tickets/${reference}/state`).send(body);
}

describe("Status visibility journey", () => {
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

  it("TC-026: GET /api/tickets returns every ticket for the session's reporter, any status, newest first (US2-AS1)", async () => {
    const session = await startSession(ctx, "TP510001");
    const first = await reportIssue(ctx, session, "I forgot my password and can't log into my computer");
    await new Promise((resolve) => setTimeout(resolve, 15));
    const second = await reportIssue(ctx, session, "the printer on the 3rd floor is jammed again");
    expect(second.reference).not.toBe(first.reference);

    const closeRes = await patchState(ctx, first.reference, { field: "status", to: "closed", actor: "staff" });
    expect(closeRes.status).toBe(200);

    const res = await request(ctx.app).get("/api/tickets").query({ sessionId: session.sessionId });
    expect(res.status).toBe(200);
    const tickets = res.body.tickets as Array<Record<string, unknown>>;
    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.reference)).toEqual([second.reference, first.reference]);
    expect(tickets[1]?.status).toBe("closed");
    for (const ticket of tickets) {
      expect(ticket).toMatchObject({
        reference: expect.any(String),
        category: expect.any(String),
        status: expect.any(String),
        handlingMode: expect.any(String),
        escalated: expect.any(Boolean),
        description: expect.any(String),
        createdAt: expect.any(String),
      });
    }

    const badSession = await request(ctx.app).get("/api/tickets").query({ sessionId: "not-a-session" });
    expect(badSession.status).toBe(403);
    expect(badSession.body.error.code).toBe("SESSION_INVALID");
  });

  it("TC-027: GET /api/tickets/:reference returns detail with history and transcript; 404 unknown; 403 other reporter (FR-007)", async () => {
    const session = await startSession(ctx, "TP520001");
    const ticket = await reportIssue(ctx, session, "I forgot my password and can't log into my computer");

    const moved = await patchState(ctx, ticket.reference, { field: "status", to: "in_progress", actor: "staff" });
    expect(moved.status).toBe(200);

    const res = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}`)
      .query({ sessionId: session.sessionId });
    expect(res.status).toBe(200);
    const detail = res.body.ticket as Record<string, unknown>;
    expect(detail.reference).toBe(ticket.reference);
    expect(detail.status).toBe("in_progress");
    expect(detail).toHaveProperty("classificationConfidence");
    expect(detail).toHaveProperty("escalationReason");

    const history = detail.history as Array<Record<string, unknown>>;
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.at(-1)).toMatchObject({
      field: "status",
      from: "open",
      to: "in_progress",
      actor: "staff",
    });

    const transcript = detail.transcript as Array<Record<string, unknown>>;
    expect(transcript.some((m) => m.author === "user")).toBe(true);
    expect(transcript.some((m) => m.author === "agent")).toBe(true);

    const unknown = await request(ctx.app)
      .get("/api/tickets/TKT-999999")
      .query({ sessionId: session.sessionId });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });

    const stranger = await startSession(ctx, "TP520002");
    const forbidden = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}`)
      .query({ sessionId: stranger.sessionId });
    expect(forbidden.status).toBe(403);
  });

  it("TC-028: a staff transition pushes a plain-language ticket_updated event within 2 seconds (SC-004, FR-010)", async () => {
    const session = await startSession(ctx, "TP530001");
    const ticket = await reportIssue(ctx, session, "my wifi keeps dropping and I can't reach the internet");

    const { events, unsubscribe } = captureEvents(session.sessionId);
    try {
      const patchedAt = Date.now();
      const res = await patchState(ctx, ticket.reference, { field: "status", to: "in_progress", actor: "staff" });
      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("in_progress");

      const update = await waitFor(async () => {
        return events.find((e) => e.name === "ticket_updated") ?? undefined;
      }, 2000);
      expect(Date.now() - patchedAt).toBeLessThanOrEqual(2000);

      const data = update.data as Record<string, unknown>;
      expect(data.reference).toBe(ticket.reference);
      expect(data.field).toBe("status");
      expect(data.from).toBe("open");
      expect(data.to).toBe("in_progress");
      expect(typeof data.plainText).toBe("string");
      const plainText = data.plainText as string;
      expect(plainText).toContain(ticket.reference);
      expect(plainText).not.toMatch(/in_progress/);
    } finally {
      unsubscribe();
    }
  });

  it("TC-029: asking about status in chat yields a per-ticket plain-language summary and no new ticket (US2-AS2)", async () => {
    const session = await startSession(ctx, "TP540001");
    const ticket = await reportIssue(ctx, session, "my laptop is really slow and keeps freezing");

    await postMessage(ctx, session, "What's the status of my tickets?");
    const summary = await waitFor(async () => {
      const replies = await Message.find({ conversationId: session.conversationId, author: "agent" }).sort({ sentAt: 1 });
      return replies.find((m) => m.text.includes(ticket.reference) && /open/i.test(m.text));
    });
    expect(summary.text).toContain(ticket.reference);

    const count = await Ticket.countDocuments({});
    expect(count).toBe(1);
  });

  it("TC-030: a new session with the same orgId sees earlier tickets (FR-008)", async () => {
    const first = await startSession(ctx, "TP550001");
    const ticket = await reportIssue(ctx, first, "is there an outage affecting email right now?");

    const second = await startSession(ctx, "TP550001");
    expect(second.sessionId).not.toBe(first.sessionId);

    const res = await request(ctx.app).get("/api/tickets").query({ sessionId: second.sessionId });
    expect(res.status).toBe(200);
    const tickets = res.body.tickets as Array<Record<string, unknown>>;
    expect(tickets.map((t) => t.reference)).toContain(ticket.reference);

    const detail = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}`)
      .query({ sessionId: second.sessionId });
    expect(detail.status).toBe(200);
  });

  it("TC-031: a waiting_on_user ticket returns to automated handling when the user replies (US2-AS3)", async () => {
    const session = await startSession(ctx, "TP560001");
    const ticket = await reportIssue(ctx, session, "my mouse and keyboard stopped responding");

    const res = await patchState(ctx, ticket.reference, { field: "handlingMode", to: "waiting_on_user", actor: "staff" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.handlingMode).toBe("waiting_on_user");

    await postMessage(ctx, session, "I tried a different USB port and they are still dead.");

    const resumed = await waitFor(async () => {
      const doc = await Ticket.findById(ticket._id);
      return doc?.handlingMode === "automated" ? doc : undefined;
    });
    expect(resumed.handlingMode).toBe("automated");
    const record = resumed.history.find((h) => h.field === "handlingMode" && h.from === "waiting_on_user" && h.to === "automated");
    expect(record).toBeDefined();
    expect(record?.actor).toBe("user");
  });

  it("TC-032: a transition rejected by the state machine returns 409 INVALID_TRANSITION and leaves the ticket unchanged", async () => {
    const session = await startSession(ctx, "TP570001");
    const ticket = await reportIssue(ctx, session, "I forgot my password and can't log into my computer");

    const res = await patchState(ctx, ticket.reference, { field: "status", to: "resolved", actor: "staff" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");

    const unchanged = await Ticket.findById(ticket._id);
    expect(unchanged?.status).toBe("open");
    expect(unchanged?.history).toHaveLength(0);
  });
});
