import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import { Guide } from "../../src/models/guide.js";

const MAINTAINER_KEY = "test-maintainer-key";
const ADMIN_HEADERS = { "x-maintainer-key": MAINTAINER_KEY, "x-maintainer-name": "Jordan Maintainer" };

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

async function getTicket(ctx: TestContext, sessionId: string, reference: string) {
  const res = await request(ctx.app).get(`/api/tickets/${reference}`).query({ sessionId });
  expect(res.status).toBe(200);
  return res.body.ticket;
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

describe("Guide version pinning across a mid-session publish (US4, FR-017/SC-008)", () => {
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

  it("VP-001: an in-flight session completes on its pinned version; a new session started after publish uses the new version", async () => {
    // Session A starts on printer guide v1.
    const sessionA = await startSession(ctx, "VP111111");
    await postMessage(ctx, sessionA, "the printer on the 3rd floor is jammed again");
    const ticketA = await waitForTicket(sessionA.conversationId);
    const stepA = await waitForAgentReplyContaining(sessionA.conversationId, ticketA.reference);
    expect(stepA.text).toMatch(/Step 1 of 1/);
    const originalStepText = (await Guide.findOne({ categoryName: "printer", active: true }))?.steps[0]?.instruction;
    expect(stepA.text).toContain(originalStepText);

    // Maintainer publishes v2 while session A is still active on v1.
    const publish = await request(ctx.app)
      .post("/api/admin/categories/printer/guide")
      .set(ADMIN_HEADERS)
      .send({ steps: [{ instruction: "PINNING_TEST_V2_STEP: try the newer fix instead.", successHint: "It prints." }] });
    expect(publish.status).toBe(201);
    expect(publish.body.version).toBe(2);

    // Session A resolves on the version it started with — never sees the v2 text.
    await postMessage(ctx, sessionA, "that worked");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const resolvedTicketA = await Ticket.findById(ticketA._id);
    expect(resolvedTicketA?.status).toBe("resolved");
    const detailA = await getTicket(ctx, sessionA.sessionId, ticketA.reference);
    expect(detailA.guidance.guideVersion).toBe(1);

    // Session B starts fresh after the publish and gets v2's step.
    const sessionB = await startSession(ctx, "VP222222");
    await postMessage(ctx, sessionB, "the printer on the 3rd floor is jammed again");
    const ticketB = await waitForTicket(sessionB.conversationId);
    const stepB = await waitForAgentReplyContaining(sessionB.conversationId, ticketB.reference);
    expect(stepB.text).toContain("PINNING_TEST_V2_STEP");

    const detailB = await getTicket(ctx, sessionB.sessionId, ticketB.reference);
    expect(detailB.guidance.guideVersion).toBe(2);
  });
});
