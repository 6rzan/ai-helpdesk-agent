import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { config, type AppMode } from "../../src/config/index.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { startTestApp, stopTestApp, resetDb, type TestContext } from "../helpers/test-app.js";
import { Ticket } from "../../src/models/ticket.js";

async function createTicketViaChat(ctx: TestContext) {
  const session = await request(ctx.app).post("/api/sessions").send({ orgId: "TP580001", displayName: "Alex Chen" });
  expect(session.status).toBe(201);
  const message = await request(ctx.app)
    .post(`/api/conversations/${session.body.conversationId}/messages`)
    .send({ sessionId: session.body.sessionId, text: "I forgot my password and can't log into my computer" });
  expect(message.status).toBe(202);

  const start = Date.now();
  while (Date.now() - start < 3000) {
    const ticket = await Ticket.findOne({ conversationId: session.body.conversationId });
    if (ticket) return ticket;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for ticket creation");
}

describe("Test-support endpoint guard", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterAll(async () => {
    await resetDb();
    resetSessionStore();
    await stopTestApp();
  });

  it("TC-033: PATCH /api/tickets/:reference/state is absent (404) when APP_MODE is not demo or test", async () => {
    const ticket = await createTicketViaChat(ctx);

    const enabled = await request(ctx.app)
      .patch(`/api/tickets/${ticket.reference}/state`)
      .send({ field: "status", to: "in_progress", actor: "staff" });
    expect(enabled.status).toBe(200);

    const mutableConfig = config as { APP_MODE: AppMode };
    const original = mutableConfig.APP_MODE;
    try {
      mutableConfig.APP_MODE = "development";
      const normalModeApp = createApp();
      const res = await request(normalModeApp)
        .patch(`/api/tickets/${ticket.reference}/state`)
        .send({ field: "status", to: "resolved", actor: "staff" });
      expect(res.status).toBe(404);
    } finally {
      mutableConfig.APP_MODE = original;
    }
  });
});
