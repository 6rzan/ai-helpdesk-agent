declare module "sherpa-onnx-node" {
  export interface OfflineTransducerModelConfig {
    encoder: string;
    decoder: string;
    joiner: string;
  }

  export interface OfflineModelConfig {
    transducer: OfflineTransducerModelConfig;
    tokens: string;
    numThreads?: number;
    provider?: string;
  }

  export interface OfflineRecognizerConfig {
    featConfig: {
      sampleRate: number;
      featureDim: number;
    };
    modelConfig: OfflineModelConfig;
  }

  export interface OfflineStream {
    acceptWaveform(input: { samples: Float32Array; sampleRate: number }): void;
  }

  export interface OfflineRecognizeResult {
    text: string;
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig);
    createStream(): OfflineStream;
    decode(stream: OfflineStream): void;
    getResult(stream: OfflineStream): OfflineRecognizeResult;
  }

  export interface WaveData {
    samples: Float32Array;
    sampleRate: number;
  }

  export function readWave(filename: string): WaveData;
  export function writeWave(filename: string, wave: WaveData): void;
}
