import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { startTestApp, resetDb, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { seedUser } from "../helpers/auth.js";
import { createTicketFixture } from "../helpers/factories.js";

let ctx: TestContext;
beforeAll(async () => { ctx = await startTestApp(); });
afterEach(async () => { await resetDb(); resetSessionStore(); });
afterAll(async () => { await stopTestApp(); });

describe("TC-US3 my tickets ownership", () => {
  it("refuses a new conversation without a signed-in session", async () => {
    const res = await request(ctx.app).post("/api/sessions").send();
    expect(res.status).toBe(401);
  });

  it("links new conversations to the authenticated account", async () => {
    const user = await seedUser();
    const session = await request(ctx.app).post("/api/sessions").set("Cookie", user.cookie).send();
    expect(session.status).toBe(201);
    const created = await createTicketFixture({ reporterAccountId: user.account._id });
    const mine = await request(ctx.app).get("/api/my/tickets").set("Cookie", user.cookie);
    expect(mine.status).toBe(200);
    expect(mine.body.tickets.map((ticket: { reference: string }) => ticket.reference)).toContain(created.reference);
  });

  it("never exposes another account's ticket", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const ticket = await createTicketFixture({ reporterAccountId: owner.account._id });
    const res = await request(ctx.app).get(`/api/my/tickets/${ticket.reference}`).set("Cookie", other.cookie);
    expect(res.status).toBe(403);
    expect(res.body.ticket).toBeUndefined();
  });
});
