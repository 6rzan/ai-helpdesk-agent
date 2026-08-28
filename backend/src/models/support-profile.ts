import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";
import { FIELD_ACTOR_KINDS, FIELD_CONTROLS, PROFILE_FIELDS } from "./enums.js";

export const STAFF_ENTRY_KINDS = ["note", "correction"] as const;
export type StaffEntryKind = (typeof STAFF_ENTRY_KINDS)[number];

// Defined in `enums.js` and re-exported here, where every existing caller imports it.
export { PROFILE_FIELDS, type ProfileField } from "./enums.js";

// Append-only staff annotations (FR-012 hybrid form). A `correction` records a value
// alongside a user field without ever overwriting the owner's own value — both render
// side by side (data-model.md).
const staffEntrySchema = new Schema(
  {
    kind: { type: String, enum: STAFF_ENTRY_KINDS, required: true },
    field: { type: String, enum: PROFILE_FIELDS, required: false, default: null },
    value: { type: String, required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    staffName: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const remoteAccessIdSchema = new Schema(
  {
    tool: { type: String, required: true },
    id: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Per-field provenance and control (007 T028, data-model.md §3.2).
 *
 * Every field is optional and `controlledBy` defaults to `"owner"`, which is what makes
 * this a schema change with no migration: a document written before this feature reads
 * back as owner-controlled with null authorship, exactly as it behaved (research.md R8).
 * Inventing an author for those values would put a false name in the record.
 */
const fieldStateSchema = new Schema(
  {
    setByKind: { type: String, enum: FIELD_ACTOR_KINDS, default: null },
    setById: { type: Schema.Types.ObjectId, ref: "UserAccount", default: null },
    setByName: { type: String, default: null },
    setAt: { type: Date, default: null },
    controlledBy: { type: String, enum: FIELD_CONTROLS, default: "owner" },
  },
  { _id: false },
);

// Only support-relevant fields exist — nothing else is requested or stored (FR-015,
// NFR-5). Access is owner + staff only, enforced at the route layer.
const supportProfileSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "UserAccount",
      required: true,
      unique: true,
      index: true,
    },
    remoteAccessIds: { type: [remoteAccessIdSchema], default: [] },
    location: { type: String, default: "" },
    hardware: { type: String, default: "" },
    // `staffEntries` and its `correction` kind stay exactly as they are. 007 retires the
    // *write* path for corrections (T031); the existing entries are a record of what
    // staff wrote and keep rendering unchanged (FR-025).
    staffEntries: { type: [staffEntrySchema], default: [] },
    // One `fieldState` per support field. Named rather than a map so a fourth field
    // cannot appear without a schema change — FR-028 limits the profile to these three.
    fieldState: {
      type: new Schema(
        {
          location: { type: fieldStateSchema, default: () => ({}) },
          hardware: { type: fieldStateSchema, default: () => ({}) },
          remoteAccessIds: { type: fieldStateSchema, default: () => ({}) },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

export type SupportProfileDoc = InferSchemaType<typeof supportProfileSchema> & { _id: Types.ObjectId };
export const SupportProfile: Model<SupportProfileDoc> = (mongoose.models.SupportProfile as Model<SupportProfileDoc> | undefined) ?? model<SupportProfileDoc>("SupportProfile", supportProfileSchema);
