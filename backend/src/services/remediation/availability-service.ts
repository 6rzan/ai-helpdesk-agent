import { Types, type HydratedDocument } from "mongoose";
import { getOrCreateRemediationSettings } from "../../models/remediation-settings.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import type { UserAccountDoc } from "../../models/user-account.js";
import { getPolicy } from "../../policy/policy-loader.js";
import { publishStaffEvent } from "../../api/sse/event-bus.js";

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

export interface RemediationEndpointAvailability {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
}

export interface RemediationAvailabilitySummary {
  globallyEnabled: boolean;
  endpoints: RemediationEndpointAvailability[];
}

/** GET /staff/remediation (contracts/api.md): the current posture across the
 * whole registry, not just the one endpoint isRemediationAvailable checks. */
export async function getRemediationSummary(): Promise<RemediationAvailabilitySummary> {
  const settings = await getOrCreateRemediationSettings();
  const policy = getPolicy();
  const endpoints = [...policy.endpoints.values()].map((endpoint) => ({
    id: endpoint.id,
    label: endpoint.label,
    enabled: !settings.disabledEndpointIds.includes(endpoint.id),
    description: endpoint.description,
  }));
  return { globallyEnabled: settings.globallyEnabled, endpoints };
}

export type ToggleRemediationInput =
  | { scope: "global"; enabled: boolean; staff: HydratedDocument<UserAccountDoc> }
  | { scope: "endpoint"; endpointId: string; enabled: boolean; staff: HydratedDocument<UserAccountDoc> };

/** POST /staff/remediation/toggle (contracts/api.md, FR-008, FR-022): the
 * asymmetric kill switch. Takes effect against anything not already
 * executing (R6, edge case) since the gate above is read fresh every time,
 * never cached. Every toggle is an attributed StaffActionRecord. */
export async function toggleRemediation(input: ToggleRemediationInput): Promise<RemediationAvailabilitySummary> {
  const settings = await getOrCreateRemediationSettings();
  if (input.scope === "global") {
    settings.globallyEnabled = input.enabled;
  } else {
    const disabled = new Set(settings.disabledEndpointIds);
    if (input.enabled) {
      disabled.delete(input.endpointId);
    } else {
      disabled.add(input.endpointId);
    }
    settings.disabledEndpointIds = [...disabled];
  }
  settings.updatedAt = new Date();
  await settings.save();

  await StaffActionRecord.create({
    staffId: input.staff._id,
    staffName: input.staff.displayName,
    action: "remediation_toggle",
    targetType: "remediation",
    targetId: new Types.ObjectId(),
    details:
      input.scope === "global"
        ? { scope: "global", enabled: input.enabled }
        : { scope: "endpoint", endpointId: input.endpointId, enabled: input.enabled },
  });

  publishStaffEvent("remediation_availability_changed", {
    globallyEnabled: settings.globallyEnabled,
    disabledEndpointIds: settings.disabledEndpointIds,
  });

  return getRemediationSummary();
}
