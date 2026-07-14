import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { createTicketFixture } from "../helpers/factories.js";

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

async function seedProfile(accountId: mongoose.Types.ObjectId): Promise<void> {
  await mongoose.connection.collection("supportprofiles").insertOne({
    accountId,
    remoteAccessIds: [{ tool: "TeamViewer", id: "123 456 789" }],
    location: "Building B, Room 204",
    hardware: "Dell Latitude 7440",
    staffEntries: [],
    updatedAt: new Date(),
  });
}

describe("TC-US2 profile surfacing on ticket detail", () => {
  it("TC-US2-08: an escalated ticket surfaces the linked reporter's profile automatically (FR-013)", async () => {
    const staff = await seedStaff();
    const owner = await seedUser({ displayName: "Dana Owner" });
    await seedProfile(owner.account._id as mongoose.Types.ObjectId);
    const { reference } = await createTicketFixture({
      reporterAccountId: owner.account._id as mongoose.Types.ObjectId,
      escalated: true,
      handlingMode: "human_involved",
    });

    const res = await request(ctx.app).get(`/api/staff/tickets/${reference}`).set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ticket.profile).toBeTruthy();
    expect(res.body.ticket.profile.location).toBe("Building B, Room 204");
    expect(res.body.ticket.profile.hardware).toBe("Dell Latitude 7440");
    expect(res.body.ticket.profile.remoteAccessIds[0]).toMatchObject({ tool: "TeamViewer" });
  });

  it("TC-US2-09: a ticket whose reporter has no profile returns an explicit profile: null (FR-013)", async () => {
    const staff = await seedStaff();
    const owner = await seedUser({ displayName: "No Profile Nick" });
    const { reference } = await createTicketFixture({
      reporterAccountId: owner.account._id as mongoose.Types.ObjectId,
      escalated: true,
      handlingMode: "human_involved",
    });

    const res = await request(ctx.app).get(`/api/staff/tickets/${reference}`).set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ticket.profile).toBeNull();
  });

  it("TC-US2-10: a legacy ticket with no linked account returns profile: null", async () => {
    const staff = await seedStaff();
    const { reference } = await createTicketFixture({ escalated: true, handlingMode: "human_involved" });

    const res = await request(ctx.app).get(`/api/staff/tickets/${reference}`).set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ticket.profile).toBeNull();
  });
});
