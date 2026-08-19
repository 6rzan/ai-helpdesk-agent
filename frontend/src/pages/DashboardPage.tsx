import { useCallback, useEffect, useMemo, useState } from "react";
import { listStaffTickets } from "../services/api";
import { useStaffEvents } from "../services/useEvents";
import { TicketList } from "../components/staff/TicketList";
import type { IssueCategory, StaffTicketFilters, StaffTicketRow, TicketStatus } from "../lib/types";

export function DashboardPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [sort, setSort] = useState<NonNullable<StaffTicketFilters["sort"]>>("newest");
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [updatedReferences, setUpdatedReferences] = useState<Set<string>>(new Set());

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
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Ticket dashboard</h1>
        <p className="text-sm text-gray-500">All reported issues across the organisation.</p>
      </header>

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
