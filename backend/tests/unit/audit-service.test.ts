import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { recordAction } from "../../src/services/remediation/audit-service.js";
import { ACTION_OUTCOMES, REFUSAL_REASONS } from "../../src/models/enums.js";

// T020: the append-only write API covers a record for every outcome and
// every refusal reason (data-model.md §5).
describe("audit-service.recordAction", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it.each(ACTION_OUTCOMES)("records an action with outcome %s", async (outcome) => {
    const record = await recordAction({
      actor: "agent",
      classifiedIntent: "test intent",
      requestedAction: "test-action",
      outcome,
      ...(outcome === "refused" ? { refusalReason: "no_matching_entry" as const } : {}),
    });
    expect(record.outcome).toBe(outcome);
  });

  it.each(REFUSAL_REASONS)("records a refusal with reason %s", async (refusalReason) => {
    const record = await recordAction({
      actor: "agent",
      classifiedIntent: "test intent",
      requestedAction: "test-action",
      outcome: "refused",
      refusalReason,
    });
    expect(record.outcome).toBe("refused");
    expect(record.refusalReason).toBe(refusalReason);
  });

  it("defaults optional fields to null/empty rather than leaving them undefined", async () => {
    const record = await recordAction({
      actor: "agent",
      classifiedIntent: "test intent",
      requestedAction: "test-action",
      outcome: "succeeded",
    });
    expect(record.ticketId).toBeNull();
    expect(record.policyEntryId).toBeNull();
    expect(record.tier).toBeNull();
    expect(record.endpointId).toBeNull();
    expect(record.authorisation.consent).toBeNull();
    expect(record.authorisation.approval).toBeNull();
    expect(record.verification).toBeNull();
  });
});
