import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

export const GUIDED_SESSION_STATES = ["active", "resolved", "escalated", "abandoned"] as const;
export type GuidedSessionState = (typeof GUIDED_SESSION_STATES)[number];

export const STEP_ATTEMPT_OUTCOMES = ["worked", "not_worked", "already_tried", "skipped"] as const;
export type StepAttemptOutcome = (typeof STEP_ATTEMPT_OUTCOMES)[number];

const stepAttemptSchema = new Schema(
  {
    stepIndex: { type: Number, required: true, min: 0 },
    outcome: { type: String, enum: STEP_ATTEMPT_OUTCOMES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const guidedSessionSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
    },
    guideVersion: {
      // Pinned at session start (FR-017): with categoryName this resolves the
      // exact guide document, so mid-session edits never disturb this session.
      type: Number,
      required: true,
    },
    currentStepIndex: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stepAttempts: {
      type: [stepAttemptSchema],
      default: [],
    },
    state: {
      type: String,
      enum: GUIDED_SESSION_STATES,
      required: true,
      default: "active",
    },
  },
  { timestamps: true },
);

// At most one active session per conversation (data-model.md).
guidedSessionSchema.index(
  { conversationId: 1 },
  { unique: true, partialFilterExpression: { state: "active" } },
);

export type GuidedSessionDoc = InferSchemaType<typeof guidedSessionSchema> & { _id: Types.ObjectId };
export const GuidedSession: Model<GuidedSessionDoc> = (models.GuidedSession as Model<GuidedSessionDoc> | undefined) ?? model<GuidedSessionDoc>("GuidedSession", guidedSessionSchema, "guided_sessions");
