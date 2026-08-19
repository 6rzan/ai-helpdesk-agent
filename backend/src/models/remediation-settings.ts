import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { config } from "../config/index.js";

// data-model.md §3 "Remediation Availability" — the staff-controlled kill
// switch (FR-008, FR-022). Operational, not policy: staff change it at
// runtime, which is exactly why it must not live in the policy files
// (contrast with policy-loader.ts, which is never written).

export const REMEDIATION_SETTINGS_ID = "singleton";

const remediationSettingsSchema = new Schema(
  {
    _id: { type: String, default: REMEDIATION_SETTINGS_ID },
    globallyEnabled: { type: Boolean, required: true, default: () => config.REMEDIATION_ENABLED },
    disabledEndpointIds: { type: [String], default: [] },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

export type RemediationSettingsDoc = InferSchemaType<typeof remediationSettingsSchema>;
export const RemediationSettings: Model<RemediationSettingsDoc> =
  (mongoose.models.RemediationSettings as Model<RemediationSettingsDoc> | undefined) ??
  model<RemediationSettingsDoc>("RemediationSettings", remediationSettingsSchema);

/** Reads the singleton, creating it with config defaults on first access. */
export async function getOrCreateRemediationSettings(): Promise<InstanceType<typeof RemediationSettings>> {
  const existing = await RemediationSettings.findById(REMEDIATION_SETTINGS_ID);
  if (existing) {
    return existing;
  }
  return RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID });
}
