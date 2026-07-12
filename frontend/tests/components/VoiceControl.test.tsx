import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VoiceControl } from "../../src/components/VoiceControl";
import { ApiError } from "../../src/services/api";

const startVoiceRecording = vi.fn();
const isVoiceCaptureSupported = vi.fn(() => true);

vi.mock("../../src/lib/audio", () => ({
  isVoiceCaptureSupported: () => isVoiceCaptureSupported(),
  startVoiceRecording: () => startVoiceRecording(),
}));

const transcribe = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    transcribe: (...args: unknown[]) => transcribe(...args),
  };
});

function makeRecording(wavBlob: Blob = new Blob(["audio"], { type: "audio/wav" })) {
  return {
    stop: vi.fn().mockResolvedValue({ wavBlob, durationSeconds: 1 }),
    cancel: vi.fn(),
  };
}

describe("VoiceControl", () => {
  beforeEach(() => {
    startVoiceRecording.mockReset();
    isVoiceCaptureSupported.mockReturnValue(true);
    transcribe.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a disabled mic control with an explanatory tooltip when the browser has no mediaDevices support", () => {
    isVoiceCaptureSupported.mockReturnValue(false);
    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={vi.fn()} />);

    const button = screen.getByRole("button", { name: /record a voice message/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", expect.stringMatching(/type your message instead/i));
    expect(startVoiceRecording).not.toHaveBeenCalled();
  });

  it("starts recording and shows the indicator, timer, stop, and cancel controls", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));

    await screen.findByText("Recording");
    expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("transcribes on stop and reports the transcript back to the caller", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);
    transcribe.mockResolvedValue({ transcript: "hello world", durationSeconds: 1, provider: "local" });
    const onTranscript = vi.fn();

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={onTranscript} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");

    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    await screen.findByText(/turning your speech into text/i);

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("hello world"));
    await waitFor(() => expect(screen.getByRole("button", { name: /record a voice message/i })).toBeInTheDocument());
    expect(recording.stop).toHaveBeenCalled();
    expect(transcribe).toHaveBeenCalledWith("s1", expect.any(Blob));
  });

  it("reports a plain-language error when nothing was heard", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);
    transcribe.mockResolvedValue({ transcript: "   ", durationSeconds: 1, provider: "local" });
    const onError = vi.fn();

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");
    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("We couldn't hear any words. You can try again or type instead."),
    );
  });

  it("reports a plain-language error when the STT service is unavailable", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);
    transcribe.mockRejectedValue(new ApiError(503, "STT_UNAVAILABLE", "unavailable"));
    const onError = vi.fn();

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");
    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("Voice input is not available right now. Please type your message instead."),
    );
  });

  it("reports a plain-language error when the microphone is denied", async () => {
    startVoiceRecording.mockRejectedValue(new Error("permission denied"));
    const onError = vi.fn();

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("The microphone is not available. You can keep typing as usual."),
    );
    expect(screen.queryByText("Recording")).not.toBeInTheDocument();
  });

  it("returns to idle after a mid-attempt STT failure so the user can retry by voice or keep typing immediately", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);
    transcribe.mockRejectedValue(new ApiError(503, "STT_UNAVAILABLE", "unavailable"));
    const onError = vi.fn();
    const onTranscript = vi.fn();

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={onTranscript} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");
    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onTranscript).not.toHaveBeenCalled();
    const retryButton = await screen.findByRole("button", { name: /record a voice message/i });
    expect(retryButton).not.toBeDisabled();
  });

  it("cancels a recording without transcribing", async () => {
    const recording = makeRecording();
    startVoiceRecording.mockResolvedValue(recording);

    render(<VoiceControl sessionId="s1" maxSeconds={120} onTranscript={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(recording.cancel).toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /record a voice message/i })).toBeInTheDocument());
  });
});
