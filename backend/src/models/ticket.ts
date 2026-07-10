import { Schema, model, Types, type InferSchemaType } from "mongoose";
import {
  ACTORS,
  ESCALATION_REASONS,
  HANDLING_MODES,
  ISSUE_CATEGORIES,
  TICKET_STATUSES,
} from "./enums.js";

const transitionRecordSchema = new Schema(
  {
    at: { type: Date, required: true, default: () => new Date() },
    field: { type: String, enum: ["status", "handlingMode"], required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    actor: { type: String, enum: ACTORS, required: true },
  },
  { _id: false },
);

const ticketSchema = new Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "Reporter",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ISSUE_CATEGORIES,
      required: true,
    },
    classificationConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: "open",
    },
    handlingMode: {
      type: String,
      enum: HANDLING_MODES,
      default: "automated",
    },
    escalated: {
      type: Boolean,
      default: false,
    },
    escalationReason: {
      type: String,
      enum: ESCALATION_REASONS,
      default: null,
    },
    history: {
      type: [transitionRecordSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export type TicketDoc = InferSchemaType<typeof ticketSchema> & { _id: Types.ObjectId };
export const Ticket = model("Ticket", ticketSchema);
