import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import { Guide } from "../../src/models/guide.js";
import type { IssueCategory } from "../../src/models/enums.js";

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

async function setGuideStep(categoryName: string, uniqueMarker: string): Promise<void> {
  await Guide.findOneAndUpdate(
    { categoryName, active: true },
    { steps: [{ instruction: `${uniqueMarker}: follow the on-screen instructions.`, successHint: "The issue clears." }] },
  );
}

const CASES: [IssueCategory, string, string][] = [
  ["network", "my wifi keeps dropping and I can't reach the internet", "NETWORK_ONLY_STEP"],
  ["printer", "the printer on the 3rd floor is jammed again", "PRINTER_ONLY_STEP"],
  ["peripherals", "my mouse and keyboard stopped responding", "PERIPHERALS_ONLY_STEP"],
  ["performance", "my laptop is really slow and keeps freezing", "PERFORMANCE_ONLY_STEP"],
  ["service_status", "is there an outage affecting email right now?", "SERVICE_STATUS_ONLY_STEP"],
];

describe("Per-category guided flows (US3, SC-004)", () => {
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

  it.each(CASES)(
    "GC-001: a %s report receives only its own category's step, never another category's",
    async (category, text, marker) => {
      await setGuideStep(category, marker);
      const session = await startSession(ctx, `GC${Math.floor(Math.random() * 90000 + 10000)}`);
      await postMessage(ctx, session, text);

      const ticket = await waitForTicket(session.conversationId);
      expect(ticket.category).toBe(category);

      const stepMessage = await waitForAgentReplyContaining(session.conversationId, marker);
      expect(stepMessage.text).toMatch(/Step 1 of 1/);
      for (const [, , otherMarker] of CASES) {
        if (otherMarker !== marker) {
          expect(stepMessage.text).not.toContain(otherMarker);
        }
      }
    },
  );

  it("GC-002: a network report can end resolved", async () => {
    await setGuideStep("network", "NETWORK_RESOLVE_STEP");
    const session = await startSession(ctx, "GC900001");
    await postMessage(ctx, session, "my wifi keeps dropping and I can't reach the internet");
    const ticket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, "NETWORK_RESOLVE_STEP");

    await postMessage(ctx, session, "that worked");
    await new Promise((resolve) => setTimeout(resolve, 200));

    const resolved = await Ticket.findById(ticket._id);
    expect(resolved?.status).toBe("resolved");
  });

  it("GC-003: a printer report can end escalated after its single step doesn't help", async () => {
    await setGuideStep("printer", "PRINTER_ESCALATE_STEP");
    const session = await startSession(ctx, "GC900002");
    await postMessage(ctx, session, "the printer on the 3rd floor is jammed again");
    const ticket = await waitForTicket(session.conversationId);
    await waitForAgentReplyContaining(session.conversationId, "PRINTER_ESCALATE_STEP");

    await postMessage(ctx, session, "still doesn't work");
    await waitForAgentReplyContaining(session.conversationId, "bringing in a person");

    const escalated = await Ticket.findById(ticket._id);
    expect(escalated?.escalated).toBe(true);
    expect(escalated?.escalationReason).toBe("guidance_exhausted");
  });
});
