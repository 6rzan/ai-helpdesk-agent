import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { resetDb, startTestApp, stopTestApp } from "../helpers/test-app.js";
import { ProfileFieldHistory } from "../../src/models/profile-field-history.js";
import { SupportProfile } from "../../src/models/support-profile.js";
import {
  getFieldHistory,
  releaseField,
  setFieldsAsOwner,
  setFieldsAsStaff,
  type FieldActor,
} from "../../src/services/profile/profile-field-service.js";

/**
 * The field service (007 T030): authority, provenance, concurrency, release, history.
 *
 * R5, R6, R7, data-model.md §4.
 */

describe("profile-field-service", () => {
  beforeAll(async () => {
    await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  const staff: FieldActor = { id: new Types.ObjectId(), name: "Ayesha Khan", kind: "staff" };
  const otherStaff: FieldActor = { id: new Types.ObjectId(), name: "Omar Haddad", kind: "staff" };
  const owner: FieldActor = { id: new Types.ObjectId(), name: "Sara Alkaff", kind: "owner" };

  function newAccount() {
    return new Types.ObjectId();
  }

  describe("a staff write", () => {
    it("FS-001: sets the value, records who set it, and moves control to staff", async () => {
      const accountId = newAccount();
      const { results, profile } = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C, desk 14", expectedSetAt: null } },
      });

      expect(results.location).toEqual({ outcome: "applied" });
      expect(profile.location).toBe("Block C, desk 14");
      expect(profile.fieldState?.location?.setByName).toBe("Ayesha Khan");
      expect(profile.fieldState?.location?.setByKind).toBe("staff");
      expect(profile.fieldState?.location?.controlledBy).toBe("staff");
    });

    it("FS-002: works on an account that has never had a profile", async () => {
      // FR-016. Refusing here would be the system saying "no such person" about someone
      // standing at the desk.
      const accountId = newAccount();
      expect(await SupportProfile.findOne({ accountId })).toBeNull();

      const { results } = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { hardware: { value: "HP ProBook 450 G9", expectedSetAt: null } },
      });

      expect(results.hardware).toEqual({ outcome: "applied" });
      expect((await SupportProfile.findOne({ accountId }))?.hardware).toBe("HP ProBook 450 G9");
    });

    it("FS-003: leaves the fields it was not asked about alone", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });
      const { profile } = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { hardware: { value: "HP ProBook", expectedSetAt: null } },
      });

      expect(profile.location).toBe("Block C");
      expect(profile.fieldState?.location?.controlledBy).toBe("staff");
      expect(profile.fieldState?.remoteAccessIds?.controlledBy).toBe("owner");
    });

    it("FS-004: takes the whole remote access list as one value", async () => {
      const accountId = newAccount();
      const { profile } = await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          remoteAccessIds: {
            value: [
              { tool: "TeamViewer", id: "111" },
              { tool: "AnyDesk", id: "222" },
            ],
            expectedSetAt: null,
          },
        },
      });

      expect(profile.remoteAccessIds).toHaveLength(2);
      expect(profile.fieldState?.remoteAccessIds?.controlledBy).toBe("staff");
    });
  });

  describe("per-field concurrency", () => {
    it("FS-005: a stale token refuses that field and carries what would have been overwritten", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block B, desk 7", expectedSetAt: null } },
      });

      const { results, profile } = await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: { location: { value: "Block C, desk 14", expectedSetAt: null } },
      });

      expect(results.location).toMatchObject({
        outcome: "conflict",
        currentValue: "Block B, desk 7",
        currentSetByName: "Ayesha Khan",
      });
      expect(profile.location).toBe("Block B, desk 7");
    });

    it("FS-006: a current token on one field and a stale token on another applies only the current one", async () => {
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block B", expectedSetAt: null } },
      });
      const currentLocationToken = first.profile.fieldState?.location?.setAt?.toISOString() ?? null;

      // Stale on hardware is impossible here (never set), so invert: location carries the
      // current token and hardware carries a token for a value that was never set but
      // has since been written by someone else.
      await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: { hardware: { value: "Dell Latitude", expectedSetAt: null } },
      });

      const { results, applied } = await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: {
          location: { value: "Block C", expectedSetAt: currentLocationToken },
          hardware: { value: "HP ProBook", expectedSetAt: null },
        },
      });

      expect(results.location?.outcome).toBe("applied");
      expect(results.hardware?.outcome).toBe("conflict");
      expect(applied).toEqual(["location"]);
    });

    it("FS-007: a conflict writes nothing at all for that field, including no history", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block B", expectedSetAt: null } },
      });
      const before = await ProfileFieldHistory.countDocuments({ accountId });

      await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });

      expect(await ProfileFieldHistory.countDocuments({ accountId })).toBe(before);
    });

    it("FS-008: the token from the conflict response resolves it", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block B", expectedSetAt: null } },
      });
      const refused = await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });
      const outcome = refused.results.location;
      const currentSetAt = outcome?.outcome === "conflict" ? outcome.currentSetAt : null;

      const retry = await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: { location: { value: "Block C", expectedSetAt: currentSetAt } },
      });

      expect(retry.results.location?.outcome).toBe("applied");
      expect(retry.profile.location).toBe("Block C");
    });
  });

  describe("release", () => {
    it("FS-009: returns control to the owner and leaves the value and its author untouched", async () => {
      // Releasing says "the owner may change this again", not "staff never set this".
      // Wiping the provenance would erase a true record of who set the value on display.
      const accountId = newAccount();
      const set = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C, desk 14", expectedSetAt: null } },
      });
      const setAt = set.profile.fieldState?.location?.setAt?.toISOString();

      const profile = await releaseField({ accountId, field: "location", staff });

      expect(profile.fieldState?.location?.controlledBy).toBe("owner");
      expect(profile.location).toBe("Block C, desk 14");
      expect(profile.fieldState?.location?.setByName).toBe("Ayesha Khan");
      expect(profile.fieldState?.location?.setAt?.toISOString()).toBe(setAt);
    });

    it("FS-010: refuses a release on a field the owner already controls", async () => {
      const accountId = newAccount();
      await SupportProfile.create({ accountId });
      await expect(releaseField({ accountId, field: "location", staff })).rejects.toMatchObject({
        code: "FIELD_NOT_STAFF_CONTROLLED",
      });
    });

    it("FS-011: releasing one field does not release another", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          location: { value: "Block C", expectedSetAt: null },
          hardware: { value: "HP ProBook", expectedSetAt: null },
        },
      });

      const profile = await releaseField({ accountId, field: "location", staff });
      expect(profile.fieldState?.location?.controlledBy).toBe("owner");
      expect(profile.fieldState?.hardware?.controlledBy).toBe("staff");
    });
  });

  describe("an owner write", () => {
    it("FS-012: applies an owner-controlled field and records the owner as its author", async () => {
      const accountId = newAccount();
      const { results, profile } = await setFieldsAsOwner({
        accountId,
        owner,
        fields: { location: "Block A, desk 2" },
      });

      expect(results.location).toEqual({ outcome: "applied" });
      expect(profile.location).toBe("Block A, desk 2");
      expect(profile.fieldState?.location?.setByKind).toBe("owner");
      expect(profile.fieldState?.location?.setByName).toBe("Sara Alkaff");
      expect(profile.fieldState?.location?.controlledBy).toBe("owner");
    });

    it("FS-013: refuses a staff-controlled field with who set it and when", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });

      const { results, profile } = await setFieldsAsOwner({
        accountId,
        owner,
        fields: { location: "Block A" },
      });

      expect(results.location).toMatchObject({
        outcome: "locked",
        currentSetByName: "Ayesha Khan",
      });
      expect(profile.location).toBe("Block C");
    });

    it("FS-014: applies the fields the owner still controls in the same request", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });

      const { results, profile } = await setFieldsAsOwner({
        accountId,
        owner,
        fields: { location: "Block A", hardware: "My own laptop" },
      });

      expect(results.location?.outcome).toBe("locked");
      expect(results.hardware?.outcome).toBe("applied");
      expect(profile.hardware).toBe("My own laptop");
    });

    it("FS-015: an owner write never moves control, so it cannot take a field back", async () => {
      // If writing took the field back, the release would mean nothing.
      const accountId = newAccount();
      const { profile } = await setFieldsAsOwner({
        accountId,
        owner,
        fields: { hardware: "My own laptop" },
      });
      expect(profile.fieldState?.hardware?.controlledBy).toBe("owner");

      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          hardware: {
            value: "HP ProBook",
            expectedSetAt: profile.fieldState?.hardware?.setAt?.toISOString() ?? null,
          },
        },
      });

      const after = await setFieldsAsOwner({
        accountId,
        owner,
        fields: { hardware: "My own laptop again" },
      });
      expect(after.results.hardware?.outcome).toBe("locked");
      expect(after.profile.fieldState?.hardware?.controlledBy).toBe("staff");
    });
  });

  describe("history", () => {
    it("FS-016: a staff write over an owner-controlled field appends both a value and a control entry", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });

      const history = await getFieldHistory(accountId, "location");
      expect(history.map((entry) => entry.changeKind).sort()).toEqual(["control", "value"]);
    });

    it("FS-017: a second staff write on an already staff-controlled field appends only a value entry", async () => {
      // Control did not move the second time, so there is no control event to record.
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          location: {
            value: "Block D",
            expectedSetAt: first.profile.fieldState?.location?.setAt?.toISOString() ?? null,
          },
        },
      });

      const history = await getFieldHistory(accountId, "location");
      expect(history.filter((entry) => entry.changeKind === "control")).toHaveLength(1);
      expect(history.filter((entry) => entry.changeKind === "value")).toHaveLength(2);
    });

    it("FS-018: set then release then set records three control transfers, newest first", async () => {
      // tasks.md describes this walk as "three ordered entries". Three *control*
      // transfers is what it means: owner to staff, back to owner, and to staff again.
      // The full history is five entries, because two of the three operations also
      // changed the value and data-model.md §4 requires one entry per event rather than
      // one per request.
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });
      await releaseField({ accountId, field: "location", staff });
      await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: {
          location: {
            value: "Block D",
            expectedSetAt: first.profile.fieldState?.location?.setAt?.toISOString() ?? null,
          },
        },
      });

      const history = await getFieldHistory(accountId, "location");
      const controls = history.filter((entry) => entry.changeKind === "control");
      expect(controls.map((entry) => entry.newControlledBy)).toEqual(["staff", "owner", "staff"]);
      expect(history).toHaveLength(5);
    });

    it("FS-019: a value entry records what the field held before, not what it became", async () => {
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { location: { value: "Block C", expectedSetAt: null } },
      });
      await setFieldsAsStaff({
        accountId,
        staff: otherStaff,
        fields: {
          location: {
            value: "Block D",
            expectedSetAt: first.profile.fieldState?.location?.setAt?.toISOString() ?? null,
          },
        },
      });

      const history = await getFieldHistory(accountId, "location");
      const latestValue = history.find((entry) => entry.changeKind === "value");
      expect(latestValue?.previousValue).toBe("Block C");
      expect(latestValue?.previousSetByName).toBe("Ayesha Khan");
      expect(latestValue?.actorName).toBe("Omar Haddad");
    });

    it("FS-020: clearing a field preserves the value it held", async () => {
      // The point of the history: a value staff clear by mistake is still recoverable by
      // reading, because nothing overwrites the entry that holds it.
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: { hardware: { value: "Dell Latitude 5440", expectedSetAt: null } },
      });
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          hardware: {
            value: "",
            expectedSetAt: first.profile.fieldState?.hardware?.setAt?.toISOString() ?? null,
          },
        },
      });

      const history = await getFieldHistory(accountId, "hardware");
      expect(history[0]?.previousValue).toBe("Dell Latitude 5440");
    });

    it("FS-021: a cleared list field preserves its entries", async () => {
      const accountId = newAccount();
      const first = await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          remoteAccessIds: { value: [{ tool: "TeamViewer", id: "111" }], expectedSetAt: null },
        },
      });
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          remoteAccessIds: {
            value: [],
            expectedSetAt: first.profile.fieldState?.remoteAccessIds?.setAt?.toISOString() ?? null,
          },
        },
      });

      const history = await getFieldHistory(accountId, "remoteAccessIds");
      expect(history[0]?.previousValue).toEqual([{ tool: "TeamViewer", id: "111" }]);
    });

    it("FS-022: an owner write appends a value entry even though the owner cannot read it back", async () => {
      // FR-018 retains every field's previous value regardless of who wrote it. Absence
      // of an owner-facing route is the access control, not absence of the record.
      const accountId = newAccount();
      await setFieldsAsOwner({ accountId, owner, fields: { location: "Block A" } });

      const history = await getFieldHistory(accountId, "location");
      expect(history).toHaveLength(1);
      expect(history[0]?.actorKind).toBe("owner");
      expect(history[0]?.changeKind).toBe("value");
    });

    it("FS-023: history is scoped to one field", async () => {
      const accountId = newAccount();
      await setFieldsAsStaff({
        accountId,
        staff,
        fields: {
          location: { value: "Block C", expectedSetAt: null },
          hardware: { value: "HP ProBook", expectedSetAt: null },
        },
      });

      expect(await getFieldHistory(accountId, "location")).toHaveLength(2);
      expect(await getFieldHistory(accountId, "hardware")).toHaveLength(2);
    });

    it("FS-024: a pre-feature correction never appears in history", async () => {
      // FR-025. The corrections were annotations beside a value, not changes to it, and
      // no migration seeds them here.
      const accountId = newAccount();
      await SupportProfile.create({
        accountId,
        location: "Block B",
        staffEntries: [
          {
            kind: "correction",
            field: "location",
            value: "Asset record says Block C",
            staffId: staff.id,
            staffName: staff.name,
            at: new Date(),
          },
        ],
      });

      expect(await getFieldHistory(accountId, "location")).toEqual([]);
    });
  });
});
