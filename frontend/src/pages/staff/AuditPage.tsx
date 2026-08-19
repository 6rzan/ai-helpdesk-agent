import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStaffActions } from "../../services/api";
import { useStaffEvents } from "../../services/useEvents";
import { AuditTrail, type AuditTrailFilters } from "../../components/staff/AuditTrail";
import type { ActionRecord } from "../../lib/types";

const PAGE_SIZE = 25;

/** T084/T094/T096: the full cross-ticket audit trail, live-refreshed on every
 * `action_recorded` staff broadcast (US4 AS2). Append-only made visible: no
 * edit/delete affordance exists anywhere in this surface. */
export function AuditPage() {
  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditTrailFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    listStaffActions({
      ticketId: filters.ticketId,
      endpointId: filters.endpointId,
      outcome: filters.outcome || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        setRecords(result.actions);
        setTotal(result.total);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load the audit trail"))
      .finally(() => setIsLoading(false));
  }, [filters, page]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  useStaffEvents(true, { onActionRecorded: load });

  const handleFiltersChange = useCallback((next: AuditTrailFilters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link to="/staff" className="text-sm text-blue-600 hover:underline">
        Back to dashboard
      </Link>
      <header className="mt-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Audit trail</h1>
        <p className="text-sm text-gray-500">Every action the agent has attempted, across every ticket.</p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-32 motion-safe:animate-pulse rounded bg-gray-100" aria-hidden="true" />
      ) : (
        <>
          <AuditTrail records={records} filters={filters} onFiltersChange={handleFiltersChange} />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
