import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

type CounterDoc = InferSchemaType<typeof counterSchema>;
const Counter: Model<CounterDoc> = (mongoose.models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return doc.seq;
}

export async function nextTicketReference(): Promise<string> {
  const seq = await nextSequence("ticket");
  return `HD-${String(seq).padStart(4, "0")}`;
}
