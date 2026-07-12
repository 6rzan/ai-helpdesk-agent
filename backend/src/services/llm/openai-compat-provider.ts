import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import { CHAT_SYSTEM_PROMPT } from "./prompts/core.js";
import { buildClassificationPrompt } from "./prompts/classification.js";
import { buildStepReplyPrompt } from "./prompts/guidance.js";
import { classificationOutputSchema, stepReplyOutputSchema, STEP_REPLY_OUTCOMES } from "./schema.js";
import type {
  ClassificationCategoryOption,
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  InterpretStepReplyInput,
  InterpretStepReplyResult,
  LlmProvider,
  StreamReplyInput,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

// json_schema (not json_object): required by LM Studio, also supported by OpenAI.
// Category enum is data-driven (R2) so new categories classify without a code change.
function buildClassificationResponseFormat(categories: ClassificationCategoryOption[]) {
  return {
    type: "json_schema",
    json_schema: {
      name: "classification",
      strict: true,
      schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [...categories.map((c) => c.name), "unclassified"],
          },
          confidence: { type: "number" },
          reply: { type: "string" },
        },
        required: ["category", "confidence", "reply"],
      },
    },
  } as const;
}

function buildStepReplyResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "step_reply",
      strict: true,
      schema: {
        type: "object",
        properties: {
          outcome: { type: "string", enum: [...STEP_REPLY_OUTCOMES] },
          confidence: { type: "number" },
          reply: { type: "string" },
        },
        required: ["outcome", "confidence", "reply"],
      },
    },
  } as const;
}

function buildMessages(
  input: ClassifyAndReplyInput | StreamReplyInput | InterpretStepReplyInput,
  systemPrompt: string,
): { role: string; content: string }[] {
  const historyMessages = input.history.map((turn) => ({
    role: turn.author === "user" ? "user" : "assistant",
    content: turn.text,
  }));
  return [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: input.latestMessage },
  ];
}

interface OpenAiChatCompletion {
  choices?: { message?: { content?: string } }[];
}

interface OpenAiStreamChunk {
  choices?: { delta?: { content?: string } }[];
}

export class OpenAiCompatProvider implements LlmProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor() {
    this.baseUrl = config.LLM_BASE_URL ?? DEFAULT_BASE_URL;
    this.apiKey = config.LLM_API_KEY;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
    if (!this.apiKey) {
      logger.warn("openai-compat provider has no LLM_API_KEY configured");
      return { ok: false, reason: "llm_unavailable" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({
          model: config.LLM_MODEL,
          temperature: 0,
          response_format: buildClassificationResponseFormat(input.categories),
          messages: buildMessages(input, buildClassificationPrompt(input.categories)),
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "openai-compat classification request failed");
        return { ok: false, reason: "llm_unavailable" };
      }

      const body = (await response.json()) as OpenAiChatCompletion;
      const raw = body.choices?.[0]?.message?.content ?? "";

      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch (parseErr) {
        logger.warn({ err: parseErr }, "openai-compat classification output was not valid JSON");
        return { ok: false, reason: "llm_unavailable" };
      }

      const parsed = classificationOutputSchema.safeParse(candidate);
      if (!parsed.success) {
        logger.warn(
          { error: parsed.error.message },
          "openai-compat classification output failed schema validation",
        );
        return { ok: false, reason: "llm_unavailable" };
      }

      return { ok: true, ...parsed.data };
    } catch (err) {
      logger.warn({ err }, "openai-compat classification call errored");
      return { ok: false, reason: "llm_unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  async interpretStepReply(input: InterpretStepReplyInput): Promise<InterpretStepReplyResult> {
    if (!this.apiKey) {
      logger.warn("openai-compat provider has no LLM_API_KEY configured");
      return { ok: false, reason: "llm_unavailable" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({
          model: config.LLM_MODEL,
          temperature: 0,
          response_format: buildStepReplyResponseFormat(),
          messages: buildMessages(input, buildStepReplyPrompt(input.stepInstruction, input.successHint)),
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "openai-compat step-reply request failed");
        return { ok: false, reason: "llm_unavailable" };
      }

      const body = (await response.json()) as OpenAiChatCompletion;
      const raw = body.choices?.[0]?.message?.content ?? "";

      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch (parseErr) {
        logger.warn({ err: parseErr }, "openai-compat step-reply output was not valid JSON");
        return { ok: false, reason: "llm_unavailable" };
      }

      const parsed = stepReplyOutputSchema.safeParse(candidate);
      if (!parsed.success) {
        logger.warn(
          { error: parsed.error.message },
          "openai-compat step-reply output failed schema validation",
        );
        return { ok: false, reason: "llm_unavailable" };
      }

      return { ok: true, ...parsed.data };
    } catch (err) {
      logger.warn({ err }, "openai-compat step-reply call errored");
      return { ok: false, reason: "llm_unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamReply(input: StreamReplyInput): AsyncIterable<string> {
    if (!this.apiKey) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        signal: controller.signal,
        body: JSON.stringify({
          model: config.LLM_MODEL,
          stream: true,
          messages: buildMessages(input, CHAT_SYSTEM_PROMPT),
        }),
      });

      if (!response.ok || !response.body) {
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const payload = trimmed.slice("data:".length).trim();
          if (payload === "[DONE]") {
            return;
          }
          try {
            const chunk = JSON.parse(payload) as OpenAiStreamChunk;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // ignore malformed stream chunk
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
