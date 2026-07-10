import { useCallback, useState } from "react";
import { EscalationNotice } from "../components/EscalationNotice";
import { MessageBubble } from "../components/MessageBubble";
import { SessionForm } from "../components/SessionForm";
import { TicketCard } from "../components/TicketCard";
import { createSession, sendMessage } from "../services/api";
import { useEvents } from "../services/useEvents";
import type { CreateSessionResponse, Message, TicketSummary } from "../lib/types";

interface StreamingReply {
  messageId: string;
  text: string;
}

export function ChatPage() {
  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<StreamingReply | null>(null);

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

  const handleSend = useCallback(() => {
    if (!session || draft.trim().length === 0) {
      return;
    }
    const text = draft.trim();
    setDraft("");
    setMessages((prev) => [
      ...prev,
      {
        _id: crypto.randomUUID(),
        conversationId: session.conversationId,
        author: "user",
        text,
        sentAt: new Date().toISOString(),
      },
    ]);
    sendMessage(session.conversationId, session.sessionId, text).catch((err: unknown) => {
      const errorText = err instanceof Error ? err.message : "Failed to send message, please try again.";
      setMessages((prev) => [
        ...prev,
        {
          _id: crypto.randomUUID(),
          conversationId: session.conversationId,
          author: "system",
          text: errorText,
          sentAt: new Date().toISOString(),
        },
      ]);
    });
  }, [session, draft]);

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
        {messages.map((message) => (
          <MessageBubble key={message._id} author={message.author} text={message.text} />
        ))}
        {streaming && <MessageBubble author="agent" text={streaming.text} isStreaming />}
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
        />
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          Send
        </button>
      </form>
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
