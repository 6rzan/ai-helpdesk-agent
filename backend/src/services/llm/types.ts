import type { ClassificationOutput } from "./schema.js";

export interface ConversationTurn {
  author: "user" | "agent" | "system";
  text: string;
}

export interface ClassifyAndReplyInput {
  history: ConversationTurn[];
  latestMessage: string;
}

export type ClassifyAndReplyResult =
  | ({ ok: true } & ClassificationOutput)
  | { ok: false; reason: "llm_unavailable" };

export interface StreamReplyInput {
  history: ConversationTurn[];
  latestMessage: string;
}

export interface LlmProvider {
  classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult>;
  streamReply(input: StreamReplyInput): AsyncIterable<string>;
  health(): Promise<boolean>;
}
