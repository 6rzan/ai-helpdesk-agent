import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listApprovals, listStaffTickets } from "../services/api";
import { useStaffEvents } from "../services/useEvents";
import { TicketList } from "../components/staff/TicketList";
import { MetricsBand } from "../components/staff/MetricsBand";
import type { IssueCategory, StaffTicketFilters, StaffTicketRow, TicketStatus } from "../lib/types";

export function DashboardPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [sort, setSort] = useState<NonNullable<StaffTicketFilters["sort"]>>("newest");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [updatedReferences, setUpdatedReferences] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const loadPendingApprovals = useCallback(() => {
    listApprovals("pending")
      .then((result) => setPendingApprovals(result.approvals.length))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals]);

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
  useStaffEvents(true, {
    onTicketCreated: load,
    onTicketUpdated: (event) => {
      setUpdatedReferences(new Set([event.reference]));
      load();
      window.setTimeout(() => setUpdatedReferences(new Set()), 350);
    },
    onApprovalPending: loadPendingApprovals,
    onApprovalDecided: loadPendingApprovals,
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ticket dashboard</h1>
          <p className="text-sm text-gray-500">All reported issues across the organisation.</p>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <Link to="/staff/approvals" className="flex items-center gap-1.5 hover:text-gray-900">
            Approvals
            {pendingApprovals > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                {pendingApprovals}
              </span>
            )}
          </Link>
          <Link to="/staff/audit" className="hover:text-gray-900">
            Audit trail
          </Link>
          <Link to="/staff/remediation" className="hover:text-gray-900">
            Automation
          </Link>
        </nav>
      </header>

      <div className="mb-4">
        <MetricsBand />
      </div>

      <TicketList
        status={status}
        category={category}
        sort={sort}
        onStatusChange={setStatus}
        onCategoryChange={setCategory}
        onSortChange={setSort}
        tickets={tickets}
        isLoading={isLoading}
        error={error}
        updatedReferences={updatedReferences}
      />
    </div>
  );
}
