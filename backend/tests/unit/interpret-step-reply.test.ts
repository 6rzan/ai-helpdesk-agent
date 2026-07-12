import { describe, expect, it } from "vitest";
import { stepReplyOutputSchema } from "../../src/services/llm/schema.js";

describe("stepReplyOutputSchema", () => {
  it("IS-001: accepts a valid step-reply payload", () => {
    const result = stepReplyOutputSchema.safeParse({
      outcome: "worked",
      confidence: 0.9,
      reply: "Great, glad that fixed it!",
    });
    expect(result.success).toBe(true);
  });

  it.each(["worked", "not_worked", "already_tried", "question", "wants_human", "unclear"])(
    "IS-002: accepts outcome %s",
    (outcome) => {
      const result = stepReplyOutputSchema.safeParse({ outcome, confidence: 0.8, reply: "ok" });
      expect(result.success).toBe(true);
    },
  );

  it("IS-003: rejects an outcome outside the enum", () => {
    const result = stepReplyOutputSchema.safeParse({
      outcome: "maybe",
      confidence: 0.8,
      reply: "ok",
    });
    expect(result.success).toBe(false);
  });

  it("IS-004: rejects an out-of-range confidence", () => {
    const result = stepReplyOutputSchema.safeParse({
      outcome: "worked",
      confidence: 1.2,
      reply: "ok",
    });
    expect(result.success).toBe(false);
  });

  it("IS-005: rejects an empty reply", () => {
    const result = stepReplyOutputSchema.safeParse({
      outcome: "worked",
      confidence: 0.8,
      reply: "",
    });
    expect(result.success).toBe(false);
  });
});
