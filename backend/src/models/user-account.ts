import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ACCOUNT_ROLES, AVAILABILITY_STATUSES } from "./enums.js";

const userAccountSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    displayName: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 80,
    },
    role: {
      type: String,
      enum: ACCOUNT_ROLES,
      required: true,
      default: "user",
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    passwordSalt: {
      type: String,
      required: true,
      select: false,
    },
    usingInitialPassword: {
      type: Boolean,
      required: true,
      default: false,
    },
    availability: {
      type: String,
      enum: AVAILABILITY_STATUSES,
      default: "available",
    },
  },
  { timestamps: true },
);

export type UserAccountDoc = InferSchemaType<typeof userAccountSchema>;
export const UserAccount: Model<UserAccountDoc> = (mongoose.models.UserAccount as Model<UserAccountDoc> | undefined) ?? model<UserAccountDoc>("UserAccount", userAccountSchema);
