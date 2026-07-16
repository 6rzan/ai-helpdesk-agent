import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const categorySchema = new Schema(
  {
    name: {
      // Unique lowercase snake_case slug, immutable after creation (data-model.md).
      type: String,
      required: true,
      unique: true,
      minlength: 1,
      maxlength: 60,
    },
    displayName: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 60,
    },
    classificationDescription: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 500,
    },
    mandated: {
      type: Boolean,
      required: true,
      default: false,
    },
    retired: {
      type: Boolean,
      required: true,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { timestamps: false },
);

export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: import("mongoose").Types.ObjectId };
export const Category: Model<CategoryDoc> = (mongoose.models.Category as Model<CategoryDoc> | undefined) ?? model<CategoryDoc>("Category", categorySchema, "categories");
