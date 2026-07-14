import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listStaffTickets } from "../services/api";
import { useStaffEvents } from "../services/useEvents";
import type { IssueCategory, StaffTicketFilters, StaffTicketRow, TicketStatus } from "../lib/types";

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

const STATUS_CLASSES: Record<TicketStatus, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
};

const STATUS_OPTIONS: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as IssueCategory[];
const SORT_OPTIONS: { value: NonNullable<StaffTicketFilters["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated", label: "Recently updated" },
];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TicketRow({ ticket }: { ticket: StaffTicketRow }) {
  return (
    <tr className="group hover:bg-gray-50">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-sm tabular-nums">
        <Link to={`/staff/tickets/${ticket.reference}`} className="font-semibold text-blue-600 hover:underline">
          {ticket.reference}
        </Link>
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">
        {ticket.reporter ?? <span className="italic text-gray-400">No account</span>}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{CATEGORY_LABELS[ticket.category]}</td>
      <td className="max-w-md truncate px-3 py-2 text-sm text-gray-600">{ticket.description}</td>
      <td className="whitespace-nowrap px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[ticket.status]}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">
        {ticket.assignee ?? <span className="text-gray-400">Unassigned</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-500">
        {formatWhen(ticket.updatedAt)}
      </td>
    </tr>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
        <th className="px-3 py-2">Reference</th>
        <th className="px-3 py-2">Reporter</th>
        <th className="px-3 py-2">Category</th>
        <th className="px-3 py-2">Summary</th>
        <th className="px-3 py-2">Status</th>
        <th className="px-3 py-2">Assignee</th>
        <th className="px-3 py-2 text-right">Updated</th>
      </tr>
    </thead>
  );
}

export function DashboardPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [sort, setSort] = useState<NonNullable<StaffTicketFilters["sort"]>>("newest");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const filters = useMemo<StaffTicketFilters>(
    () => ({
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      sort,
    }),
    [status, category, sort],
  );

  const load = useCallback(() => {
    listStaffTickets(filters)
      .then((result) => {
        setTickets(result.tickets);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load tickets"))
      .finally(() => setIsLoading(false));
  }, [filters]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  // Live refresh: any staff-wide ticket change re-pulls the current filtered view.
  useStaffEvents(true, { onTicketCreated: load, onTicketUpdated: load });

  const escalated = tickets.filter((t) => t.escalated);
  const rest = tickets.filter((t) => !t.escalated);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Ticket dashboard</h1>
        <p className="text-sm text-gray-500">All reported issues across the organisation.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatus | "")}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IssueCategory | "")}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as NonNullable<StaffTicketFilters["sort"]>)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm font-medium text-gray-700">No tickets match these filters.</p>
          <p className="mt-1 text-sm text-gray-500">
            When someone reports an issue in chat, it appears here in real time. Clear the filters above to widen the
            view.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="w-full">
            <TableHead />
            {escalated.length > 0 && (
              <tbody className="divide-y divide-gray-100 border-l-2 border-amber-400">
                <tr>
                  <td
                    colSpan={7}
                    className="bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800"
                  >
                    Escalated: needs staff attention
                  </td>
                </tr>
                {escalated.map((ticket) => (
                  <TicketRow key={ticket.reference} ticket={ticket} />
                ))}
              </tbody>
            )}
            <tbody className="divide-y divide-gray-100">
              {rest.map((ticket) => (
                <TicketRow key={ticket.reference} ticket={ticket} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
