import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import { classificationOutputSchema } from "./schema.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  LlmProvider,
  StreamReplyInput,
} from "./types.js";

const CLASSIFICATION_SYSTEM_PROMPT =
  'You are an IT help desk assistant. Classify the user\'s issue into exactly one category: ' +
  "password_login, network, printer, peripherals, performance, service_status, or unclassified " +
  'if none fit. Respond with strict JSON only: {"category": string, "confidence": number between 0 ' +
  'and 1, "reply": string}. The reply must be a short, friendly message to the user.';

const CHAT_SYSTEM_PROMPT = "You are a concise, friendly IT help desk assistant.";

function buildPrompt(input: ClassifyAndReplyInput | StreamReplyInput): string {
  const historyText = input.history.map((turn) => `${turn.author}: ${turn.text}`).join("\n");
  return `${historyText}\nuser: ${input.latestMessage}`.trim();
}

interface OllamaChatResponse {
  message?: { content?: string };
}

export class OllamaProvider implements LlmProvider {
  async classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.LLM_MODEL,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(input) },
          ],
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "ollama classification request failed");
        return { ok: false, reason: "llm_unavailable" };
      }

      const body = (await response.json()) as OllamaChatResponse;
      const raw = body.message?.content ?? "";

      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch (parseErr) {
        logger.warn({ err: parseErr }, "ollama classification output was not valid JSON");
        return { ok: false, reason: "llm_unavailable" };
      }

      const parsed = classificationOutputSchema.safeParse(candidate);
      if (!parsed.success) {
        logger.warn({ error: parsed.error.message }, "ollama classification output failed schema validation");
        return { ok: false, reason: "llm_unavailable" };
      }

      return { ok: true, ...parsed.data };
    } catch (err) {
      logger.warn({ err }, "ollama classification call errored");
      return { ok: false, reason: "llm_unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamReply(input: StreamReplyInput): AsyncIterable<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.LLM_MODEL,
          stream: true,
          messages: [
            { role: "system", content: CHAT_SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(input) },
          ],
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
          if (!line.trim()) {
            continue;
          }
          try {
            const chunk = JSON.parse(line) as OllamaChatResponse;
            if (chunk.message?.content) {
              yield chunk.message.content;
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
    try {
      const response = await fetch(`${config.OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
