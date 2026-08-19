import { getOrCreateRemediationSettings } from "../../models/remediation-settings.js";

// data-model.md §3: an action may execute only when remediation is globally
// enabled AND its target endpoint is not individually disabled. Deliberately
// uncached — always reads the current document, so a disable takes effect
// against anything not already running (R6), and this must be the very last
// check before the executor is called (policy-engine.ts).
export async function isRemediationAvailable(endpointId: string): Promise<boolean> {
  const settings = await getOrCreateRemediationSettings();
  if (!settings.globallyEnabled) {
    return false;
  }
  return !settings.disabledEndpointIds.includes(endpointId);
}
