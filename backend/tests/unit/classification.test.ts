import { describe, expect, it, vi } from "vitest";
import { classificationOutputSchema } from "../../src/services/llm/schema.js";
import { classify } from "../../src/services/classification/classifier.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  InterpretStepReplyInput,
  InterpretStepReplyResult,
  LlmProvider,
  StreamReplyInput,
} from "../../src/services/llm/types.js";

vi.mock("../../src/services/category/category-service.js", () => ({
  listClassificationCategories: async () => [
    { name: "password_login", classificationDescription: "passwords, account lockouts, sign-in failures" },
    { name: "network", classificationDescription: "connectivity, Wi-Fi, VPN, or connection problems" },
    { name: "printer", classificationDescription: "printers, printing, or scanners/copiers" },
    { name: "peripherals", classificationDescription: "mice, keyboards, monitors, headsets, or other attached devices" },
    { name: "performance", classificationDescription: "the whole machine running slow, freezing, or crashing" },
    { name: "service_status", classificationDescription: "whether a hosted service is down or degraded for everyone" },
  ],
}));

function stubProvider(result: ClassifyAndReplyResult): LlmProvider {
  return {
    async classifyAndReply(_input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
      return result;
    },
    async *streamReply(_input: StreamReplyInput): AsyncIterable<string> {
      yield "";
    },
    async interpretStepReply(_input: InterpretStepReplyInput): Promise<InterpretStepReplyResult> {
      return { ok: true, outcome: "unclear", confidence: 0.3, reply: "" };
    },
    async health(): Promise<boolean> {
      return true;
    },
  };
}

const sampleInput: Omit<ClassifyAndReplyInput, "categories"> = {
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

  it("TC-007: rejects an empty category (legitimacy is checked at runtime against the categories collection, not by this schema — R2)", () => {
    const result = classificationOutputSchema.safeParse({
      category: "",
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

  it("TC-012: falls back to needs_clarification when the provider returns a category unknown to the categories collection", async () => {
    const provider = stubProvider({
      ok: true,
      category: "not_a_real_category",
      confidence: 0.9,
      reply: "Noted.",
    });
    const outcome = await classify(sampleInput, provider);
    expect(outcome).toEqual({ outcome: "needs_clarification", reply: "Noted." });
  });

  it.each([
    ["password_login", "I forgot my password and can't log into my computer"],
    ["network", "my wifi keeps dropping and I can't reach the internet"],
    ["printer", "the printer on the 3rd floor is jammed again"],
    ["peripherals", "my mouse and keyboard stopped responding"],
    ["performance", "my laptop is really slow and keeps freezing"],
    ["service_status", "is there an outage affecting email right now?"],
  ])("TC-016: %s classifies successfully when the provider returns that category with high confidence", async (category, latestMessage) => {
    const provider = stubProvider({
      ok: true,
      category,
      confidence: 0.9,
      reply: `Noted as a ${category.replace("_", " ")} issue.`,
    });
    const outcome = await classify({ history: [], latestMessage }, provider);
    expect(outcome).toEqual({
      outcome: "classified",
      category,
      confidence: 0.9,
      reply: `Noted as a ${category.replace("_", " ")} issue.`,
    });
  });
});
