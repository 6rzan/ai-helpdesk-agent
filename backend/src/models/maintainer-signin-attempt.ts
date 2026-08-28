import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * One refused maintainer sign-in attempt (data-model.md §5, FR-035).
 *
 * Append-only, in the same discipline feature 005 applies to action records: there is
 * no update and no delete path at any layer, and the service that owns this collection
 * exposes only a read (to count) and an append (to record a refusal).
 *
 * **The schema has no field capable of holding the submitted key, and that absence is
 * the requirement rather than an oversight.** `clientKey` is a hash of the caller's
 * address, not the secret they guessed. A record that stored the attempted key would
 * turn a throttle — a control that exists to make guessing expensive — into a written
 * list of guesses, one of which is eventually correct.
 *
 * Only refusals are written. There is no `outcome: "succeeded"` value and no success
 * path, so this is a refusal record rather than a sign-in log that happens to include
 * failures. `outcome` is kept as an enum of one so a future second refusal *kind* can
 * be distinguished without a migration.
 */
const maintainerSignInAttemptSchema = new Schema(
  {
    // SHA-256 of the client address. Hashed rather than stored plainly because the
    // address is only ever compared for equality — nothing here needs to read it back.
    clientKey: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    outcome: { type: String, enum: ["refused"], required: true, default: "refused" },
  },
  { timestamps: false },
);

// The only query this collection serves: refusals for one client inside a time window,
// newest first.
maintainerSignInAttemptSchema.index({ clientKey: 1, at: -1 });

export type MaintainerSignInAttemptDoc = InferSchemaType<typeof maintainerSignInAttemptSchema> & {
  _id: Types.ObjectId;
};

export const MaintainerSignInAttempt: Model<MaintainerSignInAttemptDoc> =
  (mongoose.models.MaintainerSignInAttempt as Model<MaintainerSignInAttemptDoc> | undefined) ??
  model<MaintainerSignInAttemptDoc>("MaintainerSignInAttempt", maintainerSignInAttemptSchema);
