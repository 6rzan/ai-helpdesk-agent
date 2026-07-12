import type { HydratedDocument, Types } from "mongoose";
import { config } from "../../config/index.js";
import { getLlmProvider } from "../llm/factory.js";
import type { ConversationTurn, LlmProvider } from "../llm/types.js";
import { GuidedSession, type GuidedSessionDoc } from "../../models/guided-session.js";
import { Guide, type GuideDoc } from "../../models/guide.js";

export type StepReplyOutcome =
  | "worked"
  | "not_worked"
  | "already_tried"
  | "question"
  | "wants_human"
  | "unclear";

export type StepDecision =
  | { action: "resolve" }
  | { action: "advance"; nextStepIndex: number; attemptOutcome: "not_worked" | "already_tried" }
  | { action: "escalate"; attemptOutcome?: "not_worked" | "already_tried" }
  | { action: "hold" };

// Pure decision function: no DB/LLM/network I/O and no imports of any executor or
// command-running module — every branch only ever returns text-shaping instructions
// for the caller to apply. This keeps the guided flow strictly advisory (Constitution).
export function decideStepTransition(params: {
  outcome: StepReplyOutcome;
  currentStepIndex: number;
  stepCount: number;
}): StepDecision {
  const { outcome, currentStepIndex, stepCount } = params;
  switch (outcome) {
    case "worked":
      return { action: "resolve" };
    case "wants_human":
      return { action: "escalate" };
    case "question":
    case "unclear":
      return { action: "hold" };
    case "not_worked":
    case "already_tried": {
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex >= stepCount) {
        return { action: "escalate", attemptOutcome: outcome };
      }
      return { action: "advance", nextStepIndex, attemptOutcome: outcome };
    }
  }
}

// Step presentation is a deterministic string template, never LLM-generated (R4) —
// only the *interpretation* of the user's reply to a step goes through the LLM.
export function formatStepPrompt(guide: Pick<GuideDoc, "steps">, stepIndex: number): string {
  const step = guide.steps[stepIndex];
  if (!step) {
    throw new Error(`formatStepPrompt: no step at index ${stepIndex}`);
  }
  return `Step ${stepIndex + 1} of ${guide.steps.length}: ${step.instruction}`;
}

export async function findActiveGuide(categoryName: string): Promise<GuideDoc | null> {
  return Guide.findOne({ categoryName, active: true });
}

export async function startGuidedSession(params: {
  conversationId: Types.ObjectId;
  ticketId: Types.ObjectId;
  categoryName: string;
}): Promise<{ session: HydratedDocument<GuidedSessionDoc>; guide: GuideDoc } | null> {
  const guide = await findActiveGuide(params.categoryName);
  if (!guide) {
    return null;
  }
  const session = await GuidedSession.create({
    conversationId: params.conversationId,
    ticketId: params.ticketId,
    categoryName: params.categoryName,
    guideVersion: guide.version,
    currentStepIndex: 0,
    stepAttempts: [],
    state: "active",
  });
  return { session, guide };
}

export async function getActiveSession(
  conversationId: Types.ObjectId,
): Promise<HydratedDocument<GuidedSessionDoc> | null> {
  return GuidedSession.findOne({ conversationId, state: "active" });
}

// Guide version is pinned on the session (FR-017), so a mid-session guide edit
// never disturbs an in-flight session — always resolve via (categoryName, guideVersion).
export async function getGuideForSession(
  session: Pick<GuidedSessionDoc, "categoryName" | "guideVersion">,
): Promise<GuideDoc | null> {
  return Guide.findOne({ categoryName: session.categoryName, version: session.guideVersion });
}

export interface InterpretedStepReply {
  outcome: StepReplyOutcome;
  confidence: number;
  reply: string;
}

// FR-013: interpretations below the confidence threshold are downgraded to
// "unclear" so the caller asks a clarifying question instead of acting on a shaky read.
export async function interpretReply(params: {
  history: ConversationTurn[];
  latestMessage: string;
  step: { instruction: string; successHint: string };
  provider?: LlmProvider;
}): Promise<InterpretedStepReply | null> {
  const provider = params.provider ?? getLlmProvider();
  const result = await provider.interpretStepReply({
    history: params.history,
    latestMessage: params.latestMessage,
    stepInstruction: params.step.instruction,
    successHint: params.step.successHint,
  });
  if (!result.ok) {
    return null;
  }
  if (result.confidence < config.CONFIDENCE_THRESHOLD && result.outcome !== "unclear") {
    return { outcome: "unclear", confidence: result.confidence, reply: result.reply };
  }
  return result;
}

export function recordAttempt(
  session: HydratedDocument<GuidedSessionDoc>,
  outcome: "worked" | "not_worked" | "already_tried" | "skipped",
): void {
  session.stepAttempts.push({ stepIndex: session.currentStepIndex, outcome, at: new Date() });
}

export function advanceStep(session: HydratedDocument<GuidedSessionDoc>, nextStepIndex: number): void {
  session.currentStepIndex = nextStepIndex;
}

export function endSession(
  session: HydratedDocument<GuidedSessionDoc>,
  state: "resolved" | "escalated" | "abandoned",
): void {
  session.state = state;
}
