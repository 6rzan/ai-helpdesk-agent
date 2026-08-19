import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";
import { ACTION_OUTCOMES, ACTION_TIERS, ACTORS, REFUSAL_REASONS } from "./enums.js";

// data-model.md §5 "Action Record" — the immutable audit entry for every
// executed AND refused action (FR-009, FR-010). This is the evidence artifact
// the whole feature is judged on, so immutability is enforced structurally
// below, not by convention (R7).

// Embedded on both the Approval Request and here (data-model.md §4 "ConsentRecord").
const consentRecordSchema = new Schema(
  {
    given: { type: Boolean, required: true },
    byAccountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    at: { type: Date, required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
  },
  { _id: false },
);

const approvalReferenceSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: "ApprovalRequest", required: true },
    byAccountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    displayName: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const authorisationRecordSchema = new Schema(
  {
    consent: { type: consentRecordSchema, required: false, default: null },
    approval: { type: approvalReferenceSchema, required: false, default: null },
  },
  { _id: false },
);

const verificationSchema = new Schema(
  {
    entryId: { type: String, required: true },
    outcome: { type: String, enum: ACTION_OUTCOMES, required: true },
    observedOutput: { type: String, required: false, default: null },
  },
  { _id: false },
);

const actionRecordSchema = new Schema(
  {
    at: { type: Date, required: true, default: () => new Date(), index: true },
    actor: { type: String, enum: ACTORS, required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: false, default: null, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, default: null },
    classifiedIntent: { type: String, required: true },
    policyEntryId: { type: String, required: false, default: null },
    tier: { type: String, enum: ACTION_TIERS, required: false, default: null },
    requestedAction: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    endpointId: { type: String, required: false, default: null },
    authorisation: { type: authorisationRecordSchema, required: true, default: () => ({}) },
    outcome: { type: String, enum: ACTION_OUTCOMES, required: true },
    refusalReason: { type: String, enum: REFUSAL_REASONS, required: false, default: null },
    observedOutput: { type: String, required: false, default: null },
    verification: { type: verificationSchema, required: false, default: null },
    durationMs: { type: Number, required: false, default: null },
  },
  { timestamps: false, strict: "throw" },
);

// R7: no route, service, or repository function may update or delete an
// action record, from any surface, under any role. These hooks make that a
// property of the schema rather than a property of every caller's discipline.
const MUTATION_ERROR = "ActionRecord is append-only: updates and deletes are not permitted (Constitution Principle II)";

function rejectMutation(this: unknown): never {
  throw new Error(MUTATION_ERROR);
}

actionRecordSchema.pre("findOneAndUpdate", rejectMutation);
actionRecordSchema.pre("updateOne", rejectMutation);
actionRecordSchema.pre("updateMany", rejectMutation);
actionRecordSchema.pre("deleteOne", rejectMutation);
actionRecordSchema.pre("deleteMany", rejectMutation);
actionRecordSchema.pre("findOneAndDelete", rejectMutation);

export type ActionRecordDoc = InferSchemaType<typeof actionRecordSchema> & { _id: Types.ObjectId };
export const ActionRecord: Model<ActionRecordDoc> =
  (mongoose.models.ActionRecord as Model<ActionRecordDoc> | undefined) ?? model<ActionRecordDoc>("ActionRecord", actionRecordSchema);
