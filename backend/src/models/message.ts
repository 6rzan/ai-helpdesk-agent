import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";
import { INPUT_ORIGINS, MESSAGE_AUTHORS } from "./enums.js";

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    author: {
      type: String,
      enum: MESSAGE_AUTHORS,
      required: true,
    },
    text: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 4000,
    },
    inputOrigin: {
      type: String,
      enum: INPUT_ORIGINS,
      required: true,
      default: "typed",
    },
    sentAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    guidance: {
      type: new Schema(
        {
          stepIndex: { type: Number, required: true },
          stepCount: { type: Number, required: true },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export const Message: Model<MessageDoc> = (mongoose.models.Message as Model<MessageDoc> | undefined) ?? model<MessageDoc>("Message", messageSchema);
