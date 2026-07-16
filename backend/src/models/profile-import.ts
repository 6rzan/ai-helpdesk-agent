import mongoose, { Schema, model, Types, type Model } from "mongoose";

export const IMPORT_FIELDS = ["email", "displayName", "initialPassword", "remoteAccessId", "location", "hardware"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportMapping = Partial<Record<string, ImportField>>;
export type ImportOutcome = {
  row: number;
  email: string;
  outcome: "created" | "updated" | "rejected";
  reason?: string;
  initialPassword?: string;
};

export interface ProfileImportDoc {
  _id: Types.ObjectId;
  staffId: Types.ObjectId;
  staffName: string;
  filename: string;
  status: "mapping" | "previewed" | "applied" | "aborted";
  columns: string[];
  rows: string[][];
  mapping: ImportMapping;
  rowOutcomes: ImportOutcome[];
  createdAt: Date;
  appliedAt?: Date;
}

const outcomeSchema = new Schema<ImportOutcome>({
  row: { type: Number, required: true },
  email: { type: String, required: true },
  outcome: { type: String, enum: ["created", "updated", "rejected"], required: true },
  reason: String,
  initialPassword: { type: String, select: false },
}, { _id: false });

const profileImportSchema = new Schema<ProfileImportDoc>({
  staffId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
  staffName: { type: String, required: true },
  filename: { type: String, required: true },
  status: { type: String, enum: ["mapping", "previewed", "applied", "aborted"], required: true, default: "mapping" },
  columns: { type: [String], required: true },
  rows: { type: [[String]], required: true },
  mapping: { type: Schema.Types.Mixed, default: {} },
  rowOutcomes: { type: [outcomeSchema], default: [] },
  createdAt: { type: Date, required: true, default: () => new Date() },
  appliedAt: Date,
});

export const ProfileImport: Model<ProfileImportDoc> = (mongoose.models.ProfileImport as Model<ProfileImportDoc> | undefined)
  ?? model<ProfileImportDoc>("ProfileImport", profileImportSchema);
