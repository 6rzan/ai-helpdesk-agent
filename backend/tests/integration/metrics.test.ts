import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createTicketFixture, createActionRecordFixture } from "../helpers/factories.js";
import { Ticket } from "../../src/models/ticket.js";
import { ProviderFallbackEvent } from "../../src/models/provider-fallback-event.js";

// T099/T100/research.md R8: every figure must match an independently counted
// expectation exactly (SC-009) -- no cache, no approximation.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestApp();
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await stopTestApp();
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function backdateTicket(ticketId: Types.ObjectId, createdAt: Date) {
  await Ticket.collection.updateOne({ _id: ticketId }, { $set: { createdAt } });
}

async function resolveTicket(ticketId: Types.ObjectId, resolvedAt: Date, opts: { humanInvolved?: boolean } = {}) {
  const history: Record<string, unknown>[] = [];
  if (opts.humanInvolved) {
    history.push({ field: "handlingMode", from: "automated", to: "human_involved", actor: "staff", at: resolvedAt });
  }
  history.push({ field: "status", from: "in_progress", to: "resolved", actor: "agent", at: resolvedAt });
  await Ticket.collection.updateOne(
    { _id: ticketId },
    { $set: { status: "resolved" }, $push: { history: { $each: history } } } as Record<string, unknown>,
  );
}

describe("GET /staff/metrics", () => {
  it("TC-US5-01: computes category/status splits, resolved-without-human, escalation rate, action outcomes, and median resolution time exactly for a known mix (SC-009)", async () => {
    const staff = await seedStaff();
    const now = new Date();

    // Ticket A: network, resolves without human involvement in 60 minutes.
    const a = await createTicketFixture({ category: "network", status: "in_progress", escalated: false });
    await backdateTicket(a.ticket._id, now);
    await resolveTicket(a.ticket._id, new Date(now.getTime() + 60 * 60_000));

    // Ticket B: printer, escalated, resolves in 120 minutes (still counted in
    // splits and resolution time, but excluded from resolvedWithoutHuman).
    const b = await createTicketFixture({ category: "printer", status: "in_progress", escalated: true });
    await backdateTicket(b.ticket._id, now);
    await resolveTicket(b.ticket._id, new Date(now.getTime() + 120 * 60_000));

    // Ticket C: network, still open.
    await createTicketFixture({ category: "network", status: "open", escalated: false });

    // Ticket D: service_status, resolved but went through a human -- excluded
    // from resolvedWithoutHuman despite escalated === false, resolves in 30 min.
    const d = await createTicketFixture({ category: "service_status", status: "in_progress", escalated: false });
    await backdateTicket(d.ticket._id, now);
    await resolveTicket(d.ticket._id, new Date(now.getTime() + 30 * 60_000), { humanInvolved: true });

    await createActionRecordFixture({ ticketId: a.ticket._id, outcome: "succeeded" });
    await createActionRecordFixture({ ticketId: a.ticket._id, outcome: "succeeded" });
    await createActionRecordFixture({ ticketId: b.ticket._id, outcome: "refused", refusalReason: "missing_consent" });
    await createActionRecordFixture({ ticketId: d.ticket._id, outcome: "failed" });

    await ProviderFallbackEvent.create({ at: now, fromProvider: "primary", toProvider: "secondary" });

    const res = await request(ctx.app).get("/api/staff/metrics?period=90d").set("Cookie", staff.cookie);

    expect(res.status).toBe(200);
    expect(res.body.hasData).toBe(true);
    expect(res.body.ticketVolume).toBe(4);
    expect(res.body.categorySplit).toEqual(
      expect.arrayContaining([
        { key: "network", count: 2 },
        { key: "printer", count: 1 },
        { key: "service_status", count: 1 },
      ]),
    );
    expect(res.body.statusSplit).toEqual(
      expect.arrayContaining([
        { key: "resolved", count: 3 },
        { key: "open", count: 1 },
      ]),
    );
    expect(res.body.resolvedWithoutHuman).toEqual({ count: 1, proportion: 0.25 });
    expect(res.body.escalationRate).toBe(0.25);
    expect(res.body.actionOutcomes).toEqual(
      expect.arrayContaining([
        { key: "succeeded", count: 2 },
        { key: "refused", count: 1 },
        { key: "failed", count: 1 },
      ]),
    );
    expect(res.body.timeToResolution.medianMinutes).toBe(60);
    expect(res.body.providerFallbacks).toBe(1);
  });

  it.each(["7d", "30d", "90d", "all"] as const)(
    "TC-US5-02: scopes ticket volume to the %s period boundary exactly",
    async (preset) => {
      const staff = await seedStaff();
      const now = new Date();

      const recent = await createTicketFixture({});
      await backdateTicket(recent.ticket._id, new Date(now.getTime() - 3 * 60 * 60_000)); // 3 hours ago

      const eightDays = await createTicketFixture({});
      await backdateTicket(eightDays.ticket._id, new Date(now.getTime() - 8 * DAY_MS));

      const thirtyFiveDays = await createTicketFixture({});
      await backdateTicket(thirtyFiveDays.ticket._id, new Date(now.getTime() - 35 * DAY_MS));

      const ninetyFiveDays = await createTicketFixture({});
      await backdateTicket(ninetyFiveDays.ticket._id, new Date(now.getTime() - 95 * DAY_MS));

      const expected: Record<typeof preset, number> = { "7d": 1, "30d": 2, "90d": 3, all: 4 };

      const res = await request(ctx.app).get(`/api/staff/metrics?period=${preset}`).set("Cookie", staff.cookie);
      expect(res.status).toBe(200);
      expect(res.body.ticketVolume).toBe(expected[preset]);
    },
  );

  it("TC-US5-03: an empty period returns hasData false with empty groupings, not a zero-filled shape", async () => {
    const staff = await seedStaff();

    const res = await request(ctx.app).get("/api/staff/metrics?period=7d").set("Cookie", staff.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      hasData: false,
      ticketVolume: 0,
      categorySplit: [],
      statusSplit: [],
      resolvedWithoutHuman: { count: 0, proportion: 0 },
      escalationRate: 0,
      actionOutcomes: [],
      timeToResolution: { medianMinutes: null, buckets: [] },
      providerFallbacks: 0,
    });
  });

  it("TC-US5-04: an out-of-set period value is refused with METRICS_PERIOD_INVALID", async () => {
    const staff = await seedStaff();

    const res = await request(ctx.app).get("/api/staff/metrics?period=1y").set("Cookie", staff.cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("METRICS_PERIOD_INVALID");
  });

  it("TC-US5-05: a non-staff account is refused with 403 and no metrics data", async () => {
    const { seedUser } = await import("../helpers/auth.js");
    const user = await seedUser();

    const res = await request(ctx.app).get("/api/staff/metrics").set("Cookie", user.cookie);

    expect(res.status).toBe(403);
    expect(res.body.ticketVolume).toBeUndefined();
  });
});
