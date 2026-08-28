import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";
import {
  FIELD_ACTOR_KINDS,
  FIELD_CHANGE_KINDS,
  FIELD_CONTROLS,
  PROFILE_FIELDS,
} from "./enums.js";

/**
 * Append-only history of every change to a profile field (007 T027, data-model.md §4).
 *
 * **There is no update path and no delete path in any role.** Not for staff, not for the
 * account owner, not for the maintainer. A field's history is the record of what a
 * reporter was actually told and what staff actually recorded, and a record that can be
 * edited after the fact answers no question worth asking. The absence of a mutation
 * helper here is the enforcement: nothing in the codebase can rewrite an entry, so no
 * route can be built that does.
 *
 * Two kinds of entry, kept apart because they answer different questions:
 *
 *   - `value`  — the field's value changed. Carries what it was *before*, and who had
 *                set that, so the entry describes what was replaced rather than what
 *                replaced it. The current value already lives on the profile.
 *   - `control` — the field moved between owner and staff control, with no value change.
 *
 * A staff write over an owner-controlled field produces **both**, because two distinct
 * things happened and collapsing them would lose one.
 */

const profileFieldHistorySchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "UserAccount", required: true },
    field: { type: String, enum: PROFILE_FIELDS, required: true },
    changeKind: { type: String, enum: FIELD_CHANGE_KINDS, required: true },

    // `Mixed` because the previous value is typed per field: a string for `location` and
    // `hardware`, an array of `{tool, id}` for `remoteAccessIds` (research.md R11). A
    // single typed column would force one of the two into a stringified shape and lose
    // the structure the history is meant to preserve.
    previousValue: { type: Schema.Types.Mixed, default: null },
    previousSetByKind: { type: String, enum: FIELD_ACTOR_KINDS, default: null },
    previousSetByName: { type: String, default: null },
    previousSetAt: { type: Date, default: null },

    /** Only on a `control` entry. */
    newControlledBy: { type: String, enum: FIELD_CONTROLS, default: null },

    actorKind: { type: String, enum: FIELD_ACTOR_KINDS, required: true },
    // Null for a pre-feature or system-attributed actor. The name is stored alongside
    // the id rather than joined at read time, so a later display-name change does not
    // silently rewrite what the history says happened.
    actorId: { type: Schema.Types.ObjectId, ref: "UserAccount", default: null },
    actorName: { type: String, default: null },

    at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

// The only query this collection serves: one field's history, newest first.
profileFieldHistorySchema.index({ accountId: 1, field: 1, at: -1 });

export type ProfileFieldHistoryDoc = InferSchemaType<typeof profileFieldHistorySchema> & {
  _id: Types.ObjectId;
};

export const ProfileFieldHistory: Model<ProfileFieldHistoryDoc> =
  (mongoose.models.ProfileFieldHistory as Model<ProfileFieldHistoryDoc> | undefined) ??
  model<ProfileFieldHistoryDoc>("ProfileFieldHistory", profileFieldHistorySchema);
