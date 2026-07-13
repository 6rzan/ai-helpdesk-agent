import { Schema, model, type InferSchemaType } from "mongoose";

const authSessionSchema = new Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: "UserAccount",
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
});

authSessionSchema.index({ accountId: 1 });

export type AuthSessionDoc = InferSchemaType<typeof authSessionSchema>;
export const AuthSession = model("AuthSession", authSessionSchema);
