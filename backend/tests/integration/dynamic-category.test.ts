import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { Ticket } from "../../src/models/ticket.js";
import { Message } from "../../src/models/message.js";
import type { IssueCategory } from "../../src/models/enums.js";
import { MANDATED_CATEGORIES } from "../../src/models/enums.js";

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
      .post("/api/maintainer/categories")
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
      .post("/api/maintainer/categories")
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

  // T015 (007), SC-007. The automated counterpart to manual quickstart Scenario 9, and
  // the guard plan.md names under Principle VIII.
  //
  // The console can create, rename, retire, and republish categories, and a category's
  // classificationDescription is what classification reads. That makes "an operator used
  // the console" a genuine way for the six mandated categories to stop working, rather
  // than a theoretical one — so this exercises a full console operation sequence and
  // then checks the six are still present, still unretired, and still classify their own
  // reports. Checking presence alone would pass even if classification had broken.
  it("DC-SC007: the six mandated categories survive a full console operation sequence", async () => {
    const created = await request(ctx.app)
      .post("/api/maintainer/categories")
      .set(ADMIN_HEADERS)
      .send({
        name: "console_survival_target",
        displayName: "Console survival target",
        classificationDescription:
          "A category created by this test purely so the console has something to operate on",
        guide: {
          steps: [
            {
              instruction: "Perform the first survival-target step exactly as written here.",
              successHint: "The step completes without error.",
            },
          ],
        },
      });
    expect(created.status).toBe(201);

    const renamed = await request(ctx.app)
      .put("/api/maintainer/categories/console_survival_target")
      .set(ADMIN_HEADERS)
      .send({ displayName: "Console survival target (renamed)" });
    expect(renamed.status).toBe(200);

    for (const note of ["second version", "third version"]) {
      const published = await request(ctx.app)
        .post("/api/maintainer/categories/console_survival_target/guide")
        .set(ADMIN_HEADERS)
        .send({
          steps: [
            {
              instruction: `Perform the ${note} step of the survival target guide.`,
              successHint: "The step completes without error.",
            },
          ],
          changeNote: note,
        });
      expect(published.status).toBe(201);
    }

    const retired = await request(ctx.app)
      .delete("/api/maintainer/categories/console_survival_target")
      .set(ADMIN_HEADERS);
    expect(retired.status).toBe(200);

    // Every mandated category is attacked directly, not just one: FR-012 is a claim
    // about all six, and a guard that held for `printer` alone would still be a hole.
    for (const name of MANDATED_CATEGORIES) {
      const refusal = await request(ctx.app)
        .delete(`/api/maintainer/categories/${name}`)
        .set(ADMIN_HEADERS);
      expect(refusal.status).toBe(403);
      expect(refusal.body.error.code).toBe("MANDATED_CATEGORY_UNDELETABLE");
    }

    const list = await request(ctx.app).get("/api/maintainer/categories").set(ADMIN_HEADERS);
    expect(list.status).toBe(200);
    const byName = new Map<string, { mandated: boolean; retired: boolean; activeGuideVersion: number | null }>(
      (list.body.categories as { name: string; mandated: boolean; retired: boolean; activeGuideVersion: number | null }[]).map(
        (c) => [c.name, c],
      ),
    );

    for (const name of MANDATED_CATEGORIES) {
      const category = byName.get(name);
      expect(category, `mandated category ${name} is missing after console operations`).toBeDefined();
      expect(category!.mandated).toBe(true);
      expect(category!.retired).toBe(false);
      // Still serving a guide: a mandated category present but guide-less would leave
      // guided troubleshooting escalating immediately for that whole family.
      expect(category!.activeGuideVersion).not.toBeNull();
    }

    // And still classifying. This is the half that presence checks cannot cover.
    const cases: [string, IssueCategory][] = [
      ["I forgot my password and can't log into my computer", "password_login"],
      ["my wifi keeps dropping and I can't reach the internet", "network"],
      ["the printer on the 3rd floor is jammed again", "printer"],
      ["my mouse and keyboard stopped responding", "peripherals"],
      ["my laptop is really slow and keeps freezing", "performance"],
      ["is there an outage affecting email right now?", "service_status"],
    ];
    for (const [text, expectedCategory] of cases) {
      const session = await startSession(ctx, `SV${Math.floor(Math.random() * 90000 + 10000)}`);
      await postMessage(ctx, session, text);
      const ticket = await waitForTicket(session.conversationId);
      expect(ticket.category).toBe(expectedCategory);
    }
  });
});
