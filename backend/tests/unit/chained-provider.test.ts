import { describe, expect, it, vi } from "vitest";
import { ChainedLlmProvider } from "../../src/services/llm/chained-provider.js";
import type {
  ClassifyAndReplyResult,
  InterpretStepReplyResult,
  LlmProvider,
  ProposeActionResult,
} from "../../src/services/llm/types.js";

// T108/US6: ChainedLlmProvider tries providers in the configured order and
// falls through on failure, mirroring stt-service.ts's chain (research.md R4).

const BASE_CLASSIFY_INPUT = { history: [], latestMessage: "my printer is broken", categories: [] };
const BASE_STEP_INPUT = {
  history: [],
  latestMessage: "still broken",
  stepInstruction: "restart it",
  successHint: "it should print now",
};
const BASE_PROPOSE_INPUT = { history: [], latestMessage: "help", stepInstruction: "diagnose", tools: [], attempts: [] };
const BASE_STREAM_INPUT = { history: [], latestMessage: "hello" };

function fakeProvider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    classifyAndReply: vi.fn(async (): Promise<ClassifyAndReplyResult> => ({ ok: false, reason: "llm_unavailable" })),
    interpretStepReply: vi.fn(
      async (): Promise<InterpretStepReplyResult> => ({ ok: false, reason: "llm_unavailable" }),
    ),
    proposeAction: vi.fn(async (): Promise<ProposeActionResult> => ({ ok: false, reason: "llm_unavailable" })),
    health: vi.fn(async () => false),
    streamReply: async function* () {
      throw new Error("not implemented");
    },
    ...overrides,
  };
}

describe("ChainedLlmProvider", () => {
  describe("classifyAndReply", () => {
    it("returns the first provider's result when it succeeds", async () => {
      const first = fakeProvider({
        classifyAndReply: vi.fn(async (): Promise<ClassifyAndReplyResult> => ({
          ok: true,
          category: "printer",
          confidence: 0.9,
          reply: "noted",
        })),
      });
      const second = fakeProvider();
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.classifyAndReply(BASE_CLASSIFY_INPUT);

      expect(result).toEqual({ ok: true, category: "printer", confidence: 0.9, reply: "noted" });
      expect(second.classifyAndReply).not.toHaveBeenCalled();
    });

    it("falls through to the next provider when the first throws", async () => {
      const first = fakeProvider({
        classifyAndReply: vi.fn(async () => {
          throw new Error("connection refused");
        }),
      });
      const second = fakeProvider({
        classifyAndReply: vi.fn(async (): Promise<ClassifyAndReplyResult> => ({
          ok: true,
          category: "network",
          confidence: 0.8,
          reply: "noted",
        })),
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.classifyAndReply(BASE_CLASSIFY_INPUT);

      expect(result).toEqual({ ok: true, category: "network", confidence: 0.8, reply: "noted" });
    });

    it("falls through to the next provider when the first returns { ok: false }", async () => {
      const first = fakeProvider();
      const second = fakeProvider({
        classifyAndReply: vi.fn(async (): Promise<ClassifyAndReplyResult> => ({
          ok: true,
          category: "unclassified",
          confidence: 0.4,
          reply: "tell me more",
        })),
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.classifyAndReply(BASE_CLASSIFY_INPUT);

      expect(result.ok).toBe(true);
      expect(second.classifyAndReply).toHaveBeenCalled();
    });

    it("returns { ok: false } once every provider in the chain has failed", async () => {
      const first = fakeProvider();
      const second = fakeProvider();
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.classifyAndReply(BASE_CLASSIFY_INPUT);

      expect(result).toEqual({ ok: false, reason: "llm_unavailable" });
    });
  });

  describe("interpretStepReply", () => {
    it("falls through to the next provider on failure", async () => {
      const first = fakeProvider({
        interpretStepReply: vi.fn(async () => {
          throw new Error("timeout");
        }),
      });
      const second = fakeProvider({
        interpretStepReply: vi.fn(async (): Promise<InterpretStepReplyResult> => ({
          ok: true,
          outcome: "worked",
          confidence: 0.9,
          reply: "glad that fixed it",
        })),
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.interpretStepReply(BASE_STEP_INPUT);

      expect(result).toEqual({ ok: true, outcome: "worked", confidence: 0.9, reply: "glad that fixed it" });
    });
  });

  describe("proposeAction", () => {
    it("does not mark a result from the first (primary) provider as degraded", async () => {
      const first = fakeProvider({
        proposeAction: vi.fn(async (): Promise<ProposeActionResult> => ({
          ok: true,
          proposal: { toolName: "print_queue_status", arguments: {} },
        })),
      });
      const chain = new ChainedLlmProvider([{ name: "primary", provider: first }]);

      const result = await chain.proposeAction(BASE_PROPOSE_INPUT);

      expect(result).toEqual({ ok: true, proposal: { toolName: "print_queue_status", arguments: {} } });
      expect((result as { degraded?: boolean }).degraded).toBeUndefined();
    });

    it("marks a result from a fallback provider as degraded (FR-025)", async () => {
      const first = fakeProvider();
      const second = fakeProvider({
        proposeAction: vi.fn(async (): Promise<ProposeActionResult> => ({
          ok: true,
          proposal: { toolName: "network_probe", arguments: { target: "test-node-a" } },
        })),
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.proposeAction(BASE_PROPOSE_INPUT);

      expect(result).toEqual({
        ok: true,
        proposal: { toolName: "network_probe", arguments: { target: "test-node-a" } },
        degraded: true,
      });
    });

    it("falls through on failure and returns { ok: false } once the chain is exhausted", async () => {
      const first = fakeProvider({
        proposeAction: vi.fn(async () => {
          throw new Error("boom");
        }),
      });
      const second = fakeProvider();
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const result = await chain.proposeAction(BASE_PROPOSE_INPUT);

      expect(result).toEqual({ ok: false, reason: "llm_unavailable" });
    });
  });

  describe("health", () => {
    it("is true if any provider in the chain is healthy", async () => {
      const first = fakeProvider({ health: vi.fn(async () => false) });
      const second = fakeProvider({ health: vi.fn(async () => true) });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      await expect(chain.health()).resolves.toBe(true);
    });

    it("is false when no provider in the chain is healthy", async () => {
      const first = fakeProvider({ health: vi.fn(async () => false) });
      const second = fakeProvider({ health: vi.fn(async () => false) });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      await expect(chain.health()).resolves.toBe(false);
    });
  });

  describe("streamReply", () => {
    async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
      const tokens: string[] = [];
      for await (const token of iterable) {
        tokens.push(token);
      }
      return tokens;
    }

    it("falls through to the next provider when the first fails before any token", async () => {
      const first = fakeProvider({
        streamReply: async function* () {
          throw new Error("connection refused");
        },
      });
      const second = fakeProvider({
        streamReply: async function* () {
          yield "hello ";
          yield "there";
        },
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const tokens = await collect(chain.streamReply(BASE_STREAM_INPUT));

      expect(tokens).toEqual(["hello ", "there"]);
    });

    it("ends the stream (does not switch provider) when the first fails after emitting a token", async () => {
      const first = fakeProvider({
        streamReply: async function* () {
          yield "partial ";
          throw new Error("dropped mid-stream");
        },
      });
      let secondCalled = false;
      const second = fakeProvider({
        streamReply: async function* () {
          secondCalled = true;
          yield "should not be reached";
        },
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      const tokens: string[] = [];
      await expect(async () => {
        for await (const token of chain.streamReply(BASE_STREAM_INPUT)) {
          tokens.push(token);
        }
      }).rejects.toThrow("dropped mid-stream");

      expect(tokens).toEqual(["partial "]);
      expect(secondCalled).toBe(false);
    });

    it("throws once every provider fails before producing a token", async () => {
      const first = fakeProvider({
        streamReply: async function* () {
          throw new Error("down");
        },
      });
      const second = fakeProvider({
        streamReply: async function* () {
          throw new Error("also down");
        },
      });
      const chain = new ChainedLlmProvider([
        { name: "primary", provider: first },
        { name: "fallback", provider: second },
      ]);

      await expect(collect(chain.streamReply(BASE_STREAM_INPUT))).rejects.toThrow();
    });
  });
});
