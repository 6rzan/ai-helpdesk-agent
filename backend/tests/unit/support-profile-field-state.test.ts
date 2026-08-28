import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { resetDb, startTestApp, stopTestApp } from "../helpers/test-app.js";
import { SupportProfile } from "../../src/models/support-profile.js";

/**
 * `fieldState` on the support profile (007 T028, data-model.md §3.2, research.md R8).
 *
 * **No migration runs.** The claim this file exists to hold is that a document written
 * before this feature reads back as owner-controlled with null authorship, so the two
 * releases can coexist and nobody has to invent an author for values that were set
 * without one recorded.
 *
 * The pre-feature documents are written through the raw collection, bypassing mongoose's
 * defaults, because a document inserted through the model would already carry the new
 * sub-document and prove nothing.
 */

describe("SupportProfile.fieldState", () => {
  beforeAll(async () => {
    await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  /** Writes a document the way it existed before this feature: no `fieldState` at all. */
  async function insertPreFeatureProfile(accountId: Types.ObjectId) {
    await mongoose.connection.collection("supportprofiles").insertOne({
      accountId,
      remoteAccessIds: [{ tool: "TeamViewer", id: "111" }],
      location: "Block B, desk 7",
      hardware: "Dell Latitude 5440",
      staffEntries: [
        {
          kind: "correction",
          field: "location",
          value: "Asset record says Block C",
          staffId: new Types.ObjectId(),
          staffName: "Ayesha Khan",
          at: new Date("2026-07-02T11:14:00.000Z"),
        },
      ],
      createdAt: new Date("2026-07-01T09:00:00.000Z"),
      updatedAt: new Date("2026-07-02T11:14:00.000Z"),
    });
  }

  it("SP-001: a pre-feature document still reads its values back unchanged", async () => {
    const accountId = new Types.ObjectId();
    await insertPreFeatureProfile(accountId);

    const profile = await SupportProfile.findOne({ accountId });
    expect(profile?.location).toBe("Block B, desk 7");
    expect(profile?.hardware).toBe("Dell Latitude 5440");
    expect(profile?.remoteAccessIds).toHaveLength(1);
  });

  it("SP-002: a pre-feature document's fields read as owner-controlled with no recorded author", async () => {
    const accountId = new Types.ObjectId();
    await insertPreFeatureProfile(accountId);

    const profile = await SupportProfile.findOne({ accountId });
    for (const field of ["location", "hardware", "remoteAccessIds"] as const) {
      const state = profile?.fieldState?.[field];
      expect(state?.controlledBy ?? "owner").toBe("owner");
      expect(state?.setByName ?? null).toBeNull();
      expect(state?.setAt ?? null).toBeNull();
    }
  });

  it("SP-003: a pre-feature correction stays a staff entry and does not become a value", async () => {
    // FR-025. The correction was written as an annotation beside the owner's value, and
    // promoting it to the value now would change what the record says staff did.
    const accountId = new Types.ObjectId();
    await insertPreFeatureProfile(accountId);

    const profile = await SupportProfile.findOne({ accountId });
    expect(profile?.location).toBe("Block B, desk 7");
    expect(profile?.staffEntries).toHaveLength(1);
    expect(profile?.staffEntries[0]?.kind).toBe("correction");
  });

  it("SP-004: a new document defaults every field to owner control", async () => {
    const accountId = new Types.ObjectId();
    const profile = await SupportProfile.create({ accountId });

    expect(profile.fieldState?.location?.controlledBy).toBe("owner");
    expect(profile.fieldState?.hardware?.controlledBy).toBe("owner");
    expect(profile.fieldState?.remoteAccessIds?.controlledBy).toBe("owner");
  });

  it("SP-005: a field can be recorded as staff-controlled with its author and time", async () => {
    const accountId = new Types.ObjectId();
    const staffId = new Types.ObjectId();
    const setAt = new Date("2026-08-28T14:31:07.000Z");

    await SupportProfile.create({
      accountId,
      location: "Block C, desk 14",
      fieldState: {
        location: {
          setByKind: "staff",
          setById: staffId,
          setByName: "Ayesha Khan",
          setAt,
          controlledBy: "staff",
        },
      },
    });

    const profile = await SupportProfile.findOne({ accountId });
    expect(profile?.fieldState?.location?.controlledBy).toBe("staff");
    expect(profile?.fieldState?.location?.setByName).toBe("Ayesha Khan");
    expect(profile?.fieldState?.location?.setAt?.toISOString()).toBe(setAt.toISOString());
    // The other two are untouched: control is per field, not per document.
    expect(profile?.fieldState?.hardware?.controlledBy).toBe("owner");
  });

  it("SP-006: fieldState holds these three fields and no fourth (FR-028)", async () => {
    const accountId = new Types.ObjectId();
    await SupportProfile.create({
      accountId,
      // A fourth field is not in the schema, so mongoose drops it rather than storing it.
      fieldState: { location: {}, phoneNumber: { controlledBy: "staff" } },
    } as never);

    const stored = await mongoose.connection
      .collection("supportprofiles")
      .findOne({ accountId });
    expect(Object.keys((stored?.["fieldState"] ?? {}) as Record<string, unknown>).sort()).toEqual([
      "hardware",
      "location",
      "remoteAccessIds",
    ]);
  });

  it("SP-007: an unknown controlledBy value is refused", async () => {
    await expect(
      SupportProfile.create({
        accountId: new Types.ObjectId(),
        fieldState: { location: { controlledBy: "maintainer" } },
      } as never),
    ).rejects.toThrow();
  });
});
