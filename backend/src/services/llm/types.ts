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
  /** T114/R4: when the caller has a ticket in hand, threaded through so a
   * `ChainedLlmProvider` fallback during this proposal can be recorded
   * against that ticket, not just as a bare infrastructure event. */
  ticketId?: string | null;
}

export type ProposeActionResult =
  | {
      ok: true;
      proposal: { toolName: string; arguments: Record<string, unknown> } | null;
      /** research.md R4/FR-025: set by `ChainedLlmProvider` when this proposal
       * came from a fallback provider rather than the configured primary. A
       * single-provider setup never sets this (T109 — behaves exactly as
       * today). The caller (consent-service) refuses the resulting action
       * with `degraded_model` rather than offering it (US6 AS4). */
      degraded?: boolean;
    }
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
