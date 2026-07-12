import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { CONVERSATION_STATES } from "./enums.js";

const conversationSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "Reporter",
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: CONVERSATION_STATES,
      default: "active",
    },
    clarificationRounds: {
      type: Number,
      min: 0,
      max: 2,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: () => new Date(),
    },
    // Set when a report matches an existing not-closed ticket: the classified
    // report is parked here until the user says whether it is the same problem.
    pendingDuplicate: {
      type: new Schema(
        {
          category: { type: String, required: true },
          confidence: { type: Number, required: true },
          description: { type: String, required: true },
          reply: { type: String, required: true },
          existingReference: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & { _id: Types.ObjectId };
export const Conversation = model("Conversation", conversationSchema);
