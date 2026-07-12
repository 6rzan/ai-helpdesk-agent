import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";
import { resetTranscriptionsInFlight } from "../../src/api/routes/transcriptions.js";
import { setProviderChainForTest } from "../../src/services/stt/stt-service.js";
import type { SttProvider } from "../../src/services/stt/types.js";

function buildWav(options: { sampleRate?: number; channels?: number; bitsPerSample?: number; seconds?: number } = {}): Buffer {
  const sampleRate = options.sampleRate ?? 16000;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const seconds = options.seconds ?? 1;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.floor(sampleRate * seconds);
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function stubChain(behavior: () => Promise<{ transcript: string; durationSeconds: number; provider: "local" }>): SttProvider[] {
  return [{ name: "local", transcribe: behavior }];
}

async function startSession(ctx: TestContext) {
  const res = await request(ctx.app).post("/api/sessions").send({ orgId: "TP909090", displayName: "Alex Chen" });
  expect(res.status).toBe(201);
  return res.body.sessionId as string;
}

describe("POST /api/sessions/:sessionId/transcriptions", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
    resetSessionStore();
    resetTranscriptionsInFlight();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("TC-065: transcribes valid WAV audio and returns 200 with transcript, durationSeconds, provider", async () => {
    const sessionId = await startSession(ctx);
    setProviderChainForTest(
      stubChain(async () => ({ transcript: "my printer is jamming", durationSeconds: 1, provider: "local" })),
    );

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transcript: "my printer is jamming", durationSeconds: 1, provider: "local" });
  });

  it("TC-066: returns 400 INVALID_AUDIO when the audio part is missing", async () => {
    const sessionId = await startSession(ctx);
    const res = await request(ctx.app).post(`/api/sessions/${sessionId}/transcriptions`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_AUDIO");
  });

  it("TC-067: returns 400 INVALID_AUDIO when the sample format is wrong", async () => {
    const sessionId = await startSession(ctx);
    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav({ sampleRate: 44100 }), { filename: "audio.wav", contentType: "audio/wav" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_AUDIO");
  });

  it("TC-068: returns 404 SESSION_NOT_FOUND for an unknown session", async () => {
    const res = await request(ctx.app)
      .post("/api/sessions/does-not-exist/transcriptions")
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("TC-069: returns 413 AUDIO_TOO_LARGE when the duration cap is exceeded", async () => {
    const sessionId = await startSession(ctx);
    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav({ seconds: 126 }), { filename: "audio.wav", contentType: "audio/wav" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("AUDIO_TOO_LARGE");
  });

  it("TC-070: returns 503 STT_UNAVAILABLE with a plain-language message when the provider chain is exhausted", async () => {
    const sessionId = await startSession(ctx);
    setProviderChainForTest([]);

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("STT_UNAVAILABLE");
    expect(res.body.error.message).toMatch(/type your message/i);
  });

  it("TC-070b: returns 503 STT_UNAVAILABLE with a plain-language message when every provider in the chain fails", async () => {
    const sessionId = await startSession(ctx);
    setProviderChainForTest([
      { name: "local", transcribe: async () => { throw new Error("provider down"); } },
      { name: "openai_compat", transcribe: async () => { throw new Error("provider down"); } },
    ]);

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("STT_UNAVAILABLE");
    expect(res.body.error.message).toMatch(/type your message/i);
  });

  it("TC-070c: falls back to the next provider in the chain when the primary provider fails", async () => {
    const sessionId = await startSession(ctx);
    setProviderChainForTest([
      { name: "local", transcribe: async () => { throw new Error("primary down"); } },
      { name: "openai_compat", transcribe: async () => ({ transcript: "fallback worked", durationSeconds: 1, provider: "openai_compat" }) },
    ]);

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transcript: "fallback worked", durationSeconds: 1, provider: "openai_compat" });
  });

  it("TC-070d: returns a whitespace-only transcript as-is with 200 (client decides FR-011)", async () => {
    const sessionId = await startSession(ctx);
    setProviderChainForTest(stubChain(async () => ({ transcript: "   ", durationSeconds: 1, provider: "local" })));

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/transcriptions`)
      .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transcript: "   ", durationSeconds: 1, provider: "local" });
  });

  it(
    "TC-071: returns 409 TRANSCRIPTION_IN_PROGRESS for a concurrent request on the same session",
    async () => {
      const sessionId = await startSession(ctx);
      setProviderChainForTest(
        stubChain(async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return { transcript: "slow provider", durationSeconds: 1, provider: "local" };
        }),
      );

      const firstRequest = request(ctx.app)
        .post(`/api/sessions/${sessionId}/transcriptions`)
        .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondRequest = request(ctx.app)
        .post(`/api/sessions/${sessionId}/transcriptions`)
        .attach("audio", buildWav(), { filename: "audio.wav", contentType: "audio/wav" });

      const [firstRes, secondRes] = await Promise.all([firstRequest, secondRequest]);

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe("TRANSCRIPTION_IN_PROGRESS");
      expect(firstRes.status).toBe(200);
    },
    10000,
  );
});
