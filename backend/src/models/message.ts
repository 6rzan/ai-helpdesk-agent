import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { MESSAGE_AUTHORS } from "./enums.js";

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
    sentAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { timestamps: true },
);

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export const Message = model("Message", messageSchema);
