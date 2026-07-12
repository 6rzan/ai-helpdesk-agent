import { useCallback, useState } from "react";
import { X } from "@phosphor-icons/react";
import { EscalationNotice } from "../components/EscalationNotice";
import { MessageBubble } from "../components/MessageBubble";
import { QuickReplies } from "../components/QuickReplies";
import { SessionForm } from "../components/SessionForm";
import { TicketCard } from "../components/TicketCard";
import { VoiceControl } from "../components/VoiceControl";
import { createSession, sendMessage } from "../services/api";
import { useEvents } from "../services/useEvents";
import type { CreateSessionResponse, InputOrigin, Message, TicketSummary } from "../lib/types";

interface StreamingReply {
  messageId: string;
  text: string;
}

const VOICE_MAX_SECONDS = Number(import.meta.env.VITE_VOICE_MAX_SECONDS ?? 120);

export function ChatPage() {
  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<StreamingReply | null>(null);
  const [voiceError, setVoiceError] = useState<string>();
  const [hasTypedContent, setHasTypedContent] = useState(false);
  const [hasTranscriptContent, setHasTranscriptContent] = useState(false);

  useEvents(session?.sessionId, {
    onAgentToken: (data) =>
      setStreaming((prev) =>
        prev && prev.messageId === data.messageId
          ? { messageId: data.messageId, text: prev.text + data.token }
          : { messageId: data.messageId, text: data.token },
      ),
    onAgentMessage: (data) => {
      setMessages((prev) => [...prev, data.message]);
      setStreaming((prev) => (prev?.messageId === data.message._id ? null : prev));
    },
    onTicketCreated: (data) => setTickets((prev) => [data.ticket, ...prev]),
    onTicketUpdated: (data) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.reference === data.reference ? { ...ticket, [data.field]: data.to } : ticket,
        ),
      );
      setMessages((prev) => [
        ...prev,
        {
          _id: crypto.randomUUID(),
          conversationId: session?.conversationId ?? "",
          author: "system",
          text: data.plainText,
          inputOrigin: "typed",
          sentAt: data.at,
        },
      ]);
    },
  });

  const handleStart = useCallback((orgId: string, displayName: string) => {
    setIsStarting(true);
    setSessionError(undefined);
    createSession(orgId, displayName)
      .then((result) => {
        setSession(result);
        setTickets(result.openTickets);
      })
      .catch((err: unknown) => {
        setSessionError(err instanceof Error ? err.message : "Failed to start session");
      })
      .finally(() => setIsStarting(false));
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    // In-place corrections to an existing transcript (fixing a misheard word)
    // stay on the voice path; a pure append of new trailing content is a real
    // typed contribution, regardless of whether it lands before or after a
    // transcript (data-model.md origin derivation rules).
    const isNewAddition = value.length > draft.length && value.startsWith(draft);
    setHasTypedContent((prev) => prev || !hasTranscriptContent || isNewAddition);
    setDraft(value);
  }, [draft, hasTranscriptContent]);

  const handleTranscript = useCallback((transcript: string) => {
    setVoiceError(undefined);
    setHasTranscriptContent(true);
    setDraft((prev) => (prev.trim().length > 0 ? `${prev.trim()} ${transcript}` : transcript));
  }, []);

  const handleClearDraft = useCallback(() => {
    setDraft("");
    setHasTypedContent(false);
    setHasTranscriptContent(false);
  }, []);

  const submitMessage = useCallback(
    (text: string, origin: InputOrigin) => {
      if (!session || text.trim().length === 0) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          _id: crypto.randomUUID(),
          conversationId: session.conversationId,
          author: "user",
          text,
          inputOrigin: origin,
          sentAt: new Date().toISOString(),
        },
      ]);
      sendMessage(session.conversationId, session.sessionId, text, origin).catch((err: unknown) => {
        const errorText = err instanceof Error ? err.message : "Failed to send message, please try again.";
        setMessages((prev) => [
          ...prev,
          {
            _id: crypto.randomUUID(),
            conversationId: session.conversationId,
            author: "system",
            text: errorText,
            inputOrigin: "typed",
            sentAt: new Date().toISOString(),
          },
        ]);
      });
    },
    [session],
  );

  const handleSend = useCallback(() => {
    if (draft.trim().length === 0) {
      return;
    }
    const text = draft.trim();
    const origin: InputOrigin = hasTypedContent && hasTranscriptContent ? "mixed" : hasTranscriptContent ? "voice" : "typed";
    setDraft("");
    setHasTypedContent(false);
    setHasTranscriptContent(false);
    submitMessage(text, origin);
  }, [draft, hasTypedContent, hasTranscriptContent, submitMessage]);

  const handleQuickReply = useCallback(
    (text: string) => {
      submitMessage(text, "typed");
    },
    [submitMessage],
  );

  if (!session) {
    return <SessionForm onSubmit={handleStart} isSubmitting={isStarting} error={sessionError} />;
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col p-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Hi, {session.reporter.displayName}</h1>
      </header>
      <EscalationNotice
        references={tickets.filter((t) => t.handlingMode === "human_involved").map((t) => t.reference)}
      />
      <section className="flex flex-1 flex-col gap-2 overflow-y-auto rounded border border-gray-200 p-3">
        {messages.map((message, index) => {
          const alignment =
            message.author === "user" ? "self-end" : message.author === "system" ? "self-center" : "self-start";
          return (
            <div key={message._id} className={`flex flex-col gap-1 ${alignment}`}>
              {message.guidance && (
                <span className="text-xs font-medium text-gray-500">
                  Step {message.guidance.stepIndex + 1} of {message.guidance.stepCount}
                </span>
              )}
              <MessageBubble author={message.author} text={message.text} />
              {!streaming && index === messages.length - 1 && message.author === "agent" && message.guidance && (
                <QuickReplies onSend={handleQuickReply} />
              )}
            </div>
          );
        })}
        {streaming && <MessageBubble author="agent" text={streaming.text} isStreaming />}
      </section>
      <div className="mt-4 flex flex-col gap-2">
        {voiceError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(undefined)}
              aria-label="Dismiss notice"
              className="shrink-0 text-amber-700 transition-colors duration-150 hover:text-amber-900"
            >
              <X size={16} weight="regular" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <textarea
            className="max-h-40 flex-1 resize-none rounded border border-gray-300 px-3 py-2"
            rows={1}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={4000}
          />
          {draft.length > 0 && (
            <button
              type="button"
              onClick={handleClearDraft}
              aria-label="Clear draft"
              title="Clear draft"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors duration-150 hover:bg-gray-100"
            >
              <X size={18} weight="regular" />
            </button>
          )}
          <VoiceControl
            sessionId={session.sessionId}
            maxSeconds={VOICE_MAX_SECONDS}
            onTranscript={handleTranscript}
            onError={setVoiceError}
          />
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
            Send
          </button>
        </form>
      </div>
      {tickets.length > 0 && (
        <aside className="mt-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Your tickets</h2>
          {tickets.map((ticket) => (
            <TicketCard key={ticket.reference} ticket={ticket} />
          ))}
        </aside>
      )}
    </div>
  );
}
