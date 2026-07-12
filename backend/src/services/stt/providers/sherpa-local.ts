import path from "node:path";
import { createRequire } from "node:module";
import type { OfflineRecognizer } from "sherpa-onnx-node";
import { config } from "../../../config/index.js";

import { SttProviderError, type SttProvider, type TranscriptionRequest, type TranscriptionResult } from "../types.js";

const requireCjs = createRequire(import.meta.url);

let recognizer: OfflineRecognizer | undefined;

function loadRecognizer(): OfflineRecognizer {
  if (recognizer) {
    return recognizer;
  }

  // sherpa-onnx-node is CJS with dynamically-assigned exports, so ESM named
  // imports fail at runtime; load it through require(), deferred to first use
  // so importing this module never pulls in the native addon.
  const { OfflineRecognizer: SherpaOfflineRecognizer } = requireCjs(
    "sherpa-onnx-node",
  ) as typeof import("sherpa-onnx-node");

  const modelDir = config.STT_MODEL_DIR;
  try {
    recognizer = new SherpaOfflineRecognizer({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: path.join(modelDir, "encoder.int8.onnx"),
          decoder: path.join(modelDir, "decoder.int8.onnx"),
          joiner: path.join(modelDir, "joiner.int8.onnx"),
        },
        tokens: path.join(modelDir, "tokens.txt"),
        numThreads: 1,
        provider: "cpu",
      },
    });
  } catch (err) {
    throw new SttProviderError(
      "local",
      `Local speech-to-text model failed to load: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return recognizer;
}

export class SherpaLocalProvider implements SttProvider {
  readonly name = "local" as const;

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const rec = loadRecognizer();
    try {
      const stream = rec.createStream();
      stream.acceptWaveform({ samples: request.samples, sampleRate: request.sampleRate });
      rec.decode(stream);
      const result = rec.getResult(stream);
      return {
        transcript: (result.text ?? "").trim(),
        durationSeconds: request.durationSeconds,
        provider: "local",
      };
    } catch (err) {
      throw new SttProviderError(
        "local",
        `Local speech-to-text failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export function resetSherpaLocalProviderCache(): void {
  recognizer = undefined;
}
