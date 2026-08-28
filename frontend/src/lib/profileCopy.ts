/**
 * The profile provenance and lock copy, written once (007 T024).
 *
 * Three surfaces render these sentences — the owner's own profile, the staff profile
 * page, and the reporter profile panel on a ticket — and the Design Direction names them
 * as strings a builder must not invent per page. Two reasons they live in one module:
 *
 *   - **SC-009 is measured on `LOCKED_FIELD_EXPLANATION`.** An account owner has to
 *     state, unaided, why a field is locked and how to get it changed. That is a claim
 *     about one specific sentence, and it cannot be evaluated if each page phrases it
 *     differently.
 *   - A byline that reads one way on the owner's profile and another way on the ticket
 *     panel makes the same fact look like two different facts.
 *
 * Owner-facing wording follows NFR-2: short, plain, no jargon. "Locked" is acceptable
 * owner vocabulary; "provenance", "authoritative", and "field control" are not, and none
 * of them appear in any string here. No em-dashes anywhere (Design Direction).
 */

/** How a date and time is written in a byline, everywhere. */
export function formatSetAt(setAt: string): string {
  return new Date(setAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The one provenance byline. Muted one-line text under a value, never a badge or a pill.
 *
 * @param setByName who set the value, or `null` when nothing was recorded
 * @param setAt when it was set, or `null`
 */
export function provenanceByline(setByName: string | null, setAt: string | null): string {
  if (!setByName || !setAt) return NO_RECORDED_AUTHOR_BYLINE;
  return `Set by ${setByName}, ${formatSetAt(setAt)}`;
}

/**
 * The byline for a value that predates this feature.
 *
 * Profiles written before 007 carry no author and no timestamp, and no migration
 * invents one. Saying so plainly is better than an empty byline, which reads as a
 * rendering bug, and better than guessing an author, which would be a false record.
 */
export const NO_RECORDED_AUTHOR_BYLINE = "No record of who set this or when";

/**
 * The one locked-field explanation. **SC-009 is measured on this sentence.**
 *
 * It has to answer two questions on its own, sitting on the field itself rather than in
 * a page banner: why the owner cannot edit this, and what to do about it. A sentence
 * that answers only the first leaves the owner stuck, which is the exact outcome SC-010
 * exists to prevent.
 */
export const LOCKED_FIELD_EXPLANATION =
  "IT staff keep this detail up to date, so you cannot change it here. If it is wrong, ask IT staff to correct it.";

/**
 * Shown when every field on the owner's profile is staff-set.
 *
 * A designed state, not an accident: without it the page reads as a broken form whose
 * save button has gone missing.
 */
export const ALL_FIELDS_LOCKED_EXPLANATION =
  "IT staff keep all of these details up to date for you, so there is nothing to fill in here. This is what they will see when you report a problem. If anything is wrong, ask IT staff to correct it.";

/**
 * Shown on a field the owner tried to save that staff had taken over in the meantime.
 *
 * The owner's typed value is not silently dropped: the refusal says what happened and
 * what the field now holds.
 */
export const LOCKED_ON_SAVE_EXPLANATION =
  "IT staff set this detail while you had the page open, so your change was not saved. The value they set is shown above.";

/** Staff-facing. A field the owner controls, which staff can take over by setting it. */
export const OWNER_CONTROLLED_NOTE = "The account owner can edit this.";

/** Staff-facing. A field staff have taken over, which can be handed back. */
export const STAFF_CONTROLLED_NOTE = "Staff set this. The account owner cannot edit it.";

/**
 * Staff-facing. Another staff member changed the field while this one was typing.
 *
 * Reported on the field, never as a page-level banner, and never by discarding what was
 * typed: the Design Direction names losing the typed value as the most likely bug in
 * this feature.
 */
export function conflictExplanation(currentSetByName: string | null, currentSetAt: string | null): string {
  const who =
    currentSetByName && currentSetAt
      ? `${currentSetByName} changed this on ${formatSetAt(currentSetAt)}`
      : "Someone else changed this";
  return `${who} while you were editing. Your text is still here. Check the current value above, then save again to replace it.`;
}
