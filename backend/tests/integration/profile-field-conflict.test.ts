import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";

/**
 * Per-field concurrency on the staff profile save (007 T026, FR-029, R7, data-model §8).
 *
 * Written before the route (test-first, research.md R13).
 *
 * The behaviour under test is the one the Design Direction names as the most likely bug
 * in this feature: two staff members edit the same profile, and the second save must
 * refuse **only** the field that moved under them. Refusing the whole request would make
 * them retype work that was never in conflict; accepting the whole request would silently
 * discard a colleague's correction.
 *
 * `expectedSetAt` is the field's own `setAt` as the client loaded it, so the token is
 * per field rather than per document. `null` means "never set when I loaded it", which is
 * what stops last-write-wins on a previously empty field.
 */

describe("per-field concurrency on PUT /api/staff/users/:id/profile/fields", () => {
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

  async function seedTarget(): Promise<string> {
    const target = await seedUser({ displayName: "Target Person" });
    return (target.account._id as { toString(): string }).toString();
  }

  function save(
    cookie: string,
    id: string,
    fields: Record<string, { value: unknown; expectedSetAt: string | null }>,
  ) {
    return request(ctx.app)
      .put(`/api/staff/users/${id}/profile/fields`)
      .set("Cookie", cookie)
      .send({ fields });
  }

  function readProfile(cookie: string, id: string) {
    return request(ctx.app).get(`/api/staff/users/${id}/profile`).set("Cookie", cookie);
  }

  it("PF-001: a first save on a never-set field applies with expectedSetAt null", async () => {
    const staff = await seedStaff({ displayName: "Ayesha Khan" });
    const id = await seedTarget();

    const res = await save(staff.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: null },
    });

    expect(res.status).toBe(200);
    expect(res.body.results.location.outcome).toBe("applied");
    expect(res.body.profile.location).toBe("Block C, desk 14");
    expect(res.body.profile.fieldState.location.controlledBy).toBe("staff");
    expect(res.body.profile.fieldState.location.setByName).toBe("Ayesha Khan");
  });

  it("PF-002: the second of two saves applies the current field and refuses only the stale one", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    // Both staff members load the same profile.
    const loaded = await readProfile(second.cookie, id);
    const staleLocationToken = loaded.body.profile.fieldState.location.setAt as string | null;
    const hardwareToken = loaded.body.profile.fieldState.hardware.setAt as string | null;

    // The first one saves location.
    const firstSave = await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: staleLocationToken },
    });
    expect(firstSave.body.results.location.outcome).toBe("applied");

    // The second one saves both, still holding the token from before that save.
    const res = await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: staleLocationToken },
      hardware: { value: "HP ProBook 450 G9", expectedSetAt: hardwareToken },
    });

    // A mixed result is a 200. Reporting it as a failure would misdescribe what the
    // server did: one field really was saved.
    expect(res.status).toBe(200);
    expect(res.body.results.hardware.outcome).toBe("applied");
    expect(res.body.results.location.outcome).toBe("conflict");
  });

  it("PF-003: a conflict carries the current value, author, and time so the loser can see what they would have overwritten", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    const loaded = await readProfile(second.cookie, id);
    const staleToken = loaded.body.profile.fieldState.location.setAt as string | null;

    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: staleToken },
    });

    const res = await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: staleToken },
    });

    const conflict = res.body.results.location;
    expect(conflict.outcome).toBe("conflict");
    expect(conflict.currentValue).toBe("Block B, desk 7");
    expect(conflict.currentSetByName).toBe("Ayesha Khan");
    expect(typeof conflict.currentSetAt).toBe("string");
  });

  it("PF-004: a refused field is not written, and the applied field is", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    const loaded = await readProfile(second.cookie, id);
    const staleToken = loaded.body.profile.fieldState.location.setAt as string | null;

    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: staleToken },
    });
    await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: staleToken },
      hardware: { value: "HP ProBook 450 G9", expectedSetAt: null },
    });

    const after = await readProfile(second.cookie, id);
    expect(after.body.profile.location).toBe("Block B, desk 7");
    expect(after.body.profile.hardware).toBe("HP ProBook 450 G9");
  });

  it("PF-005: the returned profile is the profile as it now stands, not the submitted values", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    const loaded = await readProfile(second.cookie, id);
    const staleToken = loaded.body.profile.fieldState.location.setAt as string | null;
    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: staleToken },
    });

    const res = await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: staleToken },
    });

    // The refused value must not appear anywhere in the returned profile, or the client
    // would render the change as saved.
    expect(res.body.profile.location).toBe("Block B, desk 7");
  });

  it("PF-006: expectedSetAt null on a field that has since been set is refused", async () => {
    // This is the case that would otherwise be a silent overwrite: a field that was
    // empty when the second staff member loaded the page has since been filled in.
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    await save(first.cookie, id, {
      hardware: { value: "Dell Latitude 5440", expectedSetAt: null },
    });

    const res = await save(second.cookie, id, {
      hardware: { value: "HP ProBook 450 G9", expectedSetAt: null },
    });

    expect(res.status).toBe(200);
    expect(res.body.results.hardware.outcome).toBe("conflict");
    expect(res.body.results.hardware.currentValue).toBe("Dell Latitude 5440");
    expect(res.body.profile.hardware).toBe("Dell Latitude 5440");
  });

  it("PF-007: the remote access list is one field, so a stale token refuses the whole list", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    await save(first.cookie, id, {
      remoteAccessIds: { value: [{ tool: "TeamViewer", id: "111" }], expectedSetAt: null },
    });

    const res = await save(second.cookie, id, {
      remoteAccessIds: { value: [{ tool: "AnyDesk", id: "222" }], expectedSetAt: null },
    });

    expect(res.body.results.remoteAccessIds.outcome).toBe("conflict");
    expect(res.body.results.remoteAccessIds.currentValue).toEqual([
      { tool: "TeamViewer", id: "111" },
    ]);
  });

  it("PF-008: the action record lists only the applied field (FR-026)", async () => {
    // A record naming a field that was refused would describe a change that never
    // happened, in the one place the audit is meant to be trustworthy.
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    const loaded = await readProfile(second.cookie, id);
    const staleToken = loaded.body.profile.fieldState.location.setAt as string | null;
    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: staleToken },
    });

    await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: staleToken },
      hardware: { value: "HP ProBook 450 G9", expectedSetAt: null },
    });

    const records = await StaffActionRecord.find({ staffName: "Omar Haddad" }).lean();
    expect(records).toHaveLength(1);
    const details = records[0]?.details as { fields?: string[] } | undefined;
    expect(details?.fields).toEqual(["hardware"]);
    expect(records[0]?.action).toBe("profile_edit");
  });

  it("PF-009: a save where every field conflicts writes no action record at all", async () => {
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: null },
    });
    const res = await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: null },
    });

    expect(res.body.results.location.outcome).toBe("conflict");
    const records = await StaffActionRecord.find({ staffName: "Omar Haddad" }).lean();
    expect(records).toHaveLength(0);
  });

  it("PF-010: re-saving with the token from the conflict response succeeds", async () => {
    // The conflict has to be resolvable, or the second staff member is stuck. This is
    // the loop the interface actually walks the user through.
    const first = await seedStaff({ displayName: "Ayesha Khan" });
    const second = await seedStaff({ displayName: "Omar Haddad" });
    const id = await seedTarget();

    await save(first.cookie, id, {
      location: { value: "Block B, desk 7", expectedSetAt: null },
    });
    const refused = await save(second.cookie, id, {
      location: { value: "Block C, desk 14", expectedSetAt: null },
    });

    const retry = await save(second.cookie, id, {
      location: {
        value: "Block C, desk 14",
        expectedSetAt: refused.body.results.location.currentSetAt as string,
      },
    });

    expect(retry.body.results.location.outcome).toBe("applied");
    expect(retry.body.profile.location).toBe("Block C, desk 14");
    expect(retry.body.profile.fieldState.location.setByName).toBe("Omar Haddad");
  });
});
