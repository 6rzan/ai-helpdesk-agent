import { CORE_PERSONA, CORE_SAFETY_NOTE } from "./core.js";

export interface ClassificationCategoryInput {
  name: string;
  classificationDescription: string;
}

// R2: category list is assembled at runtime from the categories collection
// instead of being a hardcoded literal, so new categories classify without a
// code change (FR-014).
export function buildClassificationPrompt(categories: ClassificationCategoryInput[]): string {
  const categoryLines = categories.map((c) => `- ${c.name}: ${c.classificationDescription}`).join("\n");
  const categoryNames = categories.map((c) => c.name).join(", ");

  return (
    `${CORE_PERSONA} Classify the user's issue into exactly one category:\n` +
    `${categoryLines}\n` +
    "- unclassified: none of the above fit\n" +
    "Confidence rules: if the report is vague and does not name a concrete symptom, device, or service " +
    '(e.g. "my computer is acting weird", "things are off today"), you MUST set confidence below 0.5. ' +
    "Only use confidence 0.8 or above when the category is unmistakable.\n" +
    'Respond with strict JSON only: {"category": string, "confidence": number between 0 and 1, ' +
    '"reply": string}. The reply must be a short, friendly message to the user; when confidence is ' +
    "low, the reply should ask one clarifying question.\n" +
    `Valid category values: ${categoryNames}, unclassified.\n` +
    CORE_SAFETY_NOTE
  );
}
