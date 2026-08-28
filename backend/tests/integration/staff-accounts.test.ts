import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedAccount, seedStaff } from "../helpers/auth.js";

/**
 * `GET /api/staff/accounts` (007 T042, FR-030 to FR-033).
 *
 * The route's whole surface is one query parameter and one response shape, so these
 * tests are mostly about what it refuses to do: widen the projection, answer a caller
 * who has no right to ask, or report an ordinary empty result as a failure.
 */

describe("GET /api/staff/accounts", () => {
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

  async function seedDirectory() {
    const staff = await seedStaff({ displayName: "Chidi Okafor", email: "chidi@example.com" });
    await seedAccount({ displayName: "Amina Yusuf", email: "amina.yusuf@example.com" });
    await seedAccount({ displayName: "Brian Ochieng", email: "brian@contractor.example" });
    return staff;
  }

  it("SA-001: returns every account to a staff caller", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(3);
  });

  it("SA-002: carries exactly the four directory attributes", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", staff.cookie);
    for (const entry of res.body.accounts) {
      expect(Object.keys(entry).sort()).toEqual(["displayName", "email", "id", "role"]);
    }
  });

  it("SA-003: never leaks credential material or availability", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", staff.cookie);
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|passwordSalt|availability|usingInitialPassword/,
    );
  });

  it("SA-004: filters on a display name, case-insensitively", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "AMINA" })
      .set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accounts.map((entry: { displayName: string }) => entry.displayName)).toEqual([
      "Amina Yusuf",
    ]);
  });

  it("SA-005: filters on an email as well", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "contractor.example" })
      .set("Cookie", staff.cookie);
    expect(res.body.accounts.map((entry: { email: string }) => entry.email)).toEqual([
      "brian@contractor.example",
    ]);
  });

  it("SA-006: answers no match with 200 and an empty array, not 404", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "nobody-by-that-name" })
      .set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  it("SA-007: refuses a search term over 120 characters", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "a".repeat(121) })
      .set("Cookie", staff.cookie);
    expect(res.status).toBe(400);
    expect(res.body.accounts).toBeUndefined();
  });

  it("SA-008: accepts a term of exactly 120 characters", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "a".repeat(120) })
      .set("Cookie", staff.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  it("SA-009: treats a term as text rather than as a pattern", async () => {
    const staff = await seedDirectory();
    const res = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: ".*" })
      .set("Cookie", staff.cookie);
    expect(res.body.accounts).toEqual([]);
  });

  it("SA-010: an account id in the response opens that account's profile", async () => {
    const staff = await seedDirectory();
    const directory = await request(ctx.app)
      .get("/api/staff/accounts")
      .query({ q: "amina" })
      .set("Cookie", staff.cookie);
    const id = directory.body.accounts[0].id as string;

    const profile = await request(ctx.app)
      .get(`/api/staff/users/${id}/profile`)
      .set("Cookie", staff.cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.profile).toBeDefined();
  });

  it("SA-011: refuses a signed-out caller with 401 and no data", async () => {
    await seedDirectory();
    const res = await request(ctx.app).get("/api/staff/accounts");
    expect(res.status).toBe(401);
    expect(res.body.accounts).toBeUndefined();
  });

  it("SA-012: refuses a signed-in non-staff account with 403 and no data", async () => {
    await seedDirectory();
    const user = await seedAccount({ displayName: "Nadia Reporter", email: "nadia@example.com" });
    const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", user.cookie);
    expect(res.status).toBe(403);
    expect(res.body.accounts).toBeUndefined();
  });
});
