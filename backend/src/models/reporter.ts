import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const reporterSchema = new Schema(
  {
    orgId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: /^[A-Za-z0-9._-]+$/,
    },
    displayName: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 60,
    },
  },
  { timestamps: true },
);

export type ReporterDoc = InferSchemaType<typeof reporterSchema>;
export const Reporter: Model<ReporterDoc> = (mongoose.models.Reporter as Model<ReporterDoc> | undefined) ?? model<ReporterDoc>("Reporter", reporterSchema);
