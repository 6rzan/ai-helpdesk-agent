import { config } from "../../config/index.js";
import { ChainedLlmProvider, type NamedLlmProvider } from "./chained-provider.js";
import { MockLlmProvider } from "./mock-provider.js";
import { OllamaProvider } from "./ollama-provider.js";
import { OpenAiCompatProvider } from "./openai-compat-provider.js";
import type { LlmProvider } from "./types.js";

type LlmProviderName = "mock" | "openai_compat" | "ollama";

function createNamedProvider(name: LlmProviderName): LlmProvider {
  switch (name) {
    case "mock":
      return new MockLlmProvider();
    case "openai_compat":
      return new OpenAiCompatProvider();
    case "ollama":
    default:
      return new OllamaProvider();
  }
}

// research.md R4: LLM_PROVIDERS is an ordered fallback chain, mirroring
// STT_PROVIDERS (stt-service.ts). Absent means "derive from LLM_PROVIDER" --
// a single-entry chain, which createLlmProvider below unwraps (T109).
function parseProviderChain(): LlmProviderName[] {
  if (!config.LLM_PROVIDERS) {
    return [config.LLM_PROVIDER];
  }
  const names = config.LLM_PROVIDERS.split(",")
    .map((name) => name.trim())
    .filter((name): name is LlmProviderName => name === "mock" || name === "openai_compat" || name === "ollama");
  return names.length > 0 ? names : [config.LLM_PROVIDER];
}

export function createLlmProvider(): LlmProvider {
  const names = parseProviderChain();
  if (names.length === 1) {
    // T109: a single configured provider behaves exactly as today -- no
    // ChainedLlmProvider wrapper, plain object identity.
    return createNamedProvider(names[0]!);
  }
  const chain: NamedLlmProvider[] = names.map((name) => ({ name, provider: createNamedProvider(name) }));
  return new ChainedLlmProvider(chain);
}

let cached: LlmProvider | undefined;

export function getLlmProvider(): LlmProvider {
  cached ??= createLlmProvider();
  return cached;
}

export function resetLlmProviderCache(): void {
  cached = undefined;
}

export function setLlmProviderForTest(provider: LlmProvider): void {
  cached = provider;
}
