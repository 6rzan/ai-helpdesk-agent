import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { subscribe, subscribeStaff, type SseEvent } from "../../src/api/sse/event-bus.js";
import { seedStaff } from "../helpers/auth.js";
import { createTicketFixture } from "../helpers/factories.js";
import { Reporter } from "../../src/models/reporter.js";
import { Ticket } from "../../src/models/ticket.js";

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

async function waitFor<T>(probe: () => T | undefined, timeoutMs = 2000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for event");
}

describe("TC-US1 live propagation", () => {
  it("TC-US1-09: the staff stream receives a ticket_updated event on a staff status change", async () => {
    const staff = await seedStaff();
    const { reference } = await createTicketFixture({ status: "open" });

    const events: SseEvent[] = [];
    const unsubscribe = subscribeStaff((event) => events.push(event));
    try {
      const res = await request(ctx.app)
        .post(`/api/staff/tickets/${reference}/status`)
        .set("Cookie", staff.cookie)
        .send({ status: "in_progress" });
      expect(res.status).toBe(200);

      const update = await waitFor(() => events.find((e) => e.name === "ticket_updated"));
      const data = update.data as Record<string, unknown>;
      expect(data.reference).toBe(reference);
    } finally {
      unsubscribe();
    }
  });

  it("TC-US1-10: the reporter's chat receives a plain-language status message when staff resolve their ticket (FR-009)", async () => {
    const staff = await seedStaff();

    // A real chat session so the reporter has an active SSE channel to notify.
    const sessionRes = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "TP900001", displayName: "Reporter Rae" });
    expect(sessionRes.status).toBe(201);
    const chatSessionId = sessionRes.body.sessionId as string;
    const conversationId = sessionRes.body.conversationId as string;
    const reporter = await Reporter.findOne({ orgId: "TP900001" });

    // A ticket owned by the chat reporter/conversation directly, so a staff resolve
    // reaches the reporter's active SSE channel.
    const created = await Ticket.create({
      reference: "TKT-900001",
      reporterId: reporter!._id,
      conversationId,
      description: "printer offline",
      category: "printer",
      classificationConfidence: 0.8,
      status: "in_progress",
      handlingMode: "automated",
      escalated: false,
    });
    const reference = created.reference;

    const events: SseEvent[] = [];
    const unsubscribe = subscribe(chatSessionId, undefined, (event) => events.push(event));
    try {
      const res = await request(ctx.app)
        .post(`/api/staff/tickets/${reference}/status`)
        .set("Cookie", staff.cookie)
        .send({ status: "resolved" });
      expect(res.status).toBe(200);

      const update = await waitFor(() => events.find((e) => e.name === "ticket_updated"));
      const data = update.data as Record<string, unknown>;
      expect(String(data.plainText)).toContain(reference);
      expect(String(data.plainText)).not.toMatch(/resolved_|in_progress/);
    } finally {
      unsubscribe();
    }
  });
});
