import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";

/**
 * The three staff profile-field routes (007 T032).
 *
 * FR-016 to FR-019, FR-023, FR-026; contracts/api.md.
 */

describe("staff profile fields", () => {
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

  function idOf(seeded: { account: { _id: unknown } }): string {
    return (seeded.account._id as { toString(): string }).toString();
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

  describe("reading a profile", () => {
    it("SPF-001: an account with no profile yet reads as empty and fully owner-controlled", async () => {
      // The spec edge case. A 404 here would be the system saying "no such person" about
      // someone who has simply never filled anything in.
      const staff = await seedStaff();
      const target = await seedUser();

      const res = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile`)
        .set("Cookie", staff.cookie);

      expect(res.status).toBe(200);
      expect(res.body.profile.location).toBe("");
      expect(res.body.profile.remoteAccessIds).toEqual([]);
      for (const field of ["location", "hardware", "remoteAccessIds"]) {
        expect(res.body.profile.fieldState[field].controlledBy).toBe("owner");
        expect(res.body.profile.fieldState[field].setByName).toBeNull();
      }
    });

    it("SPF-002: the profile read carries no field history", async () => {
      // FR-018. History has its own route; leaking it through the profile read would put
      // it one shared view away from the owner's own page.
      const staff = await seedStaff();
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
      });

      const res = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile`)
        .set("Cookie", staff.cookie);

      expect(res.body.profile.history).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("changeKind");
    });
  });

  describe("setting fields", () => {
    it("SPF-003: a staff-set value becomes the profile's value with its author and time", async () => {
      const staff = await seedStaff({ displayName: "Ayesha Khan" });
      const target = await seedUser();

      const res = await save(staff.cookie, idOf(target), {
        location: { value: "Block C, desk 14", expectedSetAt: null },
        hardware: { value: "HP ProBook 450 G9, 16 GB", expectedSetAt: null },
      });

      expect(res.status).toBe(200);
      expect(res.body.results.location.outcome).toBe("applied");
      expect(res.body.profile.location).toBe("Block C, desk 14");
      expect(res.body.profile.fieldState.location.setByName).toBe("Ayesha Khan");
      expect(res.body.profile.fieldState.location.controlledBy).toBe("staff");
      expect(typeof res.body.profile.fieldState.location.setAt).toBe("string");
    });

    it("SPF-004: works on an account that has never had a profile", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        hardware: { value: "Dell Latitude 5440", expectedSetAt: null },
      });
      expect(res.status).toBe(200);
      expect(res.body.profile.hardware).toBe("Dell Latitude 5440");
    });

    it("SPF-005: the remote access list is set as one field", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        remoteAccessIds: {
          value: [
            { tool: "TeamViewer", id: "111 222 333" },
            { tool: "AnyDesk", id: "444 555" },
          ],
          expectedSetAt: null,
        },
      });

      expect(res.body.profile.remoteAccessIds).toHaveLength(2);
      expect(res.body.profile.fieldState.remoteAccessIds.controlledBy).toBe("staff");
      // One byline for the list, not one per entry (FR-019, R11).
      expect(res.body.profile.fieldState.remoteAccessIds.setByName).toBeTruthy();
    });

    it("SPF-006: one StaffActionRecord per save, naming the applied fields", async () => {
      const staff = await seedStaff({ displayName: "Ayesha Khan" });
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
        hardware: { value: "HP ProBook", expectedSetAt: null },
      });

      const records = await StaffActionRecord.find({ action: "profile_edit" }).lean();
      expect(records).toHaveLength(1);
      const details = records[0]?.details as { fields: string[] };
      expect(details.fields.sort()).toEqual(["hardware", "location"]);
    });

    it("SPF-007: a staff member editing their own profile through this surface is permitted and recorded identically", async () => {
      // The spec edge case. No special case, no self-edit warning: staff are account
      // owners too, and a carve-out would be a second code path to keep correct.
      const staff = await seedStaff({ displayName: "Ayesha Khan" });

      const res = await save(staff.cookie, idOf(staff), {
        location: { value: "IT office", expectedSetAt: null },
      });

      expect(res.status).toBe(200);
      expect(res.body.results.location.outcome).toBe("applied");
      expect(res.body.profile.fieldState.location.setByName).toBe("Ayesha Khan");
      expect(res.body.profile.fieldState.location.controlledBy).toBe("staff");

      const records = await StaffActionRecord.find({ action: "profile_edit" }).lean();
      expect(records).toHaveLength(1);
      expect(records[0]?.staffName).toBe("Ayesha Khan");
    });

    it("SPF-008: an unknown account is 404", async () => {
      const staff = await seedStaff();
      const res = await save(staff.cookie, "60f0000000000000000000aa", {
        location: { value: "Block C", expectedSetAt: null },
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("ACCOUNT_NOT_FOUND");
    });
  });

  describe("boundary validation", () => {
    it("SPF-009: an unknown field name is refused, naming it", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        phoneNumber: { value: "07000 000000", expectedSetAt: null },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.field).toBe("phoneNumber");
    });

    it("SPF-010: an over-long location is refused, naming the field", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        location: { value: "x".repeat(161), expectedSetAt: null },
      });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe("location");
    });

    it("SPF-011: an over-long hardware value is refused", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        hardware: { value: "x".repeat(501), expectedSetAt: null },
      });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe("hardware");
    });

    it("SPF-012: more than ten remote entries is refused", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        remoteAccessIds: {
          value: Array.from({ length: 11 }, (_, i) => ({ tool: "AnyDesk", id: String(i) })),
          expectedSetAt: null,
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("SPF-013: a half-filled remote entry is refused with its index", async () => {
      // Without the index, a person editing six rows has to work out which one the
      // message is about.
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        remoteAccessIds: {
          value: [
            { tool: "TeamViewer", id: "111" },
            { tool: "AnyDesk", id: "" },
          ],
          expectedSetAt: null,
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("REMOTE_ACCESS_ENTRY_INVALID");
      expect(res.body.entryIndex).toBe(1);
    });

    it("SPF-014: an empty fields object is refused", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {});
      expect(res.status).toBe(400);
    });

    it("SPF-015: a malformed second field leaves the first one unwritten", async () => {
      // Everything is validated before anything is applied, so a refused request is a
      // refused request rather than a half-applied one.
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
        hardware: { value: "x".repeat(501), expectedSetAt: null },
      });
      expect(res.status).toBe(400);

      const after = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile`)
        .set("Cookie", staff.cookie);
      expect(after.body.profile.location).toBe("");
    });
  });

  describe("release", () => {
    it("SPF-016: returns the field to the owner, leaving the value and its author alone", async () => {
      const staff = await seedStaff({ displayName: "Ayesha Khan" });
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C, desk 14", expectedSetAt: null },
      });

      const res = await request(ctx.app)
        .post(`/api/staff/users/${idOf(target)}/profile/fields/location/release`)
        .set("Cookie", staff.cookie)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.profile.fieldState.location.controlledBy).toBe("owner");
      expect(res.body.profile.location).toBe("Block C, desk 14");
      expect(res.body.profile.fieldState.location.setByName).toBe("Ayesha Khan");
    });

    it("SPF-017: releasing an owner-controlled field is a 409", async () => {
      // The interface offers no release control there at all; this exists so the rule
      // holds against a direct request.
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await request(ctx.app)
        .post(`/api/staff/users/${idOf(target)}/profile/fields/location/release`)
        .set("Cookie", staff.cookie)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("FIELD_NOT_STAFF_CONTROLLED");
    });

    it("SPF-018: an unknown field name is a 400", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await request(ctx.app)
        .post(`/api/staff/users/${idOf(target)}/profile/fields/phoneNumber/release`)
        .set("Cookie", staff.cookie)
        .send({});
      expect(res.status).toBe(400);
    });

    it("SPF-019: a release writes one StaffActionRecord naming the field", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
      });
      await request(ctx.app)
        .post(`/api/staff/users/${idOf(target)}/profile/fields/location/release`)
        .set("Cookie", staff.cookie)
        .send({});

      const records = await StaffActionRecord.find({ action: "profile_release" }).lean();
      expect(records).toHaveLength(1);
      expect((records[0]?.details as { field: string }).field).toBe("location");
    });

    it("SPF-020: a released field can be edited by the owner again (SC-010)", async () => {
      // No account owner may end up permanently unable to have a field corrected.
      const staff = await seedStaff();
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
      });
      await request(ctx.app)
        .post(`/api/staff/users/${idOf(target)}/profile/fields/location/release`)
        .set("Cookie", staff.cookie)
        .send({});

      const owner = await request(ctx.app)
        .put("/api/my/profile")
        .set("Cookie", target.cookie)
        .send({ location: "Block A, desk 2" });

      expect(owner.status).toBe(200);
      expect(owner.body.results.location.outcome).toBe("applied");
      expect(owner.body.profile.location).toBe("Block A, desk 2");
    });
  });

  describe("field history", () => {
    it("SPF-021: returns the field's history newest first", async () => {
      const staff = await seedStaff({ displayName: "Ayesha Khan" });
      const target = await seedUser();
      const first = await save(staff.cookie, idOf(target), {
        location: { value: "Block B", expectedSetAt: null },
      });
      await save(staff.cookie, idOf(target), {
        location: {
          value: "Block C",
          expectedSetAt: first.body.profile.fieldState.location.setAt as string,
        },
      });

      const res = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile/fields/location/history`)
        .set("Cookie", staff.cookie);

      expect(res.status).toBe(200);
      const values = res.body.history.filter(
        (entry: { changeKind: string }) => entry.changeKind === "value",
      );
      expect(values[0].previousValue).toBe("Block B");
      expect(values[0].actorName).toBe("Ayesha Khan");
    });

    it("SPF-022: an account with no history reads as an empty list, not a 404", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      const res = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile/fields/hardware/history`)
        .set("Cookie", staff.cookie);
      expect(res.status).toBe(200);
      expect(res.body.history).toEqual([]);
    });

    it("SPF-023: history is scoped to the field asked for", async () => {
      const staff = await seedStaff();
      const target = await seedUser();
      await save(staff.cookie, idOf(target), {
        location: { value: "Block C", expectedSetAt: null },
        hardware: { value: "HP ProBook", expectedSetAt: null },
      });

      const res = await request(ctx.app)
        .get(`/api/staff/users/${idOf(target)}/profile/fields/location/history`)
        .set("Cookie", staff.cookie);

      expect(res.body.history.length).toBeGreaterThan(0);
      for (const entry of res.body.history) {
        expect(JSON.stringify(entry)).not.toContain("HP ProBook");
      }
    });

    it("SPF-024: there is no owner-facing route that returns history (FR-018)", async () => {
      // Absence is the enforcement. If this ever stops being a 404, history has become
      // readable by the person it is kept from.
      const target = await seedUser();
      const res = await request(ctx.app)
        .get("/api/my/profile/fields/location/history")
        .set("Cookie", target.cookie);
      expect(res.status).toBe(404);
      expect(res.body.history).toBeUndefined();
    });
  });
});
