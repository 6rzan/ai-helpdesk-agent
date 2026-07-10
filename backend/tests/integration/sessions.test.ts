import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Reporter } from "../../src/models/reporter.js";
import { Ticket } from "../../src/models/ticket.js";
import { nextTicketReference } from "../../src/services/ticket/counter.js";

describe("POST /api/sessions", () => {
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

  it("TC-002: creates a session for a brand-new orgId", async () => {
    const res = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "TP001234", displayName: "Alex Chen" });

    expect(res.status).toBe(201);
    expect(typeof res.body.sessionId).toBe("string");
    expect(res.body.sessionId.length).toBeGreaterThan(0);
    expect(res.body.reporter).toEqual({ orgId: "TP001234", displayName: "Alex Chen" });
    expect(typeof res.body.conversationId).toBe("string");
    expect(res.body.openTickets).toEqual([]);
  });

  it("TC-003: resuming with the same orgId reuses the reporter and surfaces open tickets", async () => {
    const first = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "TP005678", displayName: "Jordan Lee" });
    expect(first.status).toBe(201);

    const reporter = await Reporter.findOne({ orgId: "TP005678" });
    expect(reporter).not.toBeNull();

    const reference = await nextTicketReference();
    await Ticket.create({
      reference,
      reporterId: reporter?._id,
      conversationId: first.body.conversationId,
      description: "Printer on 3rd floor is jammed",
      category: "printer",
      classificationConfidence: 0.9,
      status: "open",
      handlingMode: "automated",
      escalated: false,
    });

    const closedReference = await nextTicketReference();
    await Ticket.create({
      reference: closedReference,
      reporterId: reporter?._id,
      conversationId: first.body.conversationId,
      description: "Old resolved issue",
      category: "network",
      classificationConfidence: 0.9,
      status: "closed",
      handlingMode: "automated",
      escalated: false,
    });

    const second = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "TP005678", displayName: "Jordan Lee" });

    expect(second.status).toBe(201);
    expect(second.body.sessionId).not.toBe(first.body.sessionId);
    expect(second.body.conversationId).not.toBe(first.body.conversationId);
    expect(second.body.reporter).toEqual({ orgId: "TP005678", displayName: "Jordan Lee" });
    expect(second.body.openTickets).toHaveLength(1);
    expect(second.body.openTickets[0]).toMatchObject({
      reference,
      category: "printer",
      status: "open",
    });
  });

  it("TC-004: rejects an invalid orgId", async () => {
    const res = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "ab", displayName: "Alex Chen" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-005: rejects a missing displayName", async () => {
    const res = await request(ctx.app).post("/api/sessions").send({ orgId: "TP009999" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
