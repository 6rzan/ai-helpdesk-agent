import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const guideStepSchema = new Schema(
  {
    instruction: {
      // Canonical plain-language text shown to the user (R4); the LLM may wrap
      // it conversationally but never replaces it.
      type: String,
      required: true,
      minlength: 10,
      maxlength: 800,
    },
    successHint: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 300,
    },
  },
  { _id: false },
);

const guideSchema = new Schema(
  {
    categoryName: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      // Monotonic per category, starts at 1. Versions are never edited or
      // deleted (R7) — an edit inserts version n+1 and flips n's `active` off.
      type: Number,
      required: true,
      min: 1,
    },
    steps: {
      type: [guideStepSchema],
      required: true,
      validate: {
        validator: (steps: unknown[]) => steps.length >= 1 && steps.length <= 20,
        message: "A guide must have between 1 and 20 steps",
      },
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    changedBy: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    changeNote: {
      type: String,
      maxlength: 300,
      default: null,
    },
  },
  { timestamps: false },
);

guideSchema.index({ categoryName: 1, version: 1 }, { unique: true });

export type GuideDoc = InferSchemaType<typeof guideSchema> & { _id: import("mongoose").Types.ObjectId };
export const Guide: Model<GuideDoc> = (models.Guide as Model<GuideDoc> | undefined) ?? model<GuideDoc>("Guide", guideSchema, "guides");
