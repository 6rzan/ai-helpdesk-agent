import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../../config/index.js";
import { ConflictError, NotFoundError, PayloadTooLargeError, ValidationError } from "../../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { getSession, touchSession } from "../../services/session/session-service.js";
import { transcribe } from "../../services/stt/stt-service.js";
import { InvalidWavError, parseWav } from "../../services/stt/wav.js";

export const transcriptionsRouter = Router();

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const GRACE_SECONDS = 5;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

const paramsSchema = z.object({ sessionId: z.string().min(1) });

const inFlightSessions = new Set<string>();

transcriptionsRouter.post(
  "/sessions/:sessionId/transcriptions",
  validate({ params: paramsSchema }),
  (req, res, next) => {
    upload.single("audio")(req, res, (err) => {
      if (err) {
        next(new PayloadTooLargeError("Audio file exceeds the maximum upload size", "AUDIO_TOO_LARGE"));
        return;
      }
      next();
    });
  },
  (req, res, next) => {
    const { sessionId } = req.params as z.infer<typeof paramsSchema>;

    (async () => {
      const session = getSession(sessionId);
      if (!session) {
        throw new NotFoundError("Session is invalid or has expired", "SESSION_NOT_FOUND");
      }

      const file = req.file;
      if (!file) {
        throw new ValidationError("audio part is required", "INVALID_AUDIO");
      }

      if (inFlightSessions.has(sessionId)) {
        throw new ConflictError("A transcription is already in progress for this session", "TRANSCRIPTION_IN_PROGRESS");
      }

      inFlightSessions.add(sessionId);
      try {
        let parsed;
        try {
          parsed = parseWav(file.buffer);
        } catch (err) {
          if (err instanceof InvalidWavError) {
            throw new ValidationError(err.message, "INVALID_AUDIO");
          }
          throw err;
        }

        if (parsed.durationSeconds > config.VOICE_MAX_SECONDS + GRACE_SECONDS) {
          throw new PayloadTooLargeError("Audio exceeds the maximum recording duration", "AUDIO_TOO_LARGE");
        }

        touchSession(sessionId);

        const result = await transcribe({
          samples: parsed.samples,
          sampleRate: parsed.sampleRate,
          durationSeconds: parsed.durationSeconds,
        });

        res.status(200).json(result);
      } finally {
        inFlightSessions.delete(sessionId);
      }
    })().catch(next);
  },
);

export function resetTranscriptionsInFlight(): void {
  inFlightSessions.clear();
}
