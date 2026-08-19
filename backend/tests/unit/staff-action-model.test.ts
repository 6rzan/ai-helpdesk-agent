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
});
