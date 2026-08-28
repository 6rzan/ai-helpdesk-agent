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

  it("TC-US4-03: the correction write path is retired; staff set the value itself (007 FR-016, T031)", async () => {
    // Superseded by 007. A correction existed to record a value staff believed was right
    // *beside* an owner value they could not change. Staff can now set the value, so a
    // new correction would be writing down a disagreement the system no longer has to
    // have — and would leave the reader deciding which of two values to believe, which
    // is the arrangement 007 exists to end.
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");
    await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({ location: "Building A" });

    const refused = await request(ctx.app)
      .post(`/api/staff/users/${owner.account._id}/profile/entries`)
      .set(as(staff.token))
      .send({ kind: "correction", field: "location", value: "Asset record says Building B" });
    expect(refused.status).toBe(400);

    // The note path is untouched: a note is still an annotation beside a value, and that
    // is still a thing staff need to write.
    const note = await request(ctx.app)
      .post(`/api/staff/users/${owner.account._id}/profile/entries`)
      .set(as(staff.token))
      .send({ kind: "note", value: "Please call before connecting." });
    expect(note.status).toBe(201);
    expect(note.body.profile.location).toBe("Building A");
    expect(note.body.profile.staffEntries[0]).toMatchObject({ kind: "note", staffName: "Case Manager" });
    expect(await StaffActionRecord.exists({ action: "profile_append", targetId: owner.account._id })).toBeTruthy();
  });

  it("TC-US4-03b: a staff-set value becomes the owner's value, carrying who set it (007 FR-016)", async () => {
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");
    await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({ location: "Building A" });

    // Staff load the profile first, which is where the concurrency token comes from.
    const loaded = await request(ctx.app)
      .get(`/api/staff/users/${owner.account._id}/profile`)
      .set(as(staff.token));
    expect(loaded.body.profile.location).toBe("Building A");

    const saved = await request(ctx.app)
      .put(`/api/staff/users/${owner.account._id}/profile/fields`)
      .set(as(staff.token))
      .send({
        fields: {
          location: {
            value: "Building B",
            expectedSetAt: loaded.body.profile.fieldState.location.setAt as string,
          },
        },
      });

    expect(saved.status).toBe(200);
    expect(saved.body.results.location.outcome).toBe("applied");
    // The staff value *is* the value now, rather than sitting beside a stale one.
    expect(saved.body.profile.location).toBe("Building B");
    expect(saved.body.profile.fieldState.location.setByName).toBe("Case Manager");
    expect(saved.body.profile.fieldState.location.controlledBy).toBe("staff");

    const ownerRead = await request(ctx.app).get("/api/my/profile").set(as(owner.token));
    expect(ownerRead.body.profile.location).toBe("Building B");
  });

  it("TC-US4-03b2: a staff save with a stale token is a 200 carrying a conflict, never a 4xx", async () => {
    // A mixed or refused field is not a failed request: reporting it as one would tell
    // the client to discard everything the staff member typed.
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");
    await request(ctx.app).put("/api/my/profile").set(as(owner.token)).send({ location: "Building A" });

    const stale = await request(ctx.app)
      .put(`/api/staff/users/${owner.account._id}/profile/fields`)
      .set(as(staff.token))
      .send({ fields: { location: { value: "Building B", expectedSetAt: null } } });

    expect(stale.status).toBe(200);
    expect(stale.body.results.location.outcome).toBe("conflict");
    expect(stale.body.results.location.currentValue).toBe("Building A");
    expect(stale.body.profile.location).toBe("Building A");
  });

  it("TC-US4-03c: an owner read carries provenance and control but never history (007 FR-017, FR-018)", async () => {
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");

    await request(ctx.app)
      .put(`/api/staff/users/${owner.account._id}/profile/fields`)
      .set(as(staff.token))
      .send({ fields: { location: { value: "Building B", expectedSetAt: null } } });

    const read = await request(ctx.app).get("/api/my/profile").set(as(owner.token));
    expect(read.status).toBe(200);
    // The owner needs `controlledBy` to know what is editable and `setBy*` to know who to
    // ask. Both are the same shape staff get: two shapes would be two chances for a
    // byline to disagree with itself.
    expect(read.body.profile.fieldState.location.controlledBy).toBe("staff");
    expect(read.body.profile.fieldState.location.setByName).toBe("Case Manager");
    // FR-018: history is staff-only, and its absence here is the enforcement.
    expect(read.body.profile.history).toBeUndefined();
    expect(JSON.stringify(read.body)).not.toContain("changeKind");
  });

  it("TC-US4-03d: an owner write to a staff-controlled field is refused with an explanation, not dropped (007 FR-021)", async () => {
    const owner = await account("user", "Owner");
    const staff = await account("staff", "Case Manager");

    await request(ctx.app)
      .put(`/api/staff/users/${owner.account._id}/profile/fields`)
      .set(as(staff.token))
      .send({ fields: { location: { value: "Building B", expectedSetAt: null } } });

    const attempt = await request(ctx.app)
      .put("/api/my/profile")
      .set(as(owner.token))
      .send({ location: "Building A", hardware: "My own laptop" });

    expect(attempt.status).toBe(200);
    expect(attempt.body.results.location).toMatchObject({
      outcome: "locked",
      currentSetByName: "Case Manager",
    });
    // The field the owner still controls in the same request is applied.
    expect(attempt.body.results.hardware.outcome).toBe("applied");
    expect(attempt.body.profile.location).toBe("Building B");
    expect(attempt.body.profile.hardware).toBe("My own laptop");
    // An owner write never moves control and never writes an audit record. The one
    // `profile_edit` on record is the staff save above, not the owner's own write.
    expect(attempt.body.profile.fieldState.hardware.controlledBy).toBe("owner");
    const edits = await StaffActionRecord.find({ action: "profile_edit" }).lean();
    expect(edits).toHaveLength(1);
    expect(edits[0]?.staffName).toBe("Case Manager");
  });

  it("TC-US4-03e: an owner write records the owner as the field's author (007 FR-024)", async () => {
    const owner = await account("user", "Owner");
    const res = await request(ctx.app)
      .put("/api/my/profile")
      .set(as(owner.token))
      .send({ location: "Building A" });

    expect(res.body.results.location.outcome).toBe("applied");
    expect(res.body.profile.fieldState.location.setByKind).toBe("owner");
    expect(res.body.profile.fieldState.location.setByName).toBe("Owner");
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
