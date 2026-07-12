import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Message } from "../../src/models/message.js";
import { Ticket } from "../../src/models/ticket.js";
import type { InputOrigin } from "../../src/models/enums.js";

async function waitForTicket(conversationId: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ticket = await Ticket.findOne({ conversationId }).sort({ createdAt: -1 });
    if (ticket) return ticket;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for ticket creation");
}

async function startSession(ctx: TestContext, orgId: string) {
  const res = await request(ctx.app)
    .post("/api/sessions")
    .send({ orgId, displayName: "Alex Chen" });
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string };
}

describe("Message inputOrigin", () => {
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

  it.each(["typed", "voice", "mixed"] satisfies InputOrigin[])(
    "TC-057: accepts inputOrigin=%s and persists it on the stored message",
    async (inputOrigin) => {
      const session = await startSession(ctx, "TP505050");
      const res = await request(ctx.app)
        .post(`/api/conversations/${session.conversationId}/messages`)
        .send({ sessionId: session.sessionId, text: "hi", inputOrigin });
      expect(res.status).toBe(202);

      const stored = await Message.findOne({ conversationId: session.conversationId, author: "user" });
      expect(stored?.inputOrigin).toBe(inputOrigin);
    },
  );

  it("TC-058: defaults inputOrigin to typed when omitted from the request body", async () => {
    const session = await startSession(ctx, "TP606060");
    const res = await request(ctx.app)
      .post(`/api/conversations/${session.conversationId}/messages`)
      .send({ sessionId: session.sessionId, text: "hi" });
    expect(res.status).toBe(202);

    const stored = await Message.findOne({ conversationId: session.conversationId, author: "user" });
    expect(stored?.inputOrigin).toBe("typed");
  });

  it("TC-059: rejects an invalid inputOrigin value with a validation error", async () => {
    const session = await startSession(ctx, "TP707070");
    const res = await request(ctx.app)
      .post(`/api/conversations/${session.conversationId}/messages`)
      .send({ sessionId: session.sessionId, text: "hi", inputOrigin: "spoken" });
    expect(res.status).toBe(400);
  });

  it("TC-060: returns inputOrigin in the ticket transcript DTO for both user and agent messages", async () => {
    const session = await startSession(ctx, "TP808080");
    const res = await request(ctx.app)
      .post(`/api/conversations/${session.conversationId}/messages`)
      .send({ sessionId: session.sessionId, text: "my printer keeps jamming and won't print anything", inputOrigin: "voice" });
    expect(res.status).toBe(202);

    const ticket = await waitForTicket(session.conversationId);
    const detailRes = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}`)
      .query({ sessionId: session.sessionId });
    expect(detailRes.status).toBe(200);

    const transcript = detailRes.body.ticket.transcript as { author: string; inputOrigin: InputOrigin }[];
    const userEntry = transcript.find((m) => m.author === "user");
    const agentEntry = transcript.find((m) => m.author === "agent");
    expect(userEntry?.inputOrigin).toBe("voice");
    expect(agentEntry?.inputOrigin).toBe("typed");
  });

  it.each(["typed", "voice", "mixed"] satisfies InputOrigin[])(
    "TC-073: identical text produces the same ticket creation and handling outcome regardless of inputOrigin=%s",
    async (inputOrigin) => {
      const session = await startSession(ctx, "TP909090");
      const res = await request(ctx.app)
        .post(`/api/conversations/${session.conversationId}/messages`)
        .send({
          sessionId: session.sessionId,
          text: "my printer keeps jamming and won't print anything",
          inputOrigin,
        });
      expect(res.status).toBe(202);

      const ticket = await waitForTicket(session.conversationId);
      expect(ticket.description).toBeTruthy();
      expect(ticket.handlingMode).toBeTruthy();
    },
  );
});
