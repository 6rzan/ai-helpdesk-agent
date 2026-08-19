import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";
import { APPROVAL_STATUSES } from "./enums.js";

// data-model.md §4 "Approval Request" — one pending state-changing action
// awaiting a named staff member's decision (FR-004a, FR-004b). Nothing
// state-changing executes without one. Deciding is always a conditional
// update on `status: "pending"` (approval-service.ts), never a plain save,
// so concurrent decisions resolve with the first writer winning (R6).

const consentRecordSchema = new Schema(
  {
    given: { type: Boolean, required: true },
    byAccountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    at: { type: Date, required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
  },
  { _id: false },
);

const decidedBySchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    displayName: { type: String, required: true },
  },
  { _id: false },
);

const approvalRequestSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    policyEntryId: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    endpointId: { type: String, required: true },
    consent: { type: consentRecordSchema, required: true },
    status: { type: String, enum: APPROVAL_STATUSES, required: true, default: "pending" },
    raisedAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    decidedBy: { type: decidedBySchema, required: false, default: null },
    decidedAt: { type: Date, required: false, default: null },
    closureReason: { type: String, required: false, default: null },
    resultingActionRecordId: { type: Schema.Types.ObjectId, ref: "ActionRecord", required: false, default: null },
  },
  { timestamps: false },
);

export type ApprovalRequestDoc = InferSchemaType<typeof approvalRequestSchema> & { _id: Types.ObjectId };
export const ApprovalRequest: Model<ApprovalRequestDoc> =
  (mongoose.models.ApprovalRequest as Model<ApprovalRequestDoc> | undefined) ??
  model<ApprovalRequestDoc>("ApprovalRequest", approvalRequestSchema);
