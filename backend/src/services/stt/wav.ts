export interface ParsedWav {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
}

export class InvalidWavError extends Error {}

const EXPECTED_SAMPLE_RATE = 16000;
const EXPECTED_CHANNELS = 1;
const EXPECTED_BITS_PER_SAMPLE = 16;

export function parseWav(buffer: Buffer): ParsedWav {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new InvalidWavError("Audio must be a valid WAV file");
  }

  let offset = 12;
  let sampleRate: number | undefined;
  let numChannels: number | undefined;
  let bitsPerSample: number | undefined;
  let audioFormat: number | undefined;
  let dataStart: number | undefined;
  let dataLength: number | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      numChannels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataLength = Math.min(chunkSize, buffer.length - chunkDataStart);
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (
    sampleRate === undefined ||
    numChannels === undefined ||
    bitsPerSample === undefined ||
    audioFormat === undefined ||
    dataStart === undefined ||
    dataLength === undefined
  ) {
    throw new InvalidWavError("Audio is missing required WAV chunks");
  }

  if (audioFormat !== 1 || numChannels !== EXPECTED_CHANNELS || bitsPerSample !== EXPECTED_BITS_PER_SAMPLE || sampleRate !== EXPECTED_SAMPLE_RATE) {
    throw new InvalidWavError("Audio must be WAV PCM16, mono, 16kHz");
  }

  const sampleCount = Math.floor(dataLength / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readInt16LE(dataStart + i * 2) / 32768;
  }

  return {
    samples,
    sampleRate,
    durationSeconds: sampleCount / sampleRate,
  };
}
