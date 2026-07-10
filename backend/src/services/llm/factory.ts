import { config } from "../../config/index.js";
import { MockLlmProvider } from "./mock-provider.js";
import { OllamaProvider } from "./ollama-provider.js";
import { OpenAiCompatProvider } from "./openai-compat-provider.js";
import type { LlmProvider } from "./types.js";

let cached: LlmProvider | undefined;

export function createLlmProvider(): LlmProvider {
  switch (config.LLM_PROVIDER) {
    case "mock":
      return new MockLlmProvider();
    case "openai_compat":
      return new OpenAiCompatProvider();
    case "ollama":
    default:
      return new OllamaProvider();
  }
}

export function getLlmProvider(): LlmProvider {
  cached ??= createLlmProvider();
  return cached;
}

export function resetLlmProviderCache(): void {
  cached = undefined;
}
