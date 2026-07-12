import { z } from "zod";

// Category is a free-form string, not a static enum: classifier.ts validates
// it against the live categories collection and falls back to "unclassified"
// for unrecognized names (R2).
export const classificationOutputSchema = z.object({
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reply: z.string().min(1),
});

export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;

export const STEP_REPLY_OUTCOMES = [
  "worked",
  "not_worked",
  "already_tried",
  "question",
  "wants_human",
  "unclear",
] as const;

export const stepReplyOutputSchema = z.object({
  outcome: z.enum(STEP_REPLY_OUTCOMES),
  confidence: z.number().min(0).max(1),
  reply: z.string().min(1),
});

export type StepReplyOutput = z.infer<typeof stepReplyOutputSchema>;
