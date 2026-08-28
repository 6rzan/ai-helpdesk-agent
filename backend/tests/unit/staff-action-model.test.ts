import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";

// T011: existing staff-action records still validate, and the two new 005
// values (remediation_toggle, approval_decision on STAFF_ACTIONS; remediation
// on STAFF_ACTION_TARGETS) are accepted.
describe("StaffActionRecord — extended enums", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("still validates a pre-existing staff action kind", async () => {
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Staff One",
      action: "takeover",
      targetType: "ticket",
      targetId: new Types.ObjectId(),
    });
    expect(doc.action).toBe("takeover");
  });

  it("validates the new remediation_toggle action against the remediation target", async () => {
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Staff One",
      action: "remediation_toggle",
      targetType: "remediation",
      targetId: new Types.ObjectId(),
      details: { globallyEnabled: true },
    });
    expect(doc.action).toBe("remediation_toggle");
    expect(doc.targetType).toBe("remediation");
  });

  it("validates the new approval_decision action", async () => {
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Staff One",
      action: "approval_decision",
      targetType: "remediation",
      targetId: new Types.ObjectId(),
      details: { decision: "approved" },
    });
    expect(doc.action).toBe("approval_decision");
  });

  it("rejects an unknown action kind", async () => {
    await expect(
      StaffActionRecord.create({
        staffId: new Types.ObjectId(),
        staffName: "Staff One",
        action: "not_a_real_action",
        targetType: "ticket",
        targetId: new Types.ObjectId(),
      }),
    ).rejects.toThrow();
  });

  // --- 007 T029 --------------------------------------------------------------
  it("SA-007a: validates profile_edit, which names only the fields that were applied", async () => {
    // FR-026. A record naming a field that was refused for a conflict would describe a
    // change that never happened, in the one place the audit is meant to be trusted.
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Ayesha Khan",
      action: "profile_edit",
      targetType: "profile",
      targetId: new Types.ObjectId(),
      details: { fields: ["hardware"] },
    });
    expect(doc.action).toBe("profile_edit");
    expect((doc.details as { fields: string[] }).fields).toEqual(["hardware"]);
  });

  it("SA-007b: validates profile_release against the profile target", async () => {
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Ayesha Khan",
      action: "profile_release",
      targetType: "profile",
      targetId: new Types.ObjectId(),
      details: { field: "location" },
    });
    expect(doc.action).toBe("profile_release");
  });

  it("SA-007c: profile_append is unchanged and still available for notes", async () => {
    // 007 retires the correction *write* path, not the note path. A note is still
    // appended alongside a value rather than replacing one.
    const doc = await StaffActionRecord.create({
      staffId: new Types.ObjectId(),
      staffName: "Ayesha Khan",
      action: "profile_append",
      targetType: "profile",
      targetId: new Types.ObjectId(),
      details: { kind: "note", field: null },
    });
    expect(doc.action).toBe("profile_append");
  });
});
