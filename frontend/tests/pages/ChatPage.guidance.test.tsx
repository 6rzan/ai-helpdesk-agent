import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatPage } from "../../src/pages/ChatPage";
import type { CreateSessionResponse, Message } from "../../src/lib/types";

const createSession = vi.fn();
const sendMessage = vi.fn();

let capturedHandlers: { onAgentMessage?: (data: { conversationId: string; message: Message }) => void } = {};

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    createSession: (...args: unknown[]) => createSession(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
  };
});

vi.mock("../../src/services/useEvents", () => ({
  useEvents: (
    _sessionId: string | undefined,
    handlers: { onAgentMessage?: (data: { conversationId: string; message: Message }) => void },
  ) => {
    capturedHandlers = handlers;
  },
}));

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ account: { id: "account-1", displayName: "Alex Chen", email: "alex@example.test", role: "user" } }),
}));

vi.mock("../../src/lib/audio", () => ({
  isVoiceCaptureSupported: () => true,
  startVoiceRecording: vi.fn(),
}));

const SESSION: CreateSessionResponse = {
  sessionId: "sess-1",
  reporter: { orgId: "TP123456", displayName: "Alex Chen" },
  conversationId: "conv-1",
  openTickets: [],
};

function agentStepMessage(text: string, stepIndex: number, stepCount: number): Message {
  return {
    _id: `m-${stepIndex}`,
    conversationId: "conv-1",
    author: "agent",
    text,
    inputOrigin: "typed",
    sentAt: new Date().toISOString(),
    guidance: { stepIndex, stepCount },
  };
}

async function renderReadySession() {
  createSession.mockResolvedValue(SESSION);
  render(<ChatPage />);
  await screen.findByText(/hi, alex chen/i);
}

describe("ChatPage guidance UI", () => {
  beforeEach(() => {
    createSession.mockReset();
    sendMessage.mockReset().mockResolvedValue({ messageId: "m1" });
    capturedHandlers = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a Step n of m marker and mounts QuickReplies under the newest guidance message", async () => {
    await renderReadySession();

    act(() => {
      capturedHandlers.onAgentMessage?.({
        conversationId: "conv-1",
        message: agentStepMessage("Step 1 of 3: Double-check Caps Lock is off.", 0, 3),
      });
    });

    await screen.findByText("Step 1 of 3");
    expect(screen.getByRole("button", { name: "That worked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Didn't work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Talk to a human" })).toBeInTheDocument();
  });

  it("sending a quick reply submits it as a normal typed user message", async () => {
    await renderReadySession();
    act(() => {
      capturedHandlers.onAgentMessage?.({
        conversationId: "conv-1",
        message: agentStepMessage("Step 1 of 3: Double-check Caps Lock is off.", 0, 3),
      });
    });
    await screen.findByText("Step 1 of 3");

    fireEvent.click(screen.getByRole("button", { name: "Didn't work" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("conv-1", "sess-1", "Didn't work", "typed"));
  });

  it("does not mount QuickReplies under an older step message once a newer one has arrived", async () => {
    await renderReadySession();
    act(() => {
      capturedHandlers.onAgentMessage?.({
        conversationId: "conv-1",
        message: agentStepMessage("Step 1 of 3: first step.", 0, 3),
      });
    });
    await screen.findByText("Step 1 of 3");

    act(() => {
      capturedHandlers.onAgentMessage?.({
        conversationId: "conv-1",
        message: agentStepMessage("Step 2 of 3: second step.", 1, 3),
      });
    });
    await screen.findByText("Step 2 of 3");

    expect(screen.getAllByRole("button", { name: "That worked" })).toHaveLength(1);
  });
});
