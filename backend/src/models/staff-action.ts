import { Schema, model, Types, type InferSchemaType } from "mongoose";

export const STAFF_ACTIONS = [
  "takeover",
  "reassign",
  "status_change",
  "resolve",
  "profile_append",
  "credential_reset",
  "import_apply",
] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

export const STAFF_ACTION_TARGETS = ["ticket", "profile", "account", "import"] as const;
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
export const StaffActionRecord = model("StaffActionRecord", staffActionSchema);
