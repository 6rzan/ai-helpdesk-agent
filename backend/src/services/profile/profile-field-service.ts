import type { HydratedDocument, Types } from "mongoose";
import { ConflictError } from "../../lib/errors.js";
import type { FieldActorKind, ProfileField } from "../../models/enums.js";
import { ProfileFieldHistory } from "../../models/profile-field-history.js";
import { SupportProfile, type SupportProfileDoc } from "../../models/support-profile.js";

/**
 * Per-field authority, provenance, concurrency, and history (007 T030).
 *
 * FR-016, FR-020 to FR-024, FR-029; research.md R5, R6, R7; data-model.md §4.
 *
 * The rules this file owns, and why each is here rather than in a route:
 *
 *   - **A field's value and who set it move together.** They are written in one place so
 *     a value can never be saved without its provenance, which is the failure that would
 *     make every byline on every surface untrustworthy.
 *   - **Concurrency is per field.** The token is the field's own `setAt` as the client
 *     loaded it. Refusing a whole request because one field moved would make staff retype
 *     work that was never in conflict; accepting it would silently discard a colleague's
 *     correction.
 *   - **History is appended, never rewritten.** A `value` entry records what the field
 *     held *before*, because the current value already lives on the profile and a second
 *     copy is a second thing that can disagree.
 *   - **A staff write over an owner-controlled field is two events**, a value change and
 *     a control transfer, and it appends one entry for each. Collapsing them into one
 *     would lose the answer to "when did staff take this over".
 */

export type ProfileFieldValue = string | { tool: string; id: string }[];

/** What the client believed the field's `setAt` was when it loaded, as an ISO string, or
 * `null` for "this had never been set". */
export type ExpectedSetAt = string | null;

export interface FieldSubmission {
  value: ProfileFieldValue;
  expectedSetAt: ExpectedSetAt;
}

export type FieldOutcome =
  | { outcome: "applied" }
  /** Staff path: the field moved since `expectedSetAt`. Carries what would have been
   * overwritten, so the staff member can see it rather than guess. */
  | {
      outcome: "conflict";
      currentValue: ProfileFieldValue;
      currentSetByName: string | null;
      currentSetAt: string | null;
    }
  /** Owner path: staff control this field. */
  | { outcome: "locked"; currentSetByName: string | null; currentSetAt: string | null };

export type FieldResults = Partial<Record<ProfileField, FieldOutcome>>;

export interface FieldActor {
  id: Types.ObjectId;
  name: string;
  kind: FieldActorKind;
}

interface StoredFieldState {
  setByKind?: FieldActorKind | null;
  setById?: Types.ObjectId | null;
  setByName?: string | null;
  setAt?: Date | null;
  controlledBy?: "owner" | "staff";
}

type ProfileDoc = HydratedDocument<SupportProfileDoc>;

/** Loads the profile, creating an empty one if the account has never had a profile.
 *
 * An account with no profile is not an error: FR-016 makes the staff save work on an
 * account that has never filled anything in, and returning `404` there would be the
 * system saying "no such person" about someone who is standing at the desk. */
async function loadOrCreate(accountId: Types.ObjectId): Promise<ProfileDoc> {
  const existing = await SupportProfile.findOne({ accountId });
  if (existing) return existing as ProfileDoc;
  return (await SupportProfile.create({ accountId })) as ProfileDoc;
}

function stateOf(profile: ProfileDoc, field: ProfileField): StoredFieldState {
  const state = profile.fieldState?.[field] as StoredFieldState | undefined;
  // A pre-feature document has no `fieldState` at all. Reading it as owner-controlled
  // with no recorded author is what lets the two releases coexist without a migration
  // (research.md R8) — and it is the truth: nobody recorded who set those values.
  return state ?? { controlledBy: "owner" };
}

function currentValueOf(profile: ProfileDoc, field: ProfileField): ProfileFieldValue {
  if (field === "remoteAccessIds") {
    return profile.remoteAccessIds.map((entry) => ({ tool: entry.tool, id: entry.id }));
  }
  return profile[field] ?? "";
}

function setValueOn(profile: ProfileDoc, field: ProfileField, value: ProfileFieldValue): void {
  if (field === "remoteAccessIds") {
    profile.set("remoteAccessIds", value as { tool: string; id: string }[]);
    return;
  }
  profile.set(field, value as string);
}

function isoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/**
 * Does the client's token still describe the field?
 *
 * `null` means "never set when I loaded it", and it has to be checked rather than waved
 * through: a field that was empty on load and has since been filled in is exactly the
 * case that would otherwise be a silent overwrite.
 */
function tokenMatches(stored: Date | null | undefined, expected: ExpectedSetAt): boolean {
  const storedIso = isoOrNull(stored ?? null);
  if (storedIso === null || expected === null) return storedIso === expected;
  return new Date(storedIso).getTime() === new Date(expected).getTime();
}

interface HistoryAppend {
  accountId: Types.ObjectId;
  field: ProfileField;
  changeKind: "value" | "control";
  previousValue?: ProfileFieldValue | null;
  previousSetByKind?: FieldActorKind | null;
  previousSetByName?: string | null;
  previousSetAt?: Date | null;
  newControlledBy?: "owner" | "staff";
  actor: FieldActor;
  at: Date;
}

async function appendHistory(entries: HistoryAppend[]): Promise<void> {
  if (entries.length === 0) return;
  await ProfileFieldHistory.insertMany(
    entries.map((entry) => ({
      accountId: entry.accountId,
      field: entry.field,
      changeKind: entry.changeKind,
      previousValue: entry.previousValue ?? null,
      previousSetByKind: entry.previousSetByKind ?? null,
      previousSetByName: entry.previousSetByName ?? null,
      previousSetAt: entry.previousSetAt ?? null,
      newControlledBy: entry.newControlledBy ?? null,
      actorKind: entry.actor.kind,
      actorId: entry.actor.id,
      actorName: entry.actor.name,
      at: entry.at,
    })),
  );
}

export interface SetFieldsResult {
  results: FieldResults;
  profile: ProfileDoc;
  /** The fields that were actually written. The caller records **only** these in the
   * audit (FR-026): naming a refused field would describe a change that never happened. */
  applied: ProfileField[];
}

/**
 * Staff set one or more fields authoritatively.
 *
 * A staff-set value **becomes** the field's value, replacing the arrangement where a
 * staff correction sat beside a stale owner value and the reader had to decide which one
 * to believe (FR-016, research.md R5).
 */
export async function setFieldsAsStaff(input: {
  accountId: Types.ObjectId;
  staff: FieldActor;
  fields: Partial<Record<ProfileField, FieldSubmission>>;
}): Promise<SetFieldsResult> {
  const profile = await loadOrCreate(input.accountId);
  const results: FieldResults = {};
  const applied: ProfileField[] = [];
  const history: HistoryAppend[] = [];
  const at = new Date();

  for (const [name, submission] of Object.entries(input.fields)) {
    const field = name as ProfileField;
    const state = stateOf(profile, field);

    if (!tokenMatches(state.setAt ?? null, submission.expectedSetAt)) {
      results[field] = {
        outcome: "conflict",
        currentValue: currentValueOf(profile, field),
        currentSetByName: state.setByName ?? null,
        currentSetAt: isoOrNull(state.setAt ?? null),
      };
      continue;
    }

    // The value entry records what is being replaced, including who had set it. After
    // this loop the profile holds the new value and nothing remembers the old one.
    history.push({
      accountId: input.accountId,
      field,
      changeKind: "value",
      previousValue: currentValueOf(profile, field),
      previousSetByKind: state.setByKind ?? null,
      previousSetByName: state.setByName ?? null,
      previousSetAt: state.setAt ?? null,
      actor: input.staff,
      at,
    });

    if ((state.controlledBy ?? "owner") !== "staff") {
      // Two things happened, so two entries. "When did staff take this field over" is a
      // question the history has to answer on its own.
      history.push({
        accountId: input.accountId,
        field,
        changeKind: "control",
        newControlledBy: "staff",
        actor: input.staff,
        at,
      });
    }

    setValueOn(profile, field, submission.value);
    profile.set(`fieldState.${field}`, {
      setByKind: "staff",
      setById: input.staff.id,
      setByName: input.staff.name,
      setAt: at,
      controlledBy: "staff",
    });
    results[field] = { outcome: "applied" };
    applied.push(field);
  }

  if (applied.length > 0) {
    await profile.save();
    await appendHistory(history);
  }

  return { results, profile, applied };
}

/**
 * The account owner edits their own profile.
 *
 * A field staff control is refused with an explanation rather than applied silently or
 * dropped without a word — this is the "locked after the page opened" case (FR-021,
 * FR-022). Control never moves on this path: an owner cannot take a field back by
 * writing to it, or the release would mean nothing.
 */
export async function setFieldsAsOwner(input: {
  accountId: Types.ObjectId;
  owner: FieldActor;
  fields: Partial<Record<ProfileField, ProfileFieldValue>>;
}): Promise<SetFieldsResult> {
  const profile = await loadOrCreate(input.accountId);
  const results: FieldResults = {};
  const applied: ProfileField[] = [];
  const history: HistoryAppend[] = [];
  const at = new Date();

  for (const [name, value] of Object.entries(input.fields)) {
    const field = name as ProfileField;
    const state = stateOf(profile, field);

    if ((state.controlledBy ?? "owner") === "staff") {
      results[field] = {
        outcome: "locked",
        currentSetByName: state.setByName ?? null,
        currentSetAt: isoOrNull(state.setAt ?? null),
      };
      continue;
    }

    // FR-018 retains every field's previous value regardless of who wrote it. The owner
    // simply has no route that reads it back.
    history.push({
      accountId: input.accountId,
      field,
      changeKind: "value",
      previousValue: currentValueOf(profile, field),
      previousSetByKind: state.setByKind ?? null,
      previousSetByName: state.setByName ?? null,
      previousSetAt: state.setAt ?? null,
      actor: input.owner,
      at,
    });

    setValueOn(profile, field, value as ProfileFieldValue);
    profile.set(`fieldState.${field}`, {
      setByKind: "owner",
      setById: input.owner.id,
      setByName: input.owner.name,
      setAt: at,
      // Unchanged, and unchangeable from here.
      controlledBy: "owner",
    });
    results[field] = { outcome: "applied" };
    applied.push(field);
  }

  if (applied.length > 0) {
    await profile.save();
    await appendHistory(history);
  }

  return { results, profile, applied };
}

/**
 * Staff hand a field back to the account owner (FR-023).
 *
 * **The value, its author, and its time are left exactly as they are.** Releasing says
 * "the owner may change this again", not "staff never set this". Wiping the provenance
 * would erase a true record of who set the value that is still displayed.
 *
 * The `409` exists so the rule holds against a direct request; the interface offers no
 * release control on an owner-controlled field at all.
 */
export async function releaseField(input: {
  accountId: Types.ObjectId;
  field: ProfileField;
  staff: FieldActor;
}): Promise<ProfileDoc> {
  const profile = await loadOrCreate(input.accountId);
  const state = stateOf(profile, input.field);

  if ((state.controlledBy ?? "owner") !== "staff") {
    throw new ConflictError(
      "This field is already the account owner's to edit",
      "FIELD_NOT_STAFF_CONTROLLED",
    );
  }

  profile.set(`fieldState.${input.field}.controlledBy`, "owner");
  await profile.save();

  await appendHistory([
    {
      accountId: input.accountId,
      field: input.field,
      changeKind: "control",
      newControlledBy: "owner",
      actor: input.staff,
      at: new Date(),
    },
  ]);

  return profile;
}

/** One field's history, newest first. Staff only; there is no owner equivalent (FR-018). */
export async function getFieldHistory(accountId: Types.ObjectId, field: ProfileField) {
  const entries = await ProfileFieldHistory.find({ accountId, field }).sort({ at: -1 }).lean();
  return entries.map((entry) => ({
    changeKind: entry.changeKind,
    previousValue: entry.previousValue ?? null,
    previousSetByKind: entry.previousSetByKind ?? null,
    previousSetByName: entry.previousSetByName ?? null,
    previousSetAt: entry.previousSetAt ? entry.previousSetAt.toISOString() : null,
    newControlledBy: entry.newControlledBy ?? null,
    actorKind: entry.actorKind,
    actorId: entry.actorId ? String(entry.actorId) : null,
    actorName: entry.actorName ?? null,
    at: entry.at.toISOString(),
  }));
}
