import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { ACTORS, ESCALATION_REASONS, HANDLING_MODES, TICKET_STATUSES } from "./enums.js";

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

// Who currently owns the ticket once a human takes over (FR-007). Absent until the
// first takeover; never cleared (no hand-back to the agent, FR-019).
const assigneeSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    displayName: { type: String, required: true },
    since: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

// Append-only trail of every takeover/reassignment (FR-019).
const assignmentRecordSchema = new Schema(
  {
    assigneeId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    assigneeName: { type: String, required: true },
    byId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    byName: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    kind: { type: String, enum: ["takeover", "reassign"], required: true },
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
    // Set from the signed-in session at creation (FR-003). Absent on legacy tickets
    // created before accounts existed — those stay valid and readable (FR-014).
    reporterAccountId: {
      type: Schema.Types.ObjectId,
      ref: "UserAccount",
      required: false,
      default: null,
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
      // Runtime-validated against the categories collection (+ "unclassified")
      // before a ticket is created — see services/classification/classifier.ts.
      type: String,
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
    assignee: {
      type: assigneeSchema,
      required: false,
      default: null,
    },
    assignmentHistory: {
      type: [assignmentRecordSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export type TicketDoc = InferSchemaType<typeof ticketSchema> & { _id: Types.ObjectId };
export const Ticket = model("Ticket", ticketSchema);
