import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, Stop } from "@phosphor-icons/react";
import { ApiError, transcribe } from "../services/api";
import { isVoiceCaptureSupported, startVoiceRecording, type ActiveVoiceRecording } from "../lib/audio";

type VoiceState = "idle" | "recording" | "transcribing";

interface VoiceControlProps {
  sessionId: string;
  maxSeconds: number;
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const MIC_DENIED_MESSAGE = "The microphone is not available. You can keep typing as usual.";
const MIC_UNSUPPORTED_MESSAGE = "Voice input isn't available on this device or browser. You can type your message instead.";
const STT_UNAVAILABLE_MESSAGE = "Voice input is not available right now. Please type your message instead.";
const NOTHING_HEARD_MESSAGE = "We couldn't hear any words. You can try again or type instead.";
const WARNING_THRESHOLD_SECONDS = 15;

function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceControl({ sessionId, maxSeconds, onTranscript, onError, disabled = false }: VoiceControlProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<ActiveVoiceRecording | null>(null);
  const intervalRef = useRef<ReturnType<typeof window.setInterval>>();

  const supported = isVoiceCaptureSupported();

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  useEffect(
    () => () => {
      stopTimer();
      recordingRef.current?.cancel();
    },
    [stopTimer],
  );

  const finishTranscription = useCallback(
    async (recording: ActiveVoiceRecording) => {
      setState("transcribing");
      try {
        const { wavBlob } = await recording.stop();
        const result = await transcribe(sessionId, wavBlob);
        const trimmed = result.transcript.trim();
        if (trimmed.length === 0) {
          onError(NOTHING_HEARD_MESSAGE);
        } else {
          onTranscript(trimmed);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "INVALID_AUDIO") {
          onError(NOTHING_HEARD_MESSAGE);
        } else {
          onError(STT_UNAVAILABLE_MESSAGE);
        }
      } finally {
        recordingRef.current = null;
        setElapsed(0);
        setState("idle");
      }
    },
    [sessionId, onTranscript, onError],
  );

  const handleStart = useCallback(async () => {
    try {
      const recording = await startVoiceRecording();
      recordingRef.current = recording;
      setElapsed(0);
      setState("recording");
      intervalRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            stopTimer();
            const active = recordingRef.current;
            if (active) {
              void finishTranscription(active);
            }
          }
          return next;
        });
      }, 1000);
    } catch {
      onError(MIC_DENIED_MESSAGE);
    }
  }, [maxSeconds, stopTimer, finishTranscription, onError]);

  const handleStop = useCallback(() => {
    stopTimer();
    const recording = recordingRef.current;
    if (recording) {
      void finishTranscription(recording);
    }
  }, [stopTimer, finishTranscription]);

  const handleCancel = useCallback(() => {
    stopTimer();
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setElapsed(0);
    setState("idle");
  }, [stopTimer]);

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        aria-label="Record a voice message"
        title={MIC_UNSUPPORTED_MESSAGE}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-300 disabled:cursor-not-allowed"
      >
        <Microphone size={20} weight="regular" />
      </button>
    );
  }

  if (state === "recording") {
    const remaining = maxSeconds - elapsed;
    const showWarning = remaining <= WARNING_THRESHOLD_SECONDS && remaining > 0;
    return (
      <div className="flex flex-1 items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 transition-colors duration-200">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse" aria-hidden="true" />
        <span className="shrink-0 font-medium">Recording</span>
        <span className="tabular-nums text-red-700">
          {formatTimer(elapsed)} / {formatTimer(maxSeconds)}
        </span>
        {showWarning && (
          <span role="status" aria-live="polite" className="sr-only">
            Recording ends in 15 seconds.
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded px-2 py-1.5 text-red-700 transition-colors duration-150 hover:bg-red-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop recording"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors duration-150 hover:bg-red-700"
          >
            <Stop size={18} weight="regular" />
          </button>
        </div>
      </div>
    );
  }

  if (state === "transcribing") {
    return (
      <div role="status" className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-gray-100 px-3 text-sm text-gray-600">
        Turning your speech into text…
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={disabled}
      aria-label="Record a voice message"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors duration-150 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Microphone size={20} weight="regular" />
    </button>
  );
}
