// Support profile shapes: the profile itself, and the per-field provenance,
// control, history, and save-outcome types feature 007 added to it.
//
// Split out of `types.ts` at 007 T060, which had reached 719 lines against the
// constitution's 500-line limit (Principle VI). The seam is a domain one rather
// than a line-count one: everything here describes one account's support profile,
// and nothing here needs anything from `types.ts`, so this module imports nothing
// at all and `types.ts` re-exports it. Every existing `from "../lib/types"` import
// keeps working unchanged.
//
// Two conventions run through the 007 half of this file and are stated once here
// rather than repeated on every field:
//
//   1. Every provenance field is nullable. A profile written before that feature
//      has a real value but no recorded author or time, and that is a state the
//      client renders rather than an error (contracts/api.md, research.md R8).
//   2. `remoteAccessIds` is one field, not a list of fields. Adding or removing
//      an entry is a change to the whole field, which is why it carries a single
//      `FieldState` and a single history stream (FR-019, research.md R11).

export interface RemoteAccessId {
  tool: string;
  id: string;
}

export interface ProfileStaffEntry {
  kind: "note" | "correction";
  field: "remoteAccessIds" | "location" | "hardware" | null;
  value: string;
  staffId: string;
  staffName: string;
  at: string;
}

export interface SupportProfile {
  remoteAccessIds: RemoteAccessId[];
  location: string;
  hardware: string;
  staffEntries: ProfileStaffEntry[];
  fieldState?: ProfileFieldStateMap;
}

/** The reporter's support profile, surfaced to handling staff on escalated tickets
 * (FR-013). `null` when no account is linked or no profile exists.
 *
 * 007: `fieldState` is optional on this type rather than required, because a
 * response produced before this feature shipped carries no such key. Making it
 * required here would have forced every consumer to assert a shape the server
 * does not always send. */
export interface SupportProfileView {
  remoteAccessIds: RemoteAccessId[];
  location: string;
  hardware: string;
  staffEntries: ProfileStaffEntry[];
  fieldState?: ProfileFieldStateMap;
}

// --- 007: per-field provenance and control -----------------------------------

/** The three profile fields this feature makes authoritative. FR-028 fixes the
 * set at exactly these; nothing is added without a requirement change. */
export type ProfileFieldName = "location" | "hardware" | "remoteAccessIds";

/** Who last wrote a field's value. `owner` is the account holder; `staff` is any
 * staff member acting through the staff surface. */
export type FieldActorKind = "owner" | "staff";

/** Who may currently edit a field. A staff write moves control to `staff`; a
 * release returns it to `owner` (FR-023). */
export type FieldControl = "owner" | "staff";

/** Provenance and control for one profile field.
 *
 * All four provenance members are nullable together: a pre-feature profile has a
 * value with no recorded authorship, and `setByName: null` with `setAt: null` is
 * the shape that says so. `controlledBy` is never null, because a field with no
 * recorded staff claim is owner-controlled by definition rather than by absence. */
export interface FieldState {
  setByKind: FieldActorKind | null;
  setById: string | null;
  setByName: string | null;
  setAt: string | null;
  controlledBy: FieldControl;
}

export type ProfileFieldStateMap = Record<ProfileFieldName, FieldState>;

// --- 007: field history ------------------------------------------------------

/** The value a field held before a change. Typed per field: a string for
 * `location` and `hardware`, the whole list for `remoteAccessIds`. */
export type ProfileFieldValue = string | RemoteAccessId[];

/** One entry in a field's history (contracts/api.md, data-model.md §4).
 *
 * `changeKind` distinguishes the two things that can happen to a field, and the
 * two carry different members: a `value` entry records what the field held before,
 * a `control` entry records where control moved to. A single staff write that also
 * takes control appends one of each rather than one combined entry, so the history
 * never conflates "the value changed" with "who may edit it changed". */
export interface ProfileFieldHistoryEntry {
  changeKind: "value" | "control";
  previousValue?: ProfileFieldValue | null;
  previousSetByKind?: FieldActorKind | null;
  previousSetByName?: string | null;
  previousSetAt?: string | null;
  newControlledBy?: FieldControl;
  actorKind: FieldActorKind;
  actorId: string | null;
  actorName: string | null;
  at: string;
}

export interface ProfileFieldHistoryResponse {
  history: ProfileFieldHistoryEntry[];
}

// --- 007: per-field save outcomes --------------------------------------------

/** Outcome of one field within a save.
 *
 * `applied` and `conflict` come from the staff endpoint; `applied` and `locked`
 * come from the owner endpoint. They share one union because both endpoints
 * return the same per-field map shape and the client renders them the same way
 * — per field, never as a page-level banner (FR-029, contracts/api.md rule 3). */
export type ProfileFieldOutcomeKind = "applied" | "conflict" | "locked";

export interface ProfileFieldApplied {
  outcome: "applied";
}

/** A staff save refused because the field moved since the client loaded it. The
 * current value, author, and time are carried so the staff member can see what
 * they would have overwritten rather than only that they failed (FR-029). */
export interface ProfileFieldConflict {
  outcome: "conflict";
  currentValue: ProfileFieldValue;
  currentSetByName: string | null;
  currentSetAt: string | null;
}

/** An owner save refused because staff control the field. Who set it and when are
 * carried so the page can explain rather than just refuse (FR-021, FR-022). */
export interface ProfileFieldLocked {
  outcome: "locked";
  currentSetByName: string | null;
  currentSetAt: string | null;
}

export type ProfileFieldOutcome =
  | ProfileFieldApplied
  | ProfileFieldConflict
  | ProfileFieldLocked;

/** Per-field results. Partial because a save reports only the fields it was sent,
 * and a mixed result is a `200` rather than a failure (contracts/api.md). */
export type ProfileFieldResults = Partial<Record<ProfileFieldName, ProfileFieldOutcome>>;

// --- 007: save requests and responses ----------------------------------------

/** One field in a save request. `expectedSetAt: null` asserts "this field had never
 * been set when I loaded it" — which is what stops last-write-wins on a field that
 * was empty at load and has been filled since. */
export interface ProfileFieldSubmission {
  value: ProfileFieldValue;
  expectedSetAt: string | null;
}

export type ProfileFieldSubmissions = Partial<
  Record<ProfileFieldName, ProfileFieldSubmission>
>;

export interface ProfileFieldsSaveRequest {
  fields: ProfileFieldSubmissions;
}

/** Response to either profile save. The full profile is returned alongside the
 * results so the client never has to reload to learn the post-save state. */
export interface ProfileFieldsSaveResponse {
  results: ProfileFieldResults;
  profile: SupportProfileView;
}

export interface StaffProfileResponse {
  profile: SupportProfileView;
}
