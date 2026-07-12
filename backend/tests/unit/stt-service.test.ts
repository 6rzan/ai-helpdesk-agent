import { describe, expect, it } from "vitest";
import { config } from "../../src/config/index.js";
import { transcribe } from "../../src/services/stt/stt-service.js";
import { SttProviderError, type SttProvider, type TranscriptionRequest, type TranscriptionResult } from "../../src/services/stt/types.js";

function stubProvider(name: SttProvider["name"], behavior: () => Promise<TranscriptionResult>): SttProvider {
  return { name, transcribe: behavior };
}

const sampleRequest: TranscriptionRequest = {
  samples: new Float32Array([0, 0.1, -0.1]),
  sampleRate: 16000,
  durationSeconds: 3,
};

describe("SttService.transcribe", () => {
  it("TC-061: returns the result from the first provider that succeeds", async () => {
    const local = stubProvider("local", async () => ({
      transcript: "hello world",
      durationSeconds: 3,
      provider: "local",
    }));
    const fallback = stubProvider("openai_compat", async () => {
      throw new Error("should not be called");
    });

    const result = await transcribe(sampleRequest, [local, fallback]);

    expect(result).toEqual({ transcript: "hello world", durationSeconds: 3, provider: "local" });
  });

  it("TC-062: falls through to the next provider when the first one fails", async () => {
    const local = stubProvider("local", async () => {
      throw new SttProviderError("local", "model not loaded");
    });
    const fallback = stubProvider("openai_compat", async () => ({
      transcript: "fallback text",
      durationSeconds: 3,
      provider: "openai_compat",
    }));

    const result = await transcribe(sampleRequest, [local, fallback]);

    expect(result.provider).toBe("openai_compat");
    expect(result.transcript).toBe("fallback text");
  });

  it("TC-063: throws a 503 STT_UNAVAILABLE error when every provider in the chain fails", async () => {
    const local = stubProvider("local", async () => {
      throw new SttProviderError("local", "model not loaded");
    });
    const fallback = stubProvider("openai_compat", async () => {
      throw new SttProviderError("openai_compat", "network error");
    });

    await expect(transcribe(sampleRequest, [local, fallback])).rejects.toMatchObject({
      statusCode: 503,
      code: "STT_UNAVAILABLE",
    });
  });

  it("TC-064: throws a 503 STT_UNAVAILABLE error when the chain is empty", async () => {
    await expect(transcribe(sampleRequest, [])).rejects.toMatchObject({
      statusCode: 503,
      code: "STT_UNAVAILABLE",
    });
  });

  it("TC-072: falls through to the next provider when the first one exceeds its timeout", async () => {
    const originalTimeout = config.STT_TIMEOUT_MS;
    config.STT_TIMEOUT_MS = 50;
    try {
      const slow = stubProvider(
        "local",
        () => new Promise<TranscriptionResult>((resolve) => setTimeout(() => resolve({
          transcript: "too slow",
          durationSeconds: 3,
          provider: "local",
        }), 500)),
      );
      const fallback = stubProvider("openai_compat", async () => ({
        transcript: "on time",
        durationSeconds: 3,
        provider: "openai_compat",
      }));

      const result = await transcribe(sampleRequest, [slow, fallback]);

      expect(result).toEqual({ transcript: "on time", durationSeconds: 3, provider: "openai_compat" });
    } finally {
      config.STT_TIMEOUT_MS = originalTimeout;
    }
  });
});
