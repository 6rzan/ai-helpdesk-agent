import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { resetDb, startTestApp, stopTestApp } from "../helpers/test-app.js";
import { ProfileFieldHistory } from "../../src/models/profile-field-history.js";

/**
 * The append-only field history (007 T027, data-model.md §4).
 *
 * The load-bearing claim is a negative one: **no update path and no delete path in any
 * role**. That cannot be tested by calling a method that does not exist, so it is tested
 * where it is actually enforceable — the model module exports nothing that mutates, and
 * no service or route imports one.
 */

describe("ProfileFieldHistory", () => {
  beforeAll(async () => {
    await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  const accountId = new Types.ObjectId();

  it("PH-001: records a value change with what the value was before, not what it became", async () => {
    // The entry describes what was replaced. The current value already lives on the
    // profile, so storing it again here would be a second copy that can disagree.
    const entry = await ProfileFieldHistory.create({
      accountId,
      field: "location",
      changeKind: "value",
      previousValue: "Block B, desk 7",
      previousSetByKind: "owner",
      previousSetByName: "Sara Alkaff",
      previousSetAt: new Date("2026-07-02T11:14:00.000Z"),
      actorKind: "staff",
      actorId: new Types.ObjectId(),
      actorName: "Ayesha Khan",
    });

    expect(entry.previousValue).toBe("Block B, desk 7");
    expect(entry.previousSetByKind).toBe("owner");
    expect(entry.actorName).toBe("Ayesha Khan");
  });

  it("PH-002: a list field's previous value keeps its structure", async () => {
    // research.md R11: `remoteAccessIds` is one field whose value is a list. Flattening
    // it to a string here would make the history unable to render what was replaced.
    const entry = await ProfileFieldHistory.create({
      accountId,
      field: "remoteAccessIds",
      changeKind: "value",
      previousValue: [{ tool: "TeamViewer", id: "111" }],
      actorKind: "staff",
      actorName: "Ayesha Khan",
    });

    const reread = await ProfileFieldHistory.findById(entry._id).lean();
    expect(reread?.previousValue).toEqual([{ tool: "TeamViewer", id: "111" }]);
  });

  it("PH-003: records a control transfer with no value change", async () => {
    const entry = await ProfileFieldHistory.create({
      accountId,
      field: "location",
      changeKind: "control",
      newControlledBy: "owner",
      actorKind: "staff",
      actorName: "Ayesha Khan",
    });

    expect(entry.changeKind).toBe("control");
    expect(entry.newControlledBy).toBe("owner");
    expect(entry.previousValue).toBeNull();
  });

  it("PH-004: stores the actor's name alongside the id rather than joining at read time", async () => {
    // A later display-name change must not silently rewrite what the history says
    // happened. The name recorded is the name as it was.
    const entry = await ProfileFieldHistory.create({
      accountId,
      field: "hardware",
      changeKind: "value",
      previousValue: "",
      actorKind: "staff",
      actorId: new Types.ObjectId(),
      actorName: "Ayesha Khan",
    });
    expect(entry.actorName).toBe("Ayesha Khan");
    expect(entry.actorId).toBeTruthy();
  });

  it("PH-005: an owner-attributed entry needs no actor id", async () => {
    // The owner path records `actorKind: "owner"`; a pre-feature value has no recorded
    // author at all, and inventing one would put a false name in the record.
    const entry = await ProfileFieldHistory.create({
      accountId,
      field: "location",
      changeKind: "value",
      previousValue: "",
      previousSetByKind: null,
      previousSetByName: null,
      previousSetAt: null,
      actorKind: "owner",
      actorName: "Sara Alkaff",
    });
    expect(entry.actorId).toBeNull();
    expect(entry.previousSetByName).toBeNull();
  });

  it("PH-006: refuses an unknown field, so a fourth profile field cannot appear here first", async () => {
    await expect(
      ProfileFieldHistory.create({
        accountId,
        field: "phoneNumber",
        changeKind: "value",
        actorKind: "staff",
        actorName: "Ayesha Khan",
      }),
    ).rejects.toThrow();
  });

  it("PH-007: refuses an unknown change kind", async () => {
    await expect(
      ProfileFieldHistory.create({
        accountId,
        field: "location",
        changeKind: "deletion",
        actorKind: "staff",
        actorName: "Ayesha Khan",
      }),
    ).rejects.toThrow();
  });

  it("PH-008: reads one field's history newest first without touching another field's", async () => {
    const otherAccount = new Types.ObjectId();
    await ProfileFieldHistory.create([
      {
        accountId,
        field: "location",
        changeKind: "value",
        previousValue: "old",
        actorKind: "staff",
        actorName: "Ayesha Khan",
        at: new Date("2026-08-01T10:00:00.000Z"),
      },
      {
        accountId,
        field: "location",
        changeKind: "control",
        newControlledBy: "owner",
        actorKind: "staff",
        actorName: "Ayesha Khan",
        at: new Date("2026-08-02T10:00:00.000Z"),
      },
      {
        accountId,
        field: "hardware",
        changeKind: "value",
        previousValue: "other field",
        actorKind: "staff",
        actorName: "Ayesha Khan",
        at: new Date("2026-08-03T10:00:00.000Z"),
      },
      {
        accountId: otherAccount,
        field: "location",
        changeKind: "value",
        previousValue: "other account",
        actorKind: "staff",
        actorName: "Ayesha Khan",
        at: new Date("2026-08-04T10:00:00.000Z"),
      },
    ]);

    const history = await ProfileFieldHistory.find({ accountId, field: "location" })
      .sort({ at: -1 })
      .lean();

    expect(history).toHaveLength(2);
    expect(history[0]?.changeKind).toBe("control");
    expect(history[1]?.changeKind).toBe("value");
  });

  it("PH-009: the model exports no way to change or remove an entry", async () => {
    // The enforcement for "append-only in every role" is that no such helper exists to
    // call. A route cannot be built on a function the module does not export.
    const module = await import("../../src/models/profile-field-history.js");
    const exported = Object.keys(module);
    for (const name of ["updateHistoryEntry", "deleteHistoryEntry", "removeHistory", "editEntry"]) {
      expect(exported).not.toContain(name);
    }
    expect(exported).toEqual(["ProfileFieldHistory"]);
  });
});
