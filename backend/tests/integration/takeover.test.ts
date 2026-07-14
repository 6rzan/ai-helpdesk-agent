import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { subscribe, type SseEvent } from "../../src/api/sse/event-bus.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { createTicketFixture } from "../helpers/factories.js";
import { Reporter } from "../../src/models/reporter.js";
import { Ticket } from "../../src/models/ticket.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";

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

describe("TC-US2 takeover and assignment", () => {
  it("TC-US2-01: takeover assigns the ticket to the caller, moves it to human handling and attributes the action", async () => {
    const staff = await seedStaff({ displayName: "Sam Support" });
    const { reference, ticket } = await createTicketFixture({ status: "open", handlingMode: "automated" });

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/takeover`)
      .set("Cookie", staff.cookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.ticket.handlingMode).toBe("human_involved");
    expect(res.body.ticket.assignee.displayName).toBe("Sam Support");
    expect(res.body.ticket.assignmentHistory).toHaveLength(1);
    expect(res.body.ticket.assignmentHistory[0]).toMatchObject({ kind: "takeover", assigneeName: "Sam Support" });

    const record = await StaffActionRecord.findOne({ targetId: ticket._id, action: "takeover" });
    expect(record).toBeTruthy();
    expect(record!.staffName).toBe("Sam Support");
  });

  it("TC-US2-02: takeover notifies the reporter with the named handler (FR-020)", async () => {
    const staff = await seedStaff({ displayName: "Nadia Ng" });

    const sessionRes = await request(ctx.app)
      .post("/api/sessions")
      .send({ orgId: "TP920002", displayName: "Reporter Rae" });
    expect(sessionRes.status).toBe(201);
    const chatSessionId = sessionRes.body.sessionId as string;
    const conversationId = sessionRes.body.conversationId as string;
    const reporter = await Reporter.findOne({ orgId: "TP920002" });

    const created = await Ticket.create({
      reference: "TKT-920002",
      reporterId: reporter!._id,
      conversationId,
      description: "vpn keeps dropping",
      category: "network",
      classificationConfidence: 0.8,
      status: "in_progress",
      handlingMode: "automated",
      escalated: false,
    });

    const events: SseEvent[] = [];
    const unsubscribe = subscribe(chatSessionId, undefined, (event) => events.push(event));
    try {
      const res = await request(ctx.app)
        .post(`/api/staff/tickets/${created.reference}/takeover`)
        .set("Cookie", staff.cookie)
        .send();
      expect(res.status).toBe(200);

      const update = await waitFor(() =>
        events.find((e) => e.name === "ticket_updated" && String((e.data as Record<string, unknown>).plainText).includes("Nadia Ng")),
      );
      expect(String((update.data as Record<string, unknown>).plainText)).toContain("Nadia Ng");
    } finally {
      unsubscribe();
    }
  });

  it("TC-US2-03: a concurrent takeover of an already-assigned ticket is refused with 409 and the current assignee (US2-5)", async () => {
    const staffA = await seedStaff({ displayName: "First Responder" });
    const staffB = await seedStaff({ displayName: "Second Responder" });
    const { reference } = await createTicketFixture({ status: "open", handlingMode: "automated" });

    const [resA, resB] = await Promise.all([
      request(ctx.app).post(`/api/staff/tickets/${reference}/takeover`).set("Cookie", staffA.cookie).send(),
      request(ctx.app).post(`/api/staff/tickets/${reference}/takeover`).set("Cookie", staffB.cookie).send(),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? resA : resB;
    const loser = resA.status === 409 ? resA : resB;
    expect(loser.body.currentAssignee.displayName).toBe(winner.body.ticket.assignee.displayName);
  });

  it("TC-US2-04: reassignment appends history and updates the assignee without handing back to the agent (FR-019)", async () => {
    const staffA = await seedStaff({ displayName: "Owner One" });
    const staffB = await seedStaff({ displayName: "Owner Two" });
    const { reference } = await createTicketFixture({ status: "open", handlingMode: "automated" });

    await request(ctx.app).post(`/api/staff/tickets/${reference}/takeover`).set("Cookie", staffA.cookie).send();

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/assignee`)
      .set("Cookie", staffA.cookie)
      .send({ toAccountId: String(staffB.account._id) });

    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee.displayName).toBe("Owner Two");
    expect(res.body.ticket.handlingMode).toBe("human_involved");
    expect(res.body.ticket.assignmentHistory).toHaveLength(2);
    expect(res.body.ticket.assignmentHistory[1]).toMatchObject({ kind: "reassign", assigneeName: "Owner Two" });
  });

  it("TC-US2-05: reassignment refuses a non-staff target (never back to a user or the agent)", async () => {
    const staff = await seedStaff();
    const user = await seedUser();
    const { reference } = await createTicketFixture({ status: "open", handlingMode: "automated" });

    await request(ctx.app).post(`/api/staff/tickets/${reference}/takeover`).set("Cookie", staff.cookie).send();

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/assignee`)
      .set("Cookie", staff.cookie)
      .send({ toAccountId: String(user.account._id) });

    expect(res.status).toBe(422);
  });

  it("TC-US2-06: the roster reports availability, open-case counts and an advisory suggested assignee (FR-021)", async () => {
    const busy = await seedStaff({ displayName: "Busy Bee", availability: "available" });
    const free = await seedStaff({ displayName: "Free Bird", availability: "available" });
    const { reference } = await createTicketFixture({ status: "open", handlingMode: "automated" });

    // Give "Busy Bee" an open case so the suggestion should favour the one with fewer.
    await request(ctx.app).post(`/api/staff/tickets/${reference}/takeover`).set("Cookie", busy.cookie).send();

    const res = await request(ctx.app).get("/api/staff/roster").set("Cookie", free.cookie);
    expect(res.status).toBe(200);

    const busyRow = res.body.staff.find((s: { displayName: string }) => s.displayName === "Busy Bee");
    const freeRow = res.body.staff.find((s: { displayName: string }) => s.displayName === "Free Bird");
    expect(busyRow.openCaseCount).toBe(1);
    expect(freeRow.openCaseCount).toBe(0);
    expect(busyRow.availability).toBe("available");
    expect(res.body.suggestedAssigneeId).toBe(String(free.account._id));
  });

  it("TC-US2-07: a staff member can update their own availability", async () => {
    const staff = await seedStaff({ availability: "available" });

    const res = await request(ctx.app)
      .put("/api/staff/availability")
      .set("Cookie", staff.cookie)
      .send({ availability: "busy" });

    expect(res.status).toBe(200);

    const me = await request(ctx.app).get("/api/auth/me").set("Cookie", staff.cookie);
    expect(me.body.availability).toBe("busy");
  });
});
