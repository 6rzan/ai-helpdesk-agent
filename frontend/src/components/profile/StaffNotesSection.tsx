import type { FormEvent } from "react";
import type { SupportProfile } from "../../lib/types";

/**
 * Staff notes (007 T037).
 *
 * The `correction` entry kind is **gone from this form**. 003 used a correction as the
 * way to say "this value is wrong" without being able to change it; 007 lets staff set
 * the value itself, so the workaround has no job left and the server refuses the write
 * (`CORRECTION_WRITE_RETIRED`). Leaving the option in the dropdown would offer a choice
 * whose only outcome is an error.
 *
 * Corrections **already recorded** still render, labelled as the historical notes they
 * are. They are not values, they never were, and deleting them to tidy the interface
 * would destroy the record of what staff observed before the field could be set.
 */

interface Props {
  profile: SupportProfile;
  value: string;
  isBusy: boolean;
  isSubmitting: boolean;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

const FIELD_LABELS: Record<string, string> = {
  remoteAccessIds: "remote access IDs",
  location: "location",
  hardware: "device or asset details",
};

export function StaffNotesSection({
  profile,
  value,
  isBusy,
  isSubmitting,
  onValueChange,
  onSubmit,
}: Props) {
  return (
    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">Staff notes</h2>
      <p className="mt-1 text-xs text-gray-600">
        A note records something worth knowing about this account. To change a support
        detail, edit the field itself above.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label htmlFor="staff-note" className="text-sm text-gray-700">
          Note
        </label>
        <textarea
          id="staff-note"
          required
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="block min-h-24 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          disabled={isBusy}
          className="w-fit rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add attributed note"}
        </button>
      </form>
      {profile.staffEntries.length > 0 && (
        <ul className="mt-5 divide-y border-t border-gray-100">
          {profile.staffEntries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="py-3 text-sm">
              <p className="text-gray-800">{entry.value}</p>
              <p className="mt-1 text-xs text-gray-500">
                {entry.kind === "correction"
                  ? `Earlier note about ${FIELD_LABELS[entry.field ?? ""] ?? "this profile"}`
                  : "Note"}{" "}
                · {entry.staffName} · {new Date(entry.at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
