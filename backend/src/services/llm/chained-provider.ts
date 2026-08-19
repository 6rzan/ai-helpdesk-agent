import { logger } from "../../lib/logger.js";
import { ProviderFallbackEvent } from "../../models/provider-fallback-event.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  InterpretStepReplyInput,
  InterpretStepReplyResult,
  LlmProvider,
  ProposeActionInput,
  ProposeActionResult,
  StreamReplyInput,
} from "./types.js";

// research.md R4: mirrors the shape of stt-service.ts's chain exactly —
// tried in the configured order, no health-scoring or reordering (R4
// "Alternatives considered"). `classifyAndReply` and `interpretStepReply`
// fall through on any failure (thrown error or an `{ ok: false }` result);
// `proposeAction` does the same but also flags a winning result as
// `degraded` when it came from anything after the first provider, so a
// downstream action can be refused rather than executed on a fallback
// model's word (FR-025); `streamReply` falls through only before the first
// token, then ends the stream rather than splicing two models' output
// together; `health` is healthy if any provider in the chain is. Every
// actual fallback (the configured primary losing to a later provider) is
// recorded per T114: a warn log always, plus a `ProviderFallbackEvent`
// (ticket-scoped when the caller supplied one) backing the metrics count.

export interface NamedLlmProvider {
  name: string;
  provider: LlmProvider;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ChainedLlmProvider implements LlmProvider {
  private readonly chain: NamedLlmProvider[];

  constructor(chain: NamedLlmProvider[]) {
    if (chain.length === 0) {
      throw new Error("ChainedLlmProvider requires at least one provider");
    }
    this.chain = chain;
  }

  async classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
    return this.runWithFallback("classifyAndReply", (provider) => provider.classifyAndReply(input), null);
  }

  async interpretStepReply(input: InterpretStepReplyInput): Promise<InterpretStepReplyResult> {
    return this.runWithFallback("interpretStepReply", (provider) => provider.interpretStepReply(input), null);
  }

  async proposeAction(input: ProposeActionInput): Promise<ProposeActionResult> {
    const attempted: string[] = [];
    for (let i = 0; i < this.chain.length; i += 1) {
      const { name, provider } = this.chain[i]!;
      attempted.push(name);
      try {
        const result = await provider.proposeAction(input);
        if (result.ok) {
          if (i > 0) {
            await this.recordFallback(this.chain[0]!.name, name, input.ticketId ?? null);
            return { ...result, degraded: true };
          }
          return result;
        }
        logger.warn({ provider: name, method: "proposeAction" }, "llm.provider_declined");
      } catch (err) {
        logger.warn({ provider: name, method: "proposeAction", error: describeError(err) }, "llm.provider_failed");
      }
    }
    logger.error({ attemptedProviders: attempted, method: "proposeAction" }, "llm.chain_exhausted");
    return { ok: false, reason: "llm_unavailable" };
  }

  async health(): Promise<boolean> {
    const results = await Promise.all(
      this.chain.map(async ({ provider }) => {
        try {
          return await provider.health();
        } catch {
          return false;
        }
      }),
    );
    return results.some(Boolean);
  }

  async *streamReply(input: StreamReplyInput): AsyncIterable<string> {
    const attempted: string[] = [];
    for (let i = 0; i < this.chain.length; i += 1) {
      const { name, provider } = this.chain[i]!;
      attempted.push(name);
      let emittedAny = false;
      try {
        for await (const token of provider.streamReply(input)) {
          emittedAny = true;
          yield token;
        }
        if (i > 0) {
          await this.recordFallback(this.chain[0]!.name, name, null);
        }
        return;
      } catch (err) {
        if (!emittedAny) {
          logger.warn(
            { provider: name, error: describeError(err) },
            "llm.stream_reply.provider_failed_before_first_token",
          );
          continue;
        }
        // After the first token, a failure ends the stream and degrades
        // visibly rather than switching provider mid-answer (R4).
        logger.warn({ provider: name, error: describeError(err) }, "llm.stream_reply.degraded_mid_stream");
        throw err;
      }
    }
    logger.error({ attemptedProviders: attempted }, "llm.stream_reply.chain_exhausted");
    throw new Error("All configured LLM providers failed before producing a token");
  }

  private async runWithFallback<T extends { ok: true } | { ok: false; reason: "llm_unavailable" }>(
    method: string,
    call: (provider: LlmProvider) => Promise<T>,
    ticketId: string | null,
  ): Promise<T> {
    const attempted: string[] = [];
    for (let i = 0; i < this.chain.length; i += 1) {
      const { name, provider } = this.chain[i]!;
      attempted.push(name);
      try {
        const result = await call(provider);
        if (result.ok) {
          if (i > 0) {
            await this.recordFallback(this.chain[0]!.name, name, ticketId);
          }
          return result;
        }
        logger.warn({ provider: name, method }, "llm.provider_declined");
      } catch (err) {
        logger.warn({ provider: name, method, error: describeError(err) }, "llm.provider_failed");
      }
    }
    logger.error({ attemptedProviders: attempted, method }, "llm.chain_exhausted");
    return { ok: false, reason: "llm_unavailable" } as T;
  }

  private async recordFallback(fromProvider: string, toProvider: string, ticketId: string | null): Promise<void> {
    logger.warn({ fromProvider, toProvider, ticketId }, "llm.fallback");
    try {
      await ProviderFallbackEvent.create({ fromProvider, toProvider, ticketId });
    } catch (err) {
      // The warn log above is the record of truth even if this write fails
      // (e.g. no DB connection in a unit test) -- never let a metrics-only
      // write block or fail the actual LLM call it is describing.
      logger.error({ error: describeError(err) }, "llm.fallback.record_failed");
    }
  }
}
