import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import type { IssueCategory } from "../../src/models/enums.js";

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

describe("Dynamic category addition classifies without a code change (US4, SC-007)", () => {
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

  it("DC-001: a category added via the admin API classifies a matching report and receives its own guide's step", async () => {
    const created = await request(ctx.app)
      .post("/api/admin/categories")
      .set(ADMIN_HEADERS)
      .send({
        name: "email_calendar",
        displayName: "Email & calendar",
        classificationDescription: "Problems sending/receiving email or using calendar invites",
        guide: {
          steps: [{ instruction: "Sign out and back in to the email client.", successHint: "Email sends and receives normally." }],
        },
      });
    expect(created.status).toBe(201);

    const session = await startSession(ctx, "DC111111");
    await postMessage(ctx, session, "I'm having an email_calendar problem, invites aren't arriving");

    const ticket = await waitForTicket(session.conversationId);
    expect(ticket.category).toBe("email_calendar");

    const step = await waitForAgentReplyContaining(session.conversationId, ticket.reference);
    expect(step.text).toContain("Sign out and back in to the email client.");
  });

  it("DC-002: the mandated-six classification regression still passes after a new category is added", async () => {
    await request(ctx.app)
      .post("/api/admin/categories")
      .set(ADMIN_HEADERS)
      .send({
        name: "email_calendar",
        displayName: "Email & calendar",
        classificationDescription: "Problems sending/receiving email or using calendar invites",
        guide: { steps: [{ instruction: "Sign out and back in to the email client.", successHint: "It works." }] },
      });

    const cases: [string, IssueCategory][] = [
      ["I forgot my password and can't log into my computer", "password_login"],
      ["my wifi keeps dropping and I can't reach the internet", "network"],
      ["the printer on the 3rd floor is jammed again", "printer"],
      ["my mouse and keyboard stopped responding", "peripherals"],
      ["my laptop is really slow and keeps freezing", "performance"],
      ["is there an outage affecting email right now?", "service_status"],
    ];

    for (const [text, expectedCategory] of cases) {
      const session = await startSession(ctx, `DC2${Math.floor(Math.random() * 90000 + 10000)}`);
      await postMessage(ctx, session, text);
      const ticket = await waitForTicket(session.conversationId);
      expect(ticket.category).toBe(expectedCategory);
    }
  });
});
