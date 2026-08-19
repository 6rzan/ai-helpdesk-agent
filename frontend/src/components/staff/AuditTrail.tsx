import { ActionRecordCard } from "../ActionRecordCard";
import type { ActionOutcome, ActionRecord } from "../../lib/types";

export interface AuditTrailFilters {
  ticketId?: string;
  endpointId?: string;
  outcome?: ActionOutcome | "";
}

interface AuditTrailProps {
  records: ActionRecord[];
  filters: AuditTrailFilters;
  onFiltersChange: (filters: AuditTrailFilters) => void;
}

const OUTCOME_OPTIONS: { value: ActionOutcome | ""; label: string }[] = [
  { value: "", label: "All outcomes" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "timed_out", label: "Timed out" },
  { value: "attempted_unverified", label: "Attempted, unverified" },
  { value: "refused", label: "Refused" },
];

/** T094/Design Direction: the complete audit trail across all tickets, over
 * the shared ActionRecordCard atom (US4 AS2). Deliberately no edit, delete,
 * or overflow affordance anywhere -- append-only made visible, not merely
 * true (US4 AS5, FR-010, R7). Filters are ticket, endpoint, and outcome. */
export function AuditTrail({ records, filters, onFiltersChange }: AuditTrailProps) {
  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Ticket
          <input
            type="text"
            value={filters.ticketId ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, ticketId: e.target.value || undefined })}
            placeholder="TICK-0001"
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Endpoint
          <input
            type="text"
            value={filters.endpointId ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, endpointId: e.target.value || undefined })}
            placeholder="test-node-a"
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Outcome
          <select
            value={filters.outcome ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, outcome: e.target.value as ActionOutcome | "" })}
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800"
          >
            {OUTCOME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {records.length === 0 ? (
        <p className="rounded border border-gray-200 py-8 text-center text-sm text-gray-400">
          No actions match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((record) => (
            <ActionRecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
