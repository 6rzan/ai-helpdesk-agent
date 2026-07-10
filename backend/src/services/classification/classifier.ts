import { config } from "../../config/index.js";
import { getLlmProvider } from "../llm/factory.js";
import type { ClassifyAndReplyInput, LlmProvider } from "../llm/types.js";
import type { IssueCategory } from "../../models/enums.js";

export type ClassifyOutcome =
  | { outcome: "classified"; category: IssueCategory; confidence: number; reply: string }
  | { outcome: "needs_clarification"; reply: string }
  | { outcome: "llm_unavailable" };

export async function classify(
  input: ClassifyAndReplyInput,
  provider: LlmProvider = getLlmProvider(),
): Promise<ClassifyOutcome> {
  const result = await provider.classifyAndReply(input);
  if (!result.ok) {
    return { outcome: "llm_unavailable" };
  }
  if (result.confidence >= config.CONFIDENCE_THRESHOLD) {
    return {
      outcome: "classified",
      category: result.category,
      confidence: result.confidence,
      reply: result.reply,
    };
  }
  return { outcome: "needs_clarification", reply: result.reply };
}
