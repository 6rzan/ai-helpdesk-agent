export interface VoiceCaptureResult {
  wavBlob: Blob;
  durationSeconds: number;
}

export interface ActiveVoiceRecording {
  stop(): Promise<VoiceCaptureResult>;
  cancel(): void;
}

const PREFERRED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];
const TARGET_SAMPLE_RATE = 16000;

export function isVoiceCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined"
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export async function startVoiceRecording(): Promise<ActiveVoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  function releaseStream(): void {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  recorder.start();

  return {
    async stop() {
      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener(
          "stop",
          () => resolve(new Blob(chunks, { type: recorder.mimeType })),
          { once: true },
        );
        recorder.addEventListener("error", () => reject(new Error("Recording failed")), { once: true });
        recorder.stop();
      });
      releaseStream();
      return encodeToWav(rawBlob);
    },
    cancel() {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      releaseStream();
    },
  };
}

async function encodeToWav(blob: Blob): Promise<VoiceCaptureResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    void decodeCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();

  const rendered = await offlineCtx.startRendering();
  const samples = rendered.getChannelData(0);

  return {
    wavBlob: new Blob([encodeWavPcm16(samples, TARGET_SAMPLE_RATE)], { type: "audio/wav" }),
    durationSeconds: samples.length / TARGET_SAMPLE_RATE,
  };
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * bytesPerSample, Math.round(clamped * 32767), true);
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
