import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { createActionRecordFixture, createTicketFixture } from "../helpers/factories.js";

// T084/contracts/api.md "Action trail": GET /staff/actions returns executed AND
// refused actions together by default, with full detail (timestamp, actor,
// classified intent, exact action, target endpoint, authorisation, outcome),
// and supports filtering by ticket, endpoint, and outcome (US4 AS2, SC-002).

describe("GET /staff/actions (US4, audit trail view)", () => {
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

  it("returns executed and refused actions together with full detail", async () => {
    const staff = await seedStaff();
    const { ticket, reference } = await createTicketFixture();

    await createActionRecordFixture({ ticketId: ticket._id, outcome: "succeeded", endpointId: "test-node-a" });
    await createActionRecordFixture({ ticketId: ticket._id, outcome: "refused", refusalReason: "missing_consent", endpointId: "test-node-a" });

    const res = await request(ctx.app).get("/api/staff/actions").set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.actions).toHaveLength(2);

    const outcomes = res.body.actions.map((a: { outcome: string }) => a.outcome).sort();
    expect(outcomes).toEqual(["refused", "succeeded"]);

    const succeeded = res.body.actions.find((a: { outcome: string }) => a.outcome === "succeeded");
    expect(succeeded).toMatchObject({
      ticketId: reference,
      endpointId: "test-node-a",
      endpointLabel: expect.any(String),
      classifiedIntent: expect.any(String),
      requestedAction: expect.any(String),
      actor: "agent",
    });
    expect(succeeded.at).toBeTruthy();
    expect(succeeded.authorisation).toBeDefined();
  });

  it("filters by ticket, endpoint, and outcome", async () => {
    const staff = await seedStaff();
    const { ticket: ticketA, reference: referenceA } = await createTicketFixture();
    const { ticket: ticketB } = await createTicketFixture();

    await createActionRecordFixture({ ticketId: ticketA._id, outcome: "succeeded", endpointId: "test-node-a" });
    await createActionRecordFixture({ ticketId: ticketA._id, outcome: "refused", refusalReason: "missing_consent", endpointId: "test-node-b" });
    await createActionRecordFixture({ ticketId: ticketB._id, outcome: "succeeded", endpointId: "test-node-a" });

    const byTicket = await request(ctx.app).get(`/api/staff/actions?ticketId=${referenceA}`).set("Cookie", staff.cookie);
    expect(byTicket.status).toBe(200);
    expect(byTicket.body.actions).toHaveLength(2);
    expect(byTicket.body.actions.every((a: { ticketId: string }) => a.ticketId === referenceA)).toBe(true);

    const byEndpoint = await request(ctx.app).get("/api/staff/actions?endpointId=test-node-b").set("Cookie", staff.cookie);
    expect(byEndpoint.status).toBe(200);
    expect(byEndpoint.body.actions).toHaveLength(1);
    expect(byEndpoint.body.actions[0].endpointId).toBe("test-node-b");

    const byOutcome = await request(ctx.app).get("/api/staff/actions?outcome=refused").set("Cookie", staff.cookie);
    expect(byOutcome.status).toBe(200);
    expect(byOutcome.body.actions).toHaveLength(1);
    expect(byOutcome.body.actions[0].outcome).toBe("refused");
  });

  it("paginates and reports total", async () => {
    const staff = await seedStaff();
    const { ticket } = await createTicketFixture();
    for (let i = 0; i < 5; i += 1) {
      await createActionRecordFixture({ ticketId: ticket._id });
    }

    const res = await request(ctx.app).get("/api/staff/actions?page=1&pageSize=2").set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.actions).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
  });

  it("refuses non-staff accounts with 403 and no action data", async () => {
    const user = await seedUser();
    const res = await request(ctx.app).get("/api/staff/actions").set("Cookie", user.cookie);
    expect(res.status).toBe(403);
    expect(res.body.actions).toBeUndefined();
  });

  // T091/FR-010/SC-002: there is deliberately no PATCH, PUT, or DELETE on
  // /staff/actions or /staff/actions/:id -- the absence is the requirement,
  // so these fall through to the plain 404 handler rather than a 403 or a
  // handled route, staff session or not.
  it("has no PATCH, PUT, or DELETE on /staff/actions or /staff/actions/:id (the absence is the requirement)", async () => {
    const staff = await seedStaff();
    const { ticket } = await createTicketFixture();
    const record = await createActionRecordFixture({ ticketId: ticket._id });

    for (const method of ["patch", "put", "delete"] as const) {
      const collectionRes = await request(ctx.app)[method]("/api/staff/actions").set("Cookie", staff.cookie);
      expect(collectionRes.status).toBe(404);

      const itemRes = await request(ctx.app)[method](`/api/staff/actions/${record._id.toString()}`).set("Cookie", staff.cookie);
      expect(itemRes.status).toBe(404);
    }
  });
});
