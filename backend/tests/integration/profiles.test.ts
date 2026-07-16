import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { StaffActionRecord } from "../../src/models/staff-action.js";
import { UserAccount } from "../../src/models/user-account.js";
import { hashPassword } from "../../src/services/auth/password-service.js";
import { issueSession, sessionCookie } from "../../src/services/auth/session-service.js";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";

describe("Support profiles", () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await startTestApp(); });
  afterEach(async () => { await resetDb(); });
  afterAll(async () => { await stopTestApp(); });

  async function account(role: "user" | "staff", name: string) {
    const { passwordHash, passwordSalt } = await hashPassword("correct-horse-battery");
    const created = await UserAccount.create({
      email: `${name.toLowerCase().replaceAll(" ", ".")}-${Date.now()}-${Math.random()}@example.test`,
      displayName: name,
      role,
      passwordHash,
      passwordSalt,
      usingInitialPassword: role === "staff",
    });
    return { account: created, token: await issueSession(created._id) };
  }

  function as(token: string) {
    return { Cookie: `${sessionCookie.name}=${token}` };
  }

  it("TC-US4-01: an owner can read and update only support-relevant profile fields", async () => {
    const owner = await account("user", "Profile Owner");
    const update = await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({
      remoteAccessIds: [{ tool: "TeamViewer", id: "123 456 789" }],
      location: "Building B, Room 204",
      hardware: "Dell Latitude 7440",
    });

    expect(update.status).toBe(200);
    expect(update.body.profile).toMatchObject({ location: "Building B, Room 204", hardware: "Dell Latitude 7440" });
    expect(update.body.profile).not.toHaveProperty("email");

    const read = await request(ctx.app).get("/api/my/profile").set(as(owner.token));
    expect(read.status).toBe(200);
    expect(read.body.profile.remoteAccessIds).toEqual([{ tool: "TeamViewer", id: "123 456 789" }]);
  });

  it("TC-US4-02: another user cannot read or change an owner's profile", async () => {
    const owner = await account("user", "Owner");
    const other = await account("user", "Other User");
    await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({ location: "Private office" });

    const ownRead = await request(ctx.app).get("/api/my/profile").set(as(other.token));
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.profile.location).toBe("");

    const forbidden = await request(ctx.app).get(`/api/staff/users/${owner.account._id}/profile`).set(as(other.token));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.profile).toBeUndefined();
  });

  it("TC-US4-03: a staff correction is attributed and never overwrites the owner's value", async () => {
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");
    await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({ location: "Building A" });

    const append = await request(ctx.app)
      .post(`/api/staff/users/${owner.account._id}/profile/entries`)
      .set(as(staff.token))
      .send({ kind: "correction", field: "location", value: "Asset record says Building B" });
    expect(append.status).toBe(201);
    expect(append.body.profile.location).toBe("Building A");
    expect(append.body.profile.staffEntries[0]).toMatchObject({ kind: "correction", field: "location", staffName: "Case Manager" });
    expect(Date.parse(append.body.profile.staffEntries[0].at)).not.toBeNaN();

    const ownerRead = await request(ctx.app).get("/api/my/profile").set(as(owner.token));
    expect(ownerRead.body.profile.staffEntries).toHaveLength(1);
    expect(await StaffActionRecord.exists({ action: "profile_append", targetId: owner.account._id })).toBeTruthy();
  });

  it("TC-US4-04: credential status is minimal and a reset invalidates old sessions with attribution", async () => {
    const owner = await account("user", "Credential Owner");
    const staff = await account("staff", "Credential Staff");

    const before = await request(ctx.app).get(`/api/staff/users/${owner.account._id}/credentials`).set(as(staff.token));
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ usingInitialPassword: false });

    const reset = await request(ctx.app)
      .post(`/api/staff/users/${owner.account._id}/credentials/reset`)
      .set(as(staff.token))
      .send({ newInitialPassword: "new-initial-password" });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ usingInitialPassword: true });

    const stale = await request(ctx.app).get("/api/auth/me").set(as(owner.token));
    expect(stale.status).toBe(401);
    const login = await request(ctx.app).post("/api/auth/login").send({ email: owner.account.email, password: "new-initial-password" });
    expect(login.status).toBe(200);
    expect(login.body.usingInitialPassword).toBe(true);
    expect(await StaffActionRecord.exists({ action: "credential_reset", targetId: owner.account._id })).toBeTruthy();
  });
});
