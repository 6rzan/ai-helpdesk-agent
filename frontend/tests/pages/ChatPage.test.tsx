import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatPage } from "../../src/pages/ChatPage";
import type { CreateSessionResponse } from "../../src/lib/types";

const createSession = vi.fn();
const sendMessage = vi.fn();
const transcribe = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    createSession: (...args: unknown[]) => createSession(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
    transcribe: (...args: unknown[]) => transcribe(...args),
  };
});

vi.mock("../../src/services/useEvents", () => ({
  useEvents: () => undefined,
}));

const startVoiceRecording = vi.fn();
const isVoiceCaptureSupported = vi.fn(() => true);

vi.mock("../../src/lib/audio", () => ({
  isVoiceCaptureSupported: () => isVoiceCaptureSupported(),
  startVoiceRecording: () => startVoiceRecording(),
}));

const SESSION: CreateSessionResponse = {
  sessionId: "sess-1",
  reporter: { orgId: "TP123456", displayName: "Alex Chen" },
  conversationId: "conv-1",
  openTickets: [],
};

function makeRecording(transcript: string) {
  return {
    stop: vi.fn().mockResolvedValue({ wavBlob: new Blob(["a"], { type: "audio/wav" }), durationSeconds: 1 }),
    cancel: vi.fn(),
    _transcript: transcript,
  };
}

async function speak(text: string) {
  const recording = makeRecording(text);
  startVoiceRecording.mockResolvedValueOnce(recording);
  transcribe.mockResolvedValueOnce({ transcript: text, durationSeconds: 1, provider: "local" });
  fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
  await screen.findByText("Recording");
  fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /record a voice message/i })).toBeInTheDocument());
}

async function renderReadySession() {
  createSession.mockResolvedValue(SESSION);
  render(<ChatPage />);
  fireEvent.change(screen.getByLabelText(/organisation id/i), { target: { value: "TP123456" } });
  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Alex Chen" } });
  fireEvent.click(screen.getByRole("button", { name: /start/i }));
  await screen.findByText(/hi, alex chen/i);
}

describe("ChatPage draft + origin behaviour", () => {
  beforeEach(() => {
    createSession.mockReset();
    sendMessage.mockReset().mockResolvedValue({ messageId: "m1" });
    startVoiceRecording.mockReset();
    isVoiceCaptureSupported.mockReturnValue(true);
    transcribe.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not send anything until Send is pressed (no auto-send on idle)", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello there" } });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends typed-only text with origin typed", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello there" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "hello there", "typed"));
  });

  it("derives origin voice for a transcript-only draft, including edits made during review", async () => {
    await renderReadySession();
    await speak("i cant print");

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("i cant print");

    fireEvent.change(textarea, { target: { value: "i can't print" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "i can't print", "voice"));
  });

  it("derives origin mixed when typed text exists before a transcript is appended", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hey " } });
    await speak("my printer is jamming");

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "hey my printer is jamming", "mixed"),
    );
  });

  it("derives origin mixed when a transcript is appended before typing (either order)", async () => {
    await renderReadySession();
    await speak("my printer is jamming");
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "my printer is jamming and also loud" } });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        "conv-1",
        "sess-1",
        "my printer is jamming and also loud",
        "mixed",
      ),
    );
  });

  it("stays mixed once set until clear or send, even through further edits", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hey " } });
    await speak("printer jam");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hey printer jam please help" } });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "hey printer jam please help", "mixed"),
    );
  });

  it("clearing the draft discards it with no send and resets origin tracking", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "some text" } });

    fireEvent.click(screen.getByRole("button", { name: /clear draft/i }));

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sendMessage).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "fresh typed text" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "fresh typed text", "typed"));
  });

  it("preserves the existing draft and shows a plain-language notice when a voice attempt fails mid-recording", async () => {
    await renderReadySession();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "printer wont turn on" } });

    startVoiceRecording.mockResolvedValueOnce(makeRecording("ignored"));
    transcribe.mockRejectedValueOnce(new Error("network down"));
    fireEvent.click(screen.getByRole("button", { name: /record a voice message/i }));
    await screen.findByText("Recording");
    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));

    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("printer wont turn on");

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "printer wont turn on", "typed"),
    );
  });

  it("appends a second recording's transcript onto the pending draft", async () => {
    await renderReadySession();
    await speak("first part");
    await speak("second part");

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("first part second part");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "first part second part", "voice"),
    );
  });
});
