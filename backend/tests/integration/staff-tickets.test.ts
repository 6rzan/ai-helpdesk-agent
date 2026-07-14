import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { createTicketFixture } from "../helpers/factories.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestApp();
});

afterAll(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("TC-US1 staff ticket operations", () => {
  it("TC-US1-01: non-staff account is refused the ticket list with no data", async () => {
    const user = await seedUser();
    await createTicketFixture();

    const res = await request(ctx.app).get("/api/staff/tickets").set("Cookie", user.cookie);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("tickets");
    expect(res.body.error.message).toMatch(/staff/i);
  });

  it("TC-US1-02: signed-out request is refused with 401", async () => {
    const res = await request(ctx.app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("tickets");
  });

  it("TC-US1-03: staff sees all tickets, filtered by status and category", async () => {
    const staff = await seedStaff();
    await createTicketFixture({ category: "network", status: "open" });
    await createTicketFixture({ category: "printer", status: "open" });
    await createTicketFixture({ category: "network", status: "closed" });

    const all = await request(ctx.app).get("/api/staff/tickets").set("Cookie", staff.cookie);
    expect(all.status).toBe(200);
    expect(all.body.tickets).toHaveLength(3);

    const network = await request(ctx.app)
      .get("/api/staff/tickets")
      .query({ category: "network" })
      .set("Cookie", staff.cookie);
    expect(network.body.tickets).toHaveLength(2);
    expect(network.body.tickets.every((t: { category: string }) => t.category === "network")).toBe(true);

    const open = await request(ctx.app)
      .get("/api/staff/tickets")
      .query({ status: "open" })
      .set("Cookie", staff.cookie);
    expect(open.body.tickets).toHaveLength(2);
  });

  it("TC-US1-04: legacy ticket without a linked account is marked, not hidden (FR-014)", async () => {
    const staff = await seedStaff();
    const linkedUser = await seedUser({ displayName: "Dana Owner" });
    await createTicketFixture({ reporterAccountId: linkedUser.account._id });
    await createTicketFixture(); // legacy, no account

    const res = await request(ctx.app).get("/api/staff/tickets").set("Cookie", staff.cookie);
    expect(res.status).toBe(200);

    const linked = res.body.tickets.find((t: { reporter: string | null }) => t.reporter === "Dana Owner");
    const legacy = res.body.tickets.find((t: { reporter: string | null }) => t.reporter === null);
    expect(linked).toBeTruthy();
    expect(legacy).toBeTruthy();
  });

  it("TC-US1-05: staff ticket detail aggregates transcript, classification and status history", async () => {
    const staff = await seedStaff();
    const { reference } = await createTicketFixture({
      confidence: 0.91,
      messages: [
        { author: "user", text: "my wifi keeps dropping" },
        { author: "agent", text: "let's try reconnecting" },
      ],
    });

    const res = await request(ctx.app).get(`/api/staff/tickets/${reference}`).set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ticket.reference).toBe(reference);
    expect(res.body.ticket.transcript).toHaveLength(2);
    expect(res.body.ticket.classificationConfidence).toBeCloseTo(0.91);
    expect(Array.isArray(res.body.ticket.history)).toBe(true);
  });

  it("TC-US1-06: staff status change is applied and attributed in a StaffActionRecord", async () => {
    const staff = await seedStaff({ displayName: "Sam Support" });
    const { reference, ticket } = await createTicketFixture({ status: "open" });

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/status`)
      .set("Cookie", staff.cookie)
      .send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("in_progress");

    const records = await StaffActionRecord.find({ targetId: ticket._id });
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record!.action).toBe("status_change");
    expect(record!.staffName).toBe("Sam Support");
    expect(record!.details).toMatchObject({ from: "open", to: "in_progress" });
  });

  it("TC-US1-07: resolving records a resolve action and marks the ticket resolved", async () => {
    const staff = await seedStaff();
    const { reference, ticket } = await createTicketFixture({ status: "in_progress" });

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/status`)
      .set("Cookie", staff.cookie)
      .send({ status: "resolved" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("resolved");

    const records = await StaffActionRecord.find({ targetId: ticket._id });
    expect(records[0]!.action).toBe("resolve");
  });

  it("TC-US1-08: an invalid status transition is refused (422)", async () => {
    const staff = await seedStaff();
    const { reference } = await createTicketFixture({ status: "open" });

    const res = await request(ctx.app)
      .post(`/api/staff/tickets/${reference}/status`)
      .set("Cookie", staff.cookie)
      .send({ status: "resolved" });

    expect(res.status).toBe(422);
  });
});
