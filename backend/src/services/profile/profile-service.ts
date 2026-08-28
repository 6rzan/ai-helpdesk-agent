import type { HydratedDocument, Types } from "mongoose";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { FieldActorKind, FieldControl, ProfileField } from "../../models/enums.js";
import { PROFILE_FIELDS } from "../../models/enums.js";
import {
  SupportProfile,
  type StaffEntryKind,
  type SupportProfileDoc,
} from "../../models/support-profile.js";
import type { UserAccountDoc } from "../../models/user-account.js";

export interface ProfileInput {
  remoteAccessIds?: { tool: string; id: string }[] | undefined;
  location?: string | undefined;
  hardware?: string | undefined;
}

interface FieldStateView {
  setByKind: FieldActorKind | null;
  setById: string | null;
  setByName: string | null;
  setAt: Date | null;
  controlledBy: FieldControl;
}

interface StoredFieldState {
  setByKind?: FieldActorKind | null;
  setById?: Types.ObjectId | null;
  setByName?: string | null;
  setAt?: Date | null;
  controlledBy?: FieldControl;
}

const emptyProfileView = {
  remoteAccessIds: [] as { tool: string; id: string }[],
  location: "",
  hardware: "",
  staffEntries: [] as ReturnType<typeof staffEntryView>[],
  fieldState: defaultFieldState(),
};

function defaultFieldState(): Record<ProfileField, FieldStateView> {
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [
      field,
      { setByKind: null, setById: null, setByName: null, setAt: null, controlledBy: "owner" },
    ]),
  ) as Record<ProfileField, FieldStateView>;
}

function staffEntryView(entry: SupportProfileDoc["staffEntries"][number]) {
  return {
    kind: entry.kind,
    field: entry.field,
    value: entry.value,
    staffId: String(entry.staffId),
    staffName: entry.staffName,
    at: entry.at,
  };
}

/**
 * The one profile shape, for staff and owner alike.
 *
 * 007 T031 added `fieldState`, with two rules the rest of the feature leans on:
 *
 *   - **Lazy owner-controlled defaults.** A document written before this feature has no
 *     `fieldState`, and it reads back as owner-controlled with null authorship rather
 *     than being migrated. That is not a shortcut: nobody recorded who set those values,
 *     and inventing an author would put a false name in the record (research.md R8).
 *   - **Staff and owner get the same shape.** The owner needs `controlledBy` to know
 *     what is editable and `setBy*` to know who to ask, which is exactly what staff need.
 *     Two shapes would mean two chances for a byline to disagree with itself.
 *
 * **Field history is never part of this output**, on any path. FR-018 makes it staff-only
 * and it is served by its own route; including it here would leak it to the owner through
 * `GET /api/my/profile` the moment anyone reused this view.
 */
function view(profile: HydratedDocument<SupportProfileDoc>) {
  const stored = profile.fieldState as Record<string, StoredFieldState> | undefined;
  const fieldState = defaultFieldState();
  for (const field of PROFILE_FIELDS) {
    const state = stored?.[field];
    if (!state) continue;
    fieldState[field] = {
      setByKind: state.setByKind ?? null,
      setById: state.setById ? String(state.setById) : null,
      setByName: state.setByName ?? null,
      setAt: state.setAt ?? null,
      controlledBy: state.controlledBy ?? "owner",
    };
  }

  return {
    remoteAccessIds: profile.remoteAccessIds.map((entry) => ({ tool: entry.tool, id: entry.id })),
    location: profile.location,
    hardware: profile.hardware,
    staffEntries: profile.staffEntries.map(staffEntryView),
    fieldState,
  };
}

/** Exposed so the field service's callers can serialise the document they already hold
 * without a second read. */
export function toProfileView(profile: HydratedDocument<SupportProfileDoc>) {
  return view(profile);
}

export async function getOwnProfile(accountId: Types.ObjectId) {
  const profile = await SupportProfile.findOne({ accountId });
  return profile ? view(profile as HydratedDocument<SupportProfileDoc>) : { ...emptyProfileView };
}

export async function updateOwnProfile(accountId: Types.ObjectId, input: ProfileInput) {
  const profile = await SupportProfile.findOneAndUpdate(
    { accountId },
    { $set: input },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return view(profile as HydratedDocument<SupportProfileDoc>);
}

export async function getProfile(accountId: Types.ObjectId) {
  return getOwnProfile(accountId);
}

/**
 * Append a staff note.
 *
 * 007 T031 retired the `correction` **write** path. A correction existed to record a
 * value staff believed was right beside an owner value they could not change; staff can
 * now set the value itself (FR-016), so writing a new correction would be recording a
 * disagreement the system no longer has to have. Existing correction entries are left
 * exactly as they are and keep rendering: they are a true record of what staff wrote
 * (FR-025).
 */
export async function appendStaffEntry(input: {
  accountId: Types.ObjectId;
  staff: HydratedDocument<UserAccountDoc>;
  kind: StaffEntryKind;
  field?: ProfileField;
  value: string;
}) {
  if (input.kind !== "note") {
    throw new ValidationError(
      "Staff set a field's value directly rather than recording a correction beside it",
      "CORRECTION_WRITE_RETIRED",
    );
  }
  const profile = await SupportProfile.findOneAndUpdate(
    { accountId: input.accountId },
    {
      $push: {
        staffEntries: {
          kind: input.kind,
          field: input.field ?? null,
          value: input.value,
          staffId: input.staff._id,
          staffName: input.staff.displayName,
          at: new Date(),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!profile) throw new NotFoundError("Profile could not be updated", "PROFILE_NOT_FOUND");
  return view(profile as HydratedDocument<SupportProfileDoc>);
}
