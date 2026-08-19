import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from "mongoose";

// research.md R4/T114: recorded whenever the chained LLM provider falls through
// to the next provider in the chain. Deliberately not the action audit trail
// (data-model.md §5, R4 "Alternatives considered") -- a provider fallback is an
// infrastructure event, not an executed-or-refused action, and mixing the two
// would dilute SC-002's claim that the audit trail contains exactly those and
// nothing else. Minimal by design: this collection exists to back the
// `providerFallbacks` metrics count; the human-readable detail is the warn-level
// structured log R4 also requires.
const providerFallbackEventSchema = new Schema(
  {
    at: { type: Date, required: true, default: () => new Date(), index: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: false, default: null },
    fromProvider: { type: String, required: true },
    toProvider: { type: String, required: true },
  },
  { timestamps: false },
);

export type ProviderFallbackEventDoc = InferSchemaType<typeof providerFallbackEventSchema> & { _id: Types.ObjectId };
export const ProviderFallbackEvent: Model<ProviderFallbackEventDoc> =
  (mongoose.models.ProviderFallbackEvent as Model<ProviderFallbackEventDoc> | undefined) ??
  model<ProviderFallbackEventDoc>("ProviderFallbackEvent", providerFallbackEventSchema);
