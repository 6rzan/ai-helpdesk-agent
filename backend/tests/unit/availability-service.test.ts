import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { isRemediationAvailable } from "../../src/services/remediation/availability-service.js";

// T022: execution is permitted only when globally enabled AND the target
// endpoint is not individually disabled, and the check is re-evaluated
// immediately before execution rather than cached per turn (data-model.md §3).
describe("availability-service.isRemediationAvailable", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("is unavailable when no settings document exists yet (default false)", async () => {
    expect(await isRemediationAvailable("test-node-a")).toBe(false);
  });

  it("is available when globally enabled and the endpoint is not disabled", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    expect(await isRemediationAvailable("test-node-a")).toBe(true);
  });

  it("is unavailable when globally disabled even if the endpoint is not individually disabled", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: false, disabledEndpointIds: [] });
    expect(await isRemediationAvailable("test-node-a")).toBe(false);
  });

  it("is unavailable when the specific endpoint is individually disabled", async () => {
    await RemediationSettings.create({
      _id: REMEDIATION_SETTINGS_ID,
      globallyEnabled: true,
      disabledEndpointIds: ["test-node-a"],
    });
    expect(await isRemediationAvailable("test-node-a")).toBe(false);
    expect(await isRemediationAvailable("test-node-b")).toBe(true);
  });

  it("reflects a change made between two calls rather than a cached value", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    expect(await isRemediationAvailable("test-node-a")).toBe(true);

    await RemediationSettings.updateOne({ _id: REMEDIATION_SETTINGS_ID }, { globallyEnabled: false });
    expect(await isRemediationAvailable("test-node-a")).toBe(false);
  });
});
