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

export interface LlmProvider {
  classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult>;
  streamReply(input: StreamReplyInput): AsyncIterable<string>;
  interpretStepReply(input: InterpretStepReplyInput): Promise<InterpretStepReplyResult>;
  health(): Promise<boolean>;
}
