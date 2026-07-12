export type SttProviderName = "local" | "openai_compat";

export interface TranscriptionRequest {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
}

export interface TranscriptionResult {
  transcript: string;
  durationSeconds: number;
  provider: SttProviderName;
}

export type SttProviderErrorKind = "unavailable" | "timeout" | "invalid_input";

export class SttProviderError extends Error {
  constructor(
    public readonly provider: SttProviderName,
    message: string,
    public readonly kind: SttProviderErrorKind = "unavailable",
  ) {
    super(message);
    this.name = "SttProviderError";
  }
}

export interface SttProvider {
  readonly name: SttProviderName;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}
