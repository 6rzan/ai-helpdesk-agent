import { useCallback, useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { ActionRecordCard } from "../components/ActionRecordCard";
import { ConsentBlock } from "../components/ConsentBlock";
import { EscalationNotice } from "../components/EscalationNotice";
import { MessageBubble } from "../components/MessageBubble";
import { QuickReplies } from "../components/QuickReplies";
import { TicketCard } from "../components/TicketCard";
import { VoiceControl } from "../components/VoiceControl";
import { createSession, getTicketActions, recordActionConsent, sendMessage } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../services/useEvents";
import type {
  ActionProposal,
  ActionRecord,
  CreateSessionResponse,
  InputOrigin,
  Message,
  TicketSummary,
} from "../lib/types";

interface StreamingReply {
  messageId: string;
  text: string;
}

const VOICE_MAX_SECONDS = Number(import.meta.env.VITE_VOICE_MAX_SECONDS ?? 120);

export function ChatPage() {
  const { account } = useAuth();
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
  const [pendingProposal, setPendingProposal] = useState<ActionProposal | null>(null);
  const [consentDeciding, setConsentDeciding] = useState(false);
  const [actionRecords, setActionRecords] = useState<ActionRecord[]>([]);

  const pushSystemMessage = useCallback(
    (text: string) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: crypto.randomUUID(),
          conversationId: session?.conversationId ?? "",
          author: "system",
          text,
          inputOrigin: "typed",
          sentAt: new Date().toISOString(),
        },
      ]);
    },
    [session?.conversationId],
  );

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
    onActionProposed: (data) => {
      setPendingProposal(data);
    },
    onActionRecorded: (data) => {
      setPendingProposal((prev) => (prev?.ticketId === data.ticketId ? null : prev));
      getTicketActions(data.ticketId)
        .then((res) => {
          const record = res.actions.find((a) => a.id === data.actionRecordId);
          if (record) {
            setActionRecords((prev) => [...prev, record]);
          }
        })
        .catch(() => undefined);
    },
    onApprovalPending: (data) => {
      pushSystemMessage(`Waiting on IT staff to approve: ${data.description}`);
    },
    onApprovalDecided: (data) => {
      const text =
        data.status === "approved"
          ? "IT staff approved the action."
          : data.status === "declined"
            ? "IT staff declined the action."
            : data.status === "expired"
              ? "The approval request expired before it was decided."
              : "The approval request no longer applies.";
      pushSystemMessage(text);
    },
  });

  const startSession = useCallback(() => {
    setIsStarting(true);
    setSessionError(undefined);
    createSession()
      .then((result) => {
        setSession(result);
        setTickets(result.openTickets);
      })
      .catch((err: unknown) => {
        setSessionError(err instanceof Error ? err.message : "Failed to start session");
      })
      .finally(() => setIsStarting(false));
  }, []);

  useEffect(() => {
    if (account && !session && !isStarting) {
      startSession();
    }
  }, [account, session, isStarting, startSession]);

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

  const handleConsentDecide = useCallback(
    (granted: boolean) => {
      if (!pendingProposal || consentDeciding) {
        return;
      }
      setConsentDeciding(true);
      recordActionConsent(pendingProposal.ticketId, pendingProposal.proposalId, granted)
        .then(() => {
          // No optimistic outcome here (Design Direction) — the transcript
          // shows what happened only once the server's own reply arrives
          // (via onAgentMessage), so the proposal simply stops being asked.
          setPendingProposal(null);
        })
        .catch((err: unknown) => {
          const errorText = err instanceof Error ? err.message : "Failed to record your decision, please try again.";
          pushSystemMessage(errorText);
        })
        .finally(() => setConsentDeciding(false));
    },
    [pendingProposal, consentDeciding, pushSystemMessage],
  );

  if (!session) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">{sessionError ?? "Starting your support session…"}</div>;
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
              {!streaming && index === messages.length - 1 && message.author === "agent" && pendingProposal && (
                <ConsentBlock proposal={pendingProposal} onDecide={handleConsentDecide} disabled={consentDeciding} />
              )}
            </div>
          );
        })}
        {streaming && <MessageBubble author="agent" text={streaming.text} isStreaming />}
        {actionRecords.map((record) => (
          <div key={record.id} className="self-start">
            <ActionRecordCard record={record} />
          </div>
        ))}
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
