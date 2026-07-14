import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getStaffTicket, reassignTicket, takeoverTicket, updateStaffTicketStatus } from "../services/api";
import { AssigneePicker } from "../components/AssigneePicker";
import { ProfilePanel } from "../components/ProfilePanel";
import type { IssueCategory, StaffTicketDetail, TicketStatus, TransitionRecord } from "../lib/types";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  password_login: "Password & Login",
  network: "Network",
  printer: "Printer",
  peripherals: "Peripherals",
  performance: "Performance",
  service_status: "Service Status",
  unclassified: "Unclassified",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

// Mirrors the backend ticket state machine (STATUS_TRANSITIONS) so staff only ever
// see the moves the server will accept.
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

function AuthorLabel({ author }: { author: string }) {
  const label = author === "user" ? "Reporter" : author === "agent" ? "Assistant" : "System";
  return <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>;
}

function HistoryRow({ record }: { record: TransitionRecord }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <span className="text-sm text-gray-700">
        {record.field === "status" ? "Status" : "Handling"} changed from{" "}
        <span className="font-medium">{record.from}</span> to <span className="font-medium">{record.to}</span>
      </span>
      <span className="text-xs tabular-nums text-gray-400">
        {new Date(record.at).toLocaleString()} · by {record.actor}
      </span>
    </li>
  );
}

export function TicketDetailPage() {
  const { reference = "" } = useParams<{ reference: string }>();
  const [ticket, setTicket] = useState<StaffTicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [conflict, setConflict] = useState<string>();
  const [isTakingOver, setIsTakingOver] = useState(false);

  const load = useCallback(() => {
    getStaffTicket(reference)
      .then((result) => {
        setTicket(result.ticket);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load ticket"))
      .finally(() => setIsLoading(false));
  }, [reference]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const handleStatusChange = useCallback(
    (next: TicketStatus) => {
      setPendingStatus(next);
      setError(undefined);
      updateStaffTicketStatus(reference, next)
        .then((result) => setTicket((prev) => (prev ? { ...prev, ...result.ticket } : prev)))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to update status"))
        .finally(() => setPendingStatus(null));
    },
    [reference],
  );

  const handleTakeover = useCallback(() => {
    setIsTakingOver(true);
    setConflict(undefined);
    setError(undefined);
    takeoverTicket(reference)
      .then((result) => setTicket(result.ticket))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          const current = err.details.currentAssignee as { displayName?: string } | null | undefined;
          setConflict(
            current?.displayName
              ? `${current.displayName} is already handling this ticket. Refresh to see the latest.`
              : "This ticket was just taken by someone else. Refresh to see the latest.",
          );
        } else {
          setError(err instanceof Error ? err.message : "Failed to take over");
        }
      })
      .finally(() => setIsTakingOver(false));
  }, [reference]);

  const handleReassign = useCallback(
    async (toAccountId: string) => {
      setConflict(undefined);
      const result = await reassignTicket(reference, toAccountId);
      setTicket(result.ticket);
    },
    [reference],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 p-6" aria-hidden="true">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
        <Link to="/staff" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const nextStatuses = STATUS_TRANSITIONS[ticket.status];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link to="/staff" className="text-sm text-blue-600 hover:underline">
        Back to dashboard
      </Link>

      <header className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-lg font-semibold tabular-nums text-gray-900">{ticket.reference}</h1>
        {ticket.escalated && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Escalated</span>
        )}
        <span className="text-sm text-gray-500">{CATEGORY_LABELS[ticket.category]}</span>
      </header>
      <p className="mt-1 text-sm text-gray-700">{ticket.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Transcript" className="rounded border border-gray-200">
          <h2 className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Conversation</h2>
          <div className="flex flex-col gap-3 p-4">
            {ticket.transcript.length === 0 ? (
              <p className="text-sm text-gray-400">No messages were exchanged before this ticket was raised.</p>
            ) : (
              ticket.transcript.map((message) => (
                <div key={message._id} className="flex flex-col gap-1">
                  <AuthorLabel author={message.author} />
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{message.text}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700">Assignment</h2>
            {ticket.assignee ? (
              <p className="mt-1 text-sm text-gray-600">
                Handled by <span className="font-medium text-gray-800">{ticket.assignee.displayName}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">Not yet taken over.</p>
            )}
            {conflict && (
              <div role="alert" className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                {conflict}
              </div>
            )}
            <div className="mt-3">
              {ticket.assignee ? (
                <AssigneePicker label="Reassign" onAssign={handleReassign} />
              ) : (
                <button
                  type="button"
                  disabled={isTakingOver}
                  onClick={handleTakeover}
                  className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isTakingOver ? "Taking over…" : "Take over"}
                </button>
              )}
            </div>
          </section>

          <ProfilePanel profile={ticket.profile} />

          <section className="rounded border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700">Status</h2>
            <p className="mt-1 text-sm text-gray-600">{STATUS_LABELS[ticket.status]}</p>
            {typeof ticket.classificationConfidence === "number" && (
              <p className="mt-2 text-xs text-gray-500">
                Classification confidence: {(ticket.classificationConfidence * 100).toFixed(0)}%
              </p>
            )}
            {error && (
              <div role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {nextStatuses.length === 0 ? (
                <p className="text-xs text-gray-400">No further status changes are available.</p>
              ) : (
                nextStatuses.map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={pendingStatus !== null}
                    onClick={() => handleStatusChange(next)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {pendingStatus === next ? "Updating…" : `Mark ${STATUS_LABELS[next]}`}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700">History</h2>
            {ticket.history.length === 0 ? (
              <p className="mt-1 text-sm text-gray-400">No changes recorded yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-gray-100">
                {ticket.history.map((record, i) => (
                  <HistoryRow key={`${record.at}-${i}`} record={record} />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
