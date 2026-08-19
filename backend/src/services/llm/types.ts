import type { ClassificationOutput, StepReplyOutput } from "./schema.js";

export interface ConversationTurn {
  author: "user" | "agent" | "system";
  text: string;
}

export interface ClassificationCategoryOption {
  name: string;
  classificationDescription: string;
}

export interface ClassifyAndReplyInput {
  history: ConversationTurn[];
  latestMessage: string;
  categories: ClassificationCategoryOption[];
}

export type ClassifyAndReplyResult =
  | ({ ok: true } & ClassificationOutput)
  | { ok: false; reason: "llm_unavailable" };

export interface StreamReplyInput {
  history: ConversationTurn[];
  latestMessage: string;
}

export interface InterpretStepReplyInput {
  history: ConversationTurn[];
  latestMessage: string;
  stepInstruction: string;
  successHint: string;
}

export type InterpretStepReplyResult =
  | ({ ok: true } & StepReplyOutput)
  | { ok: false; reason: "llm_unavailable" };

// --- 005: Constrained Automated Remediation ---

export interface ProposeActionTool {
  name: string;
  description: string;
}

export interface ProposeActionAttempt {
  toolName: string;
  arguments: Record<string, unknown>;
  /** Did this attempt pass its own tool's argument schema? Fed back to the
   * model so a rejected attempt is not simply repeated verbatim. */
  valid: boolean;
}

export interface ProposeActionInput {
  history: ConversationTurn[];
  latestMessage: string;
  stepInstruction: string;
  tools: ProposeActionTool[];
  attempts: ProposeActionAttempt[];
}

export type ProposeActionResult =
  | { ok: true; proposal: { toolName: string; arguments: Record<string, unknown> } | null }
  | { ok: false; reason: "llm_unavailable" };

export interface LlmProvider {
  classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult>;
  streamReply(input: StreamReplyInput): AsyncIterable<string>;
  interpretStepReply(input: InterpretStepReplyInput): Promise<InterpretStepReplyResult>;
  /** research.md R5 "Plan": proposes at most one registered tool call, or none.
   * The agent loop (agent-loop.ts) validates and bounds this — this method only
   * asks the model for its next single proposal. */
  proposeAction(input: ProposeActionInput): Promise<ProposeActionResult>;
  health(): Promise<boolean>;
}
