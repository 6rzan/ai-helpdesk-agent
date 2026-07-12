import { config } from "../../../config/index.js";
import { SttProviderError, type SttProvider, type TranscriptionRequest, type TranscriptionResult } from "../types.js";

const REQUEST_TIMEOUT_MS = 15_000;

function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

export class OpenAiCompatSttProvider implements SttProvider {
  readonly name = "openai_compat" as const;

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const baseUrl = config.STT_OPENAI_BASE_URL;
    if (!baseUrl) {
      throw new SttProviderError("openai_compat", "Fallback speech-to-text is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const wavBuffer = encodeWav(request.samples, request.sampleRate);
      const form = new FormData();
      form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
      form.append("model", "whisper-1");

      const headers: Record<string, string> = {};
      if (config.STT_OPENAI_API_KEY) {
        headers.Authorization = `Bearer ${config.STT_OPENAI_API_KEY}`;
      }

      const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers,
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new SttProviderError("openai_compat", `Fallback speech-to-text returned an error (${res.status})`);
      }

      const body = (await res.json()) as { text?: string };
      return {
        transcript: (body.text ?? "").trim(),
        durationSeconds: request.durationSeconds,
        provider: "openai_compat",
      };
    } catch (err) {
      if (err instanceof SttProviderError) {
        throw err;
      }
      throw new SttProviderError(
        "openai_compat",
        `Fallback speech-to-text failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
