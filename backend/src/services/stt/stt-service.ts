import { config } from "../../config/index.js";
import { ServiceUnavailableError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { SherpaLocalProvider } from "./providers/sherpa-local.js";
import { OpenAiCompatSttProvider } from "./providers/openai-compat.js";
import { SttProviderError, type SttProvider, type SttProviderName, type TranscriptionRequest, type TranscriptionResult } from "./types.js";

function createProvider(name: SttProviderName): SttProvider {
  switch (name) {
    case "local":
      return new SherpaLocalProvider();
    case "openai_compat":
      return new OpenAiCompatSttProvider();
  }
}

function parseProviderChain(): SttProviderName[] {
  return config.STT_PROVIDERS.split(",")
    .map((name) => name.trim())
    .filter((name): name is SttProviderName => name === "local" || name === "openai_compat");
}

let cachedChain: SttProvider[] | undefined;

function getProviderChain(): SttProvider[] {
  cachedChain ??= parseProviderChain().map(createProvider);
  return cachedChain;
}

export function resetSttServiceCache(): void {
  cachedChain = undefined;
}

export function setProviderChainForTest(chain: SttProvider[]): void {
  cachedChain = chain;
}

function withTimeout(provider: SttProvider, request: TranscriptionRequest): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SttProviderError(provider.name, `${provider.name} timed out after ${config.STT_TIMEOUT_MS}ms`, "timeout"));
    }, config.STT_TIMEOUT_MS);

    provider.transcribe(request).then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function transcribe(
  request: TranscriptionRequest,
  chain: SttProvider[] = getProviderChain(),
): Promise<TranscriptionResult> {
  if (chain.length === 0) {
    throw new ServiceUnavailableError("Voice transcription is not configured, please type your message", "STT_UNAVAILABLE");
  }

  const attempted: string[] = [];

  for (const provider of chain) {
    const startedAt = Date.now();
    attempted.push(provider.name);
    try {
      const result = await withTimeout(provider, request);
      logger.info(
        {
          provider: provider.name,
          durationSeconds: request.durationSeconds,
          latencyMs: Date.now() - startedAt,
        },
        "stt.transcribe.success",
      );
      return result;
    } catch (err) {
      const kind = err instanceof SttProviderError ? err.kind : "unavailable";
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        {
          provider: provider.name,
          durationSeconds: request.durationSeconds,
          latencyMs: Date.now() - startedAt,
          kind,
          error: message,
        },
        "stt.transcribe.provider_failed",
      );
    }
  }

  logger.error(
    { attemptedProviders: attempted, durationSeconds: request.durationSeconds },
    "stt.transcribe.chain_exhausted",
  );

  throw new ServiceUnavailableError("Voice transcription is temporarily unavailable, please type your message", "STT_UNAVAILABLE");
}
