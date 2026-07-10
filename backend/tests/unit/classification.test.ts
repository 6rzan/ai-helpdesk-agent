import { describe, expect, it } from "vitest";
import { classificationOutputSchema } from "../../src/services/llm/schema.js";
import { classify } from "../../src/services/classification/classifier.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  LlmProvider,
  StreamReplyInput,
} from "../../src/services/llm/types.js";

function stubProvider(result: ClassifyAndReplyResult): LlmProvider {
  return {
    async classifyAndReply(_input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
      return result;
    },
    async *streamReply(_input: StreamReplyInput): AsyncIterable<string> {
      yield "";
    },
    async health(): Promise<boolean> {
      return true;
    },
  };
}

const sampleInput: ClassifyAndReplyInput = {
  history: [],
  latestMessage: "my printer won't print",
};

describe("classificationOutputSchema", () => {
  it("TC-006: accepts a valid classification payload", () => {
    const result = classificationOutputSchema.safeParse({
      category: "printer",
      confidence: 0.9,
      reply: "Noted as a printer issue.",
    });
    expect(result.success).toBe(true);
  });

  it("TC-007: rejects an unknown category", () => {
    const result = classificationOutputSchema.safeParse({
      category: "not_a_real_category",
      confidence: 0.9,
      reply: "Noted.",
    });
    expect(result.success).toBe(false);
  });

  it("TC-008: rejects an out-of-range confidence", () => {
    const result = classificationOutputSchema.safeParse({
      category: "printer",
      confidence: 1.5,
      reply: "Noted.",
    });
    expect(result.success).toBe(false);
  });
});

describe("classify", () => {
  it("TC-009: returns classified when confidence is at or above the threshold", async () => {
    const provider = stubProvider({
      ok: true,
      category: "printer",
      confidence: 0.9,
      reply: "Noted as a printer issue.",
    });
    const outcome = await classify(sampleInput, provider);
    expect(outcome).toEqual({
      outcome: "classified",
      category: "printer",
      confidence: 0.9,
      reply: "Noted as a printer issue.",
    });
  });

  it("TC-010: returns needs_clarification when confidence is below the threshold", async () => {
    const provider = stubProvider({
      ok: true,
      category: "unclassified",
      confidence: 0.4,
      reply: "Could you share more detail?",
    });
    const outcome = await classify(sampleInput, provider);
    expect(outcome).toEqual({
      outcome: "needs_clarification",
      reply: "Could you share more detail?",
    });
  });

  it("TC-011: returns llm_unavailable when the provider fails", async () => {
    const provider = stubProvider({ ok: false, reason: "llm_unavailable" });
    const outcome = await classify(sampleInput, provider);
    expect(outcome).toEqual({ outcome: "llm_unavailable" });
  });
});
