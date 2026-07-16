import type { HydratedDocument, Types } from "mongoose";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { SupportProfile, type ProfileField, type StaffEntryKind, type SupportProfileDoc } from "../../models/support-profile.js";
import type { UserAccountDoc } from "../../models/user-account.js";

export interface ProfileInput {
  remoteAccessIds?: { tool: string; id: string }[] | undefined;
  location?: string | undefined;
  hardware?: string | undefined;
}

function view(profile: HydratedDocument<SupportProfileDoc>) {
  return {
    remoteAccessIds: profile.remoteAccessIds.map((entry) => ({ tool: entry.tool, id: entry.id })),
    location: profile.location,
    hardware: profile.hardware,
    staffEntries: profile.staffEntries.map((entry) => ({
      kind: entry.kind, field: entry.field, value: entry.value,
      staffId: String(entry.staffId), staffName: entry.staffName, at: entry.at,
    })),
  };
}

export async function getOwnProfile(accountId: Types.ObjectId) {
  const profile = await SupportProfile.findOne({ accountId });
  return profile ? view(profile as HydratedDocument<SupportProfileDoc>) : { remoteAccessIds: [], location: "", hardware: "", staffEntries: [] };
}

export async function updateOwnProfile(accountId: Types.ObjectId, input: ProfileInput) {
  const profile = await SupportProfile.findOneAndUpdate({ accountId }, { $set: input }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return view(profile as HydratedDocument<SupportProfileDoc>);
}

export async function getProfile(accountId: Types.ObjectId) {
  return getOwnProfile(accountId);
}

export async function appendStaffEntry(input: {
  accountId: Types.ObjectId; staff: HydratedDocument<UserAccountDoc>; kind: StaffEntryKind; field?: ProfileField; value: string;
}) {
  if (input.kind === "correction" && !input.field) {
    throw new ValidationError("A correction must name the field it corrects", "MISSING_CORRECTION_FIELD");
  }
  const profile = await SupportProfile.findOneAndUpdate(
    { accountId: input.accountId },
    { $push: { staffEntries: { kind: input.kind, field: input.field ?? null, value: input.value, staffId: input.staff._id, staffName: input.staff.displayName, at: new Date() } } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!profile) throw new NotFoundError("Profile could not be updated", "PROFILE_NOT_FOUND");
  return view(profile as HydratedDocument<SupportProfileDoc>);
}
