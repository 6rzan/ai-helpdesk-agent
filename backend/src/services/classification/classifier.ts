import { config } from "../../config/index.js";
import { getLlmProvider } from "../llm/factory.js";
import { listClassificationCategories } from "../category/category-service.js";
import { UNCLASSIFIED_CATEGORY } from "../../models/enums.js";
import type { ClassifyAndReplyInput, LlmProvider } from "../llm/types.js";
import type { IssueCategory } from "../../models/enums.js";

export type ClassifyOutcome =
  | { outcome: "classified"; category: IssueCategory; confidence: number; reply: string }
  | { outcome: "needs_clarification"; reply: string }
  | { outcome: "llm_unavailable" };

export async function classify(
  input: Omit<ClassifyAndReplyInput, "categories">,
  provider: LlmProvider = getLlmProvider(),
): Promise<ClassifyOutcome> {
  const categories = await listClassificationCategories();
  const result = await provider.classifyAndReply({ ...input, categories });
  if (!result.ok) {
    return { outcome: "llm_unavailable" };
  }

  // R2: unknown category names (stale/hallucinated) fall back to unclassified
  // rather than trusting the LLM's raw output (FR-012 safety default).
  const isKnown =
    result.category === UNCLASSIFIED_CATEGORY || categories.some((c) => c.name === result.category);
  const category = isKnown ? result.category : UNCLASSIFIED_CATEGORY;

  if (category !== UNCLASSIFIED_CATEGORY && result.confidence >= config.CONFIDENCE_THRESHOLD) {
    return {
      outcome: "classified",
      category,
      confidence: result.confidence,
      reply: result.reply,
    };
  }
  return { outcome: "needs_clarification", reply: result.reply };
}
