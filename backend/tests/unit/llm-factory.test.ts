import { afterEach, describe, expect, it } from "vitest";
import { config } from "../../src/config/index.js";
import { ChainedLlmProvider } from "../../src/services/llm/chained-provider.js";
import { createLlmProvider, getLlmProvider, resetLlmProviderCache, setLlmProviderForTest } from "../../src/services/llm/factory.js";
import { MockLlmProvider } from "../../src/services/llm/mock-provider.js";
import { OpenAiCompatProvider } from "../../src/services/llm/openai-compat-provider.js";

// T109/US6: a single configured provider (LLM_PROVIDERS absent, or naming
// only one entry) behaves exactly as today -- unwrapped, no ChainedLlmProvider,
// same object shape an existing .env carrying only LLM_PROVIDER always got.

describe("createLlmProvider", () => {
  const originalProvider = config.LLM_PROVIDER;
  const originalProviders = config.LLM_PROVIDERS;

  afterEach(() => {
    config.LLM_PROVIDER = originalProvider;
    config.LLM_PROVIDERS = originalProviders;
    resetLlmProviderCache();
  });

  it("T109: returns the raw MockLlmProvider (unwrapped) when LLM_PROVIDERS is unset", () => {
    config.LLM_PROVIDER = "mock";
    config.LLM_PROVIDERS = undefined;

    const provider = createLlmProvider();

    expect(provider).toBeInstanceOf(MockLlmProvider);
    expect(provider).not.toBeInstanceOf(ChainedLlmProvider);
  });

  it("T109: returns the raw provider (unwrapped) when LLM_PROVIDERS names exactly one entry", () => {
    config.LLM_PROVIDER = "ollama";
    config.LLM_PROVIDERS = "openai_compat";

    const provider = createLlmProvider();

    expect(provider).toBeInstanceOf(OpenAiCompatProvider);
    expect(provider).not.toBeInstanceOf(ChainedLlmProvider);
  });

  it("wraps multiple entries in a ChainedLlmProvider, in the configured order", () => {
    config.LLM_PROVIDER = "ollama";
    config.LLM_PROVIDERS = "mock, openai_compat";

    const provider = createLlmProvider();

    expect(provider).toBeInstanceOf(ChainedLlmProvider);
  });

  it("falls back to LLM_PROVIDER when LLM_PROVIDERS contains no recognised names", () => {
    config.LLM_PROVIDER = "mock";
    config.LLM_PROVIDERS = "unknown_provider";

    const provider = createLlmProvider();

    expect(provider).toBeInstanceOf(MockLlmProvider);
    expect(provider).not.toBeInstanceOf(ChainedLlmProvider);
  });

  it("caches a single instance across getLlmProvider() calls, preserving identity", () => {
    config.LLM_PROVIDER = "mock";
    config.LLM_PROVIDERS = undefined;
    resetLlmProviderCache();

    const first = getLlmProvider();
    const second = getLlmProvider();

    expect(first).toBe(second);
  });

  it("setLlmProviderForTest overrides the cached provider", () => {
    resetLlmProviderCache();
    const stub = new MockLlmProvider();

    setLlmProviderForTest(stub);

    expect(getLlmProvider()).toBe(stub);
  });
});
