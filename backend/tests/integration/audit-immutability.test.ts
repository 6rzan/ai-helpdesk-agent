import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { ActionRecord } from "../../src/models/action-record.js";

// T018: the append-only audit trail (R7, FR-010). Every mutation path must
// throw before any actual write happens — this is what "no code path updates
// or deletes an action record" means as a tested property, not a promise.
describe("ActionRecord — immutability", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  async function seedRecord() {
    return ActionRecord.create({
      actor: "agent",
      ticketId: new Types.ObjectId(),
      classifiedIntent: "check service status",
      policyEntryId: "service-status",
      tier: "read_only",
      requestedAction: "service-status widget-service",
      arguments: { service: "widget-service" },
      endpointId: "test-node-a",
      authorisation: {},
      outcome: "succeeded",
    });
  }

  it("throws on findOneAndUpdate", async () => {
    const record = await seedRecord();
    await expect(ActionRecord.findOneAndUpdate({ _id: record._id }, { outcome: "failed" })).rejects.toThrow(
      /append-only/,
    );
  });

  it("throws on updateOne", async () => {
    const record = await seedRecord();
    await expect(ActionRecord.updateOne({ _id: record._id }, { outcome: "failed" })).rejects.toThrow(/append-only/);
  });

  it("throws on updateMany", async () => {
    await seedRecord();
    await expect(ActionRecord.updateMany({}, { outcome: "failed" })).rejects.toThrow(/append-only/);
  });

  it("throws on deleteOne", async () => {
    const record = await seedRecord();
    await expect(ActionRecord.deleteOne({ _id: record._id })).rejects.toThrow(/append-only/);
  });

  it("throws on deleteMany", async () => {
    await seedRecord();
    await expect(ActionRecord.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("throws on findOneAndDelete", async () => {
    const record = await seedRecord();
    await expect(ActionRecord.findOneAndDelete({ _id: record._id })).rejects.toThrow(/append-only/);
  });

  it("still permits create and read", async () => {
    const record = await seedRecord();
    const found = await ActionRecord.findById(record._id);
    expect(found?.outcome).toBe("succeeded");
  });
});
