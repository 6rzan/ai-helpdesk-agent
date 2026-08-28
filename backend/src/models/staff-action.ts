import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

export const STAFF_ACTIONS = [
  "takeover",
  "reassign",
  "status_change",
  "resolve",
  "profile_append",
  // 007 T029. `profile_append` stays for notes, which are still appended alongside a
  // value. These two are for the authoritative path: `profile_edit` records staff
  // setting a field's value, `profile_release` records handing it back to the owner.
  // Kept as separate values rather than one "profile_change" because the audit is read
  // to answer "who took this field over" and "who gave it back", and one value would
  // make both queries a details-field scan.
  "profile_edit",
  "profile_release",
  "credential_reset",
  "import_apply",
  // 005: staff decisions over automated remediation (data-model.md §3, FR-022).
  "remediation_toggle",
  "approval_decision",
] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

export const STAFF_ACTION_TARGETS = ["ticket", "profile", "account", "import", "remediation"] as const;
export type StaffActionTarget = (typeof STAFF_ACTION_TARGETS)[number];

// Append-only attribution log for every dashboard action (FR-008). Separate from
// debug logging and not disableable — this is the audit trail (Principle II).
const staffActionSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true, index: true },
    staffName: { type: String, required: true },
    action: { type: String, enum: STAFF_ACTIONS, required: true },
    targetType: { type: String, enum: STAFF_ACTION_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

export type StaffActionDoc = InferSchemaType<typeof staffActionSchema> & { _id: Types.ObjectId };
export const StaffActionRecord: Model<StaffActionDoc> = (mongoose.models.StaffActionRecord as Model<StaffActionDoc> | undefined) ?? model<StaffActionDoc>("StaffActionRecord", staffActionSchema);
