import type { ReactNode } from "react";
import type { FieldState, ProfileFieldOutcome } from "../../lib/types";
import {
  LOCKED_FIELD_EXPLANATION,
  LOCKED_ON_SAVE_EXPLANATION,
  OWNER_CONTROLLED_NOTE,
  STAFF_CONTROLLED_NOTE,
  conflictExplanation,
  provenanceByline,
} from "../../lib/profileCopy";

/**
 * One profile field: its value, who set it, whether it can be edited, and what happened
 * the last time someone tried (007 T034, FR-022, Design Direction §5 and §6).
 *
 * Four things this component is built to get right, each of them a specific way the
 * naive version goes wrong:
 *
 *   1. **A locked field is read-only text, never a disabled input.** A `disabled` input
 *      still looks like a form control the person failed to use. Text with a sentence
 *      under it looks like a fact, which is what it is.
 *   2. **A lock is not a warning.** No amber, no red, no alert icon. A staff-set field is
 *      the system working correctly; colouring it as a problem tells the owner they did
 *      something wrong.
 *   3. **Provenance is a byline, not a badge.** Muted one-line text under the value.
 *      `StatusBadge` stays the single source of ticket-status colour and never absorbs
 *      this.
 *   4. **A conflict never discards what was typed.** The message appears under the field
 *      the person is looking at, with their text still in it.
 */

interface Props {
  /** The visible label. Sits above the control, as everywhere else in this application. */
  label: string;
  /** Ties the label, the control, and the messages together for assistive technology. */
  id: string;
  state: FieldState | undefined;
  /** Rendered when the field is editable. */
  children: ReactNode;
  /** Rendered when the field is read-only, in place of the control. */
  readOnlyValue: ReactNode;
  /** Who is looking. The owner is told they cannot edit a staff-set field; staff are
   * told who currently controls it. */
  audience: "owner" | "staff";
  outcome?: ProfileFieldOutcome | undefined;
  /** Staff-only: hand the field back. Absent on an owner-controlled field, because there
   * is nothing to hand back (FR-023). */
  onRelease?: (() => void) | undefined;
  isReleasing?: boolean;
  /** Staff-only: the field history disclosure. Never passed on the owner's page — FR-018
   * makes history staff-only and its absence there is the design. */
  history?: ReactNode;
  hint?: string;
}

export function ProfileField({
  label,
  id,
  state,
  children,
  readOnlyValue,
  audience,
  outcome,
  onRelease,
  isReleasing,
  history,
  hint,
}: Props) {
  const controlledBy = state?.controlledBy ?? "owner";
  const isLockedForOwner = audience === "owner" && controlledBy === "staff";
  const byline = provenanceByline(state?.setByName ?? null, state?.setAt ?? null);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label above the control. A floating or inline label would be a second pattern
          in a form that already has one. */}
      <label htmlFor={id} className="text-sm text-gray-700">
        {label}
      </label>

      {isLockedForOwner ? (
        <>
          <p id={id} className="text-sm text-gray-900">
            {readOnlyValue}
          </p>
          {/* Neutral. The explanation sits on the field, because control is per field and
              a page-level notice cannot say which one it means. */}
          <p className="text-xs text-gray-600">{LOCKED_FIELD_EXPLANATION}</p>
        </>
      ) : (
        children
      )}

      {hint && !isLockedForOwner && <p className="text-xs text-gray-600">{hint}</p>}

      <p className="text-xs text-gray-500">{byline}</p>

      {audience === "staff" && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600">
            {controlledBy === "staff" ? STAFF_CONTROLLED_NOTE : OWNER_CONTROLLED_NOTE}
          </span>
          {/* Offered only where it means something. On an owner-controlled field there is
              nothing to release, and a disabled control there would invite a click and
              then explain itself. */}
          {controlledBy === "staff" && onRelease && (
            <button
              type="button"
              onClick={onRelease}
              disabled={isReleasing}
              className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {isReleasing ? "Returning…" : "Return to the account owner"}
            </button>
          )}
        </div>
      )}

      {outcome && <FieldOutcomeNotice outcome={outcome} />}

      {history}
    </div>
  );
}

/**
 * What happened to this field on the last save.
 *
 * Per field, never a page-level banner: a banner cannot say which of three fields it is
 * about, and the person is looking at the field.
 */
function FieldOutcomeNotice({ outcome }: { outcome: ProfileFieldOutcome }) {
  if (outcome.outcome === "applied") {
    return (
      <p role="status" className="text-xs text-emerald-700">
        Saved.
      </p>
    );
  }

  if (outcome.outcome === "conflict") {
    return (
      <p role="alert" className="text-xs text-gray-900">
        {conflictExplanation(outcome.currentSetByName, outcome.currentSetAt)}
      </p>
    );
  }

  // Locked on save: staff took the field over while the page was open. Neutral, like
  // every other lock, and it says what happened to the text the owner typed rather than
  // leaving them to work out why nothing changed.
  return (
    <p role="alert" className="text-xs text-gray-900">
      {LOCKED_ON_SAVE_EXPLANATION}
    </p>
  );
}
