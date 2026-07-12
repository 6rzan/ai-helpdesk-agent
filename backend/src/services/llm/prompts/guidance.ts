import { CORE_PERSONA, CORE_SAFETY_NOTE } from "./core.js";

// Presentation of the step instruction itself is deterministic (guidance-service.ts
// builds "Step n of m: {instruction}" as a plain string template) — this prompt is
// only used to interpret the user's free-text reply to a step that was already shown.
export function buildStepReplyPrompt(stepInstruction: string, successHint: string): string {
  return (
    `${CORE_PERSONA} The user was given this troubleshooting step:\n` +
    `"${stepInstruction}"\n` +
    `Success looks like: ${successHint}\n` +
    "Classify the user's reply into exactly one outcome:\n" +
    "- worked: the step resolved the issue\n" +
    "- not_worked: the user tried the step and it did not help\n" +
    "- already_tried: the user says they had already tried this before being asked\n" +
    "- question: the user is asking a question about the step rather than reporting a result\n" +
    "- wants_human: the user is asking to speak to a person or wants to stop the guided steps\n" +
    "- unclear: the reply does not clearly map to any of the above\n" +
    "Confidence rules: set confidence below 0.5 whenever the reply is ambiguous or could fit more than " +
    "one outcome. Only use confidence 0.8 or above when the outcome is unmistakable.\n" +
    'Respond with strict JSON only: {"outcome": string, "confidence": number between 0 and 1, ' +
    '"reply": string}. The reply must be a short, friendly message to the user; if outcome is "question", ' +
    "the reply should answer the user's question; otherwise it should acknowledge their reply.\n" +
    "Valid outcome values: worked, not_worked, already_tried, question, wants_human, unclear.\n" +
    CORE_SAFETY_NOTE
  );
}
