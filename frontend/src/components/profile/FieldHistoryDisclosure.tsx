import { useState } from "react";
import type { ProfileFieldHistoryEntry, ProfileFieldName } from "../../lib/types";
import { formatSetAt } from "../../lib/profileCopy";

/**
 * One field's previous values, for staff (007 T035, FR-018).
 *
 * **Staff-only, and its absence on the owner's own profile is the design.** There is no
 * collapsed version there, no disabled control, and no "ask staff to see history": an
 * affordance the owner can see and never use is worse than none, because it promises
 * something the system will not do.
 *
 * **Collapsed by default.** History answers "what did this used to say", which is a
 * question staff ask occasionally and never while they are trying to read the current
 * value. Expanded by default it would push the field below it off the screen.
 *
 * **Read-only by construction.** No edit, no delete, not even a disabled one, because no
 * endpoint exists and none will: the entries are the record of what was actually set.
 */

interface Props {
  field: ProfileFieldName;
  label: string;
  /** `null` until the disclosure has been opened once. History is fetched on demand so
   * three profile fields do not mean three extra requests on every page load. */
  entries: ProfileFieldHistoryEntry[] | null;
  onOpen: () => void;
  isLoading?: boolean;
}

export function FieldHistoryDisclosure({ field, label, entries, onOpen, isLoading }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  function toggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && entries === null) onOpen();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={`history-${field}`}
        className="self-start text-xs text-blue-600 hover:underline"
      >
        {isOpen ? `Hide previous ${label.toLowerCase()} values` : `Previous ${label.toLowerCase()} values`}
      </button>

      {isOpen && (
        <div id={`history-${field}`}>
          {isLoading && <p className="text-xs text-gray-600">Loading…</p>}

          {!isLoading && entries !== null && entries.length === 0 && (
            <p className="text-xs text-gray-600">
              Nothing has changed on this field since the system started keeping a record.
            </p>
          )}

          {!isLoading && entries !== null && entries.length > 0 && (
            // Newest first, as the server returns them: the most recent change is the one
            // being checked against nine times in ten.
            <ol className="flex flex-col gap-3 border-l border-gray-200 pl-3">
              {entries.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-col gap-0.5 text-xs">
                  <HistoryEntryBody entry={entry} />
                  <span className="text-gray-500">
                    {entry.actorName ?? "Not recorded"} · {formatSetAt(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryEntryBody({ entry }: { entry: ProfileFieldHistoryEntry }) {
  if (entry.changeKind === "control") {
    return (
      <span className="text-gray-900">
        {entry.newControlledBy === "owner"
          ? "Returned to the account owner"
          : "Taken over by staff"}
      </span>
    );
  }

  const previous = entry.previousValue;

  if (Array.isArray(previous)) {
    // The remote access list is one field, so its previous value is a list. Joining it
    // into a sentence would make two entries look like one value with a comma in it.
    if (previous.length === 0) {
      return <span className="text-gray-600">Was empty</span>;
    }
    return (
      <span className="flex flex-col gap-0.5">
        <span className="text-gray-600">Was:</span>
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-gray-900">
          {previous.map((remote, index) => (
            <li key={`${remote.tool}-${remote.id}-${index}`}>
              {remote.tool}: {remote.id}
            </li>
          ))}
        </ul>
      </span>
    );
  }

  if (!previous) {
    return <span className="text-gray-600">Was empty</span>;
  }

  return <span className="text-gray-900">Was: {previous}</span>;
}
