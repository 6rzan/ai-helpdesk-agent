import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

export const STAFF_ENTRY_KINDS = ["note", "correction"] as const;
export type StaffEntryKind = (typeof STAFF_ENTRY_KINDS)[number];

export const PROFILE_FIELDS = ["remoteAccessIds", "location", "hardware"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

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
    staffEntries: { type: [staffEntrySchema], default: [] },
  },
  { timestamps: true },
);

export type SupportProfileDoc = InferSchemaType<typeof supportProfileSchema> & { _id: Types.ObjectId };
export const SupportProfile: Model<SupportProfileDoc> = (models.SupportProfile as Model<SupportProfileDoc> | undefined) ?? model<SupportProfileDoc>("SupportProfile", supportProfileSchema);
