import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { ProviderFallbackEvent, type ProviderFallbackEventDoc } from "../../src/models/provider-fallback-event.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";
import { setLlmProviderForTest } from "../../src/services/llm/factory.js";
import { ChainedLlmProvider } from "../../src/services/llm/chained-provider.js";
import type { LlmProvider, ProposeActionResult } from "../../src/services/llm/types.js";

// T110/US6 AS4/FR-025: no automated action executes on a classification
// produced while the system is in a degraded model state -- it is refused
// with `degraded_model` and audited, and the reporter is never offered it.

function forceDegradedProvider(base: LlmProvider): LlmProvider {
  return {
    classifyAndReply: (input) => base.classifyAndReply(input),
    interpretStepReply: (input) => base.interpretStepReply(input),
    streamReply: (input) => base.streamReply(input),
    health: () => base.health(),
    async proposeAction(input) {
      const result = await base.proposeAction(input);
      return result.ok ? { ...result, degraded: true } : result;
    },
  };
}

function alwaysUnavailableProvider(): LlmProvider {
  return {
    classifyAndReply: async () => ({ ok: false, reason: "llm_unavailable" }),
    interpretStepReply: async () => ({ ok: false, reason: "llm_unavailable" }),
    proposeAction: async (): Promise<ProposeActionResult> => ({ ok: false, reason: "llm_unavailable" }),
    health: async () => false,
    streamReply: async function* () {
      throw new Error("not implemented");
    },
  };
}

async function startAccountSession(ctx: TestContext) {
  const seeded = await seedUser({ displayName: "Alex Chen" });
  const res = await request(ctx.app).post("/api/sessions").set("Cookie", seeded.cookie).send({});
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string };
}

async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);
}

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 2000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}

describe("Remediation diagnostic — degraded model state (US6 AS4)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
    setLlmProviderForTest(ctx.llm);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("TC-US6-01: refuses and audits a proposal from a degraded model, never offering it and never executing it", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const executorSpy = vi.fn(
      async (): Promise<ExecutionResult> => ({
        outcome: "succeeded",
        observedOutput: "widget-service: active (running)",
        durationMs: 1,
      }),
    );
    setExecutorForTest(executorSpy);
    setLlmProviderForTest(forceDegradedProvider(ctx.llm));

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitFor<TicketDoc>(async () =>
      Ticket.findOne({ conversationId: session.conversationId }).sort({ createdAt: -1 }),
    );
    // Give the fire-and-forget proposal step time to run (and refuse).
    await new Promise((resolve) => setTimeout(resolve, 300));

    const refreshed = await Ticket.findById(ticket._id);
    expect(refreshed?.pendingActionProposal).toBeNull();
    expect(executorSpy).not.toHaveBeenCalled();

    const record = await waitFor<ActionRecordDoc>(async () => ActionRecord.findOne({ ticketId: ticket._id }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("degraded_model");
  });

  it("TC-US6-02: records a ticket-scoped ProviderFallbackEvent when a proposal falls back mid-turn (T114)", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async (): Promise<ExecutionResult> => ({
      outcome: "succeeded",
      observedOutput: "widget-service: active (running)",
      durationMs: 1,
    }));
    const chain = new ChainedLlmProvider([
      { name: "primary", provider: alwaysUnavailableProvider() },
      { name: "fallback", provider: ctx.llm },
    ]);
    setLlmProviderForTest(chain);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitFor<TicketDoc>(async () =>
      Ticket.findOne({ conversationId: session.conversationId }).sort({ createdAt: -1 }),
    );

    const event = await waitFor<ProviderFallbackEventDoc>(async () =>
      ProviderFallbackEvent.findOne({ ticketId: ticket._id }),
    );
    expect(event?.fromProvider).toBe("primary");
    expect(event?.toProvider).toBe("fallback");
  });
});
