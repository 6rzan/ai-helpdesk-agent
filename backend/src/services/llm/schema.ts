import { z } from "zod";
import { ISSUE_CATEGORIES } from "../../models/enums.js";

export const classificationOutputSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reply: z.string().min(1),
});

export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;
