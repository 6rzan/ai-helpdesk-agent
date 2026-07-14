import { useCallback, useEffect, useRef, useState } from "react";
import { getRoster } from "../services/api";
import type { Roster, RosterEntry } from "../lib/types";

interface AssigneePickerProps {
  label: string;
  onAssign: (accountId: string) => Promise<void>;
  disabled?: boolean;
}

function AvailabilityDot({ status }: { status: RosterEntry["availability"] }) {
  // The one semantic dot on the staff surface: green means available to take work.
  const className = status === "available" ? "bg-emerald-500" : "bg-gray-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

export function AssigneePicker({ label, onAssign, disabled }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    getRoster()
      .then((result) => {
        setRoster(result);
        // Advisory only: preselect the suggestion, but the staff member still confirms
        // explicitly — nothing is auto-assigned (FR-021).
        setSelected((prev) => prev || result.suggestedAssigneeId || "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load roster"));
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (!selected) {
      return;
    }
    setIsAssigning(true);
    setError(undefined);
    onAssign(selected)
      .then(() => setOpen(false))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to assign"))
      .finally(() => setIsAssigning(false));
  }, [selected, onAssign]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-64 rounded border border-gray-200 bg-white p-2 shadow-lg">
          {error && (
            <p role="alert" className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              {error}
            </p>
          )}
          {!roster ? (
            <p className="px-1 py-2 text-sm text-gray-400">Loading roster…</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto" role="listbox" aria-label="Choose an assignee">
              {roster.staff.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected === member.id}
                    onClick={() => setSelected(member.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${
                      selected === member.id ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AvailabilityDot status={member.availability} />
                      {member.displayName}
                      {roster.suggestedAssigneeId === member.id && (
                        <span
                          className={`rounded px-1 text-xs ${
                            selected === member.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          Suggested
                        </span>
                      )}
                    </span>
                    <span
                      className={`tabular-nums text-xs ${selected === member.id ? "text-blue-600" : "text-gray-400"}`}
                    >
                      {member.openCaseCount} open
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={!selected || isAssigning}
            onClick={handleConfirm}
            className="mt-2 w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:opacity-50"
          >
            {isAssigning ? "Assigning…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
