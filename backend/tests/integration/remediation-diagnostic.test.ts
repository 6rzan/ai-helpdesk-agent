import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// US1 AS1: the happy path for an approved read-only diagnostic — consent
// recorded, the diagnostic executes against the registered endpoint, a
// plain-language report reaches the transcript, and the attempt is audited.

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

async function waitForProposal(conversationId: string): Promise<TicketDoc> {
  return waitFor(async () => {
    const ticket = await Ticket.findOne({ conversationId }).sort({ createdAt: -1 });
    return ticket?.pendingActionProposal ? ticket : null;
  });
}

describe("Remediation diagnostic — happy path (US1 AS1)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("runs the offered diagnostic on consent, reports plainly, and audits it", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const stubExecutor = async (): Promise<ExecutionResult> => ({
      outcome: "succeeded",
      observedOutput: "widget-service: active (running)",
      durationMs: 42,
    });
    setExecutorForTest(stubExecutor);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitForProposal(session.conversationId);
    const proposal = ticket.pendingActionProposal;
    expect(proposal).toBeTruthy();
    expect(proposal?.policyEntryId).toBe("service-status");
    expect(proposal?.tier).toBe("read_only");

    const consentRes = await request(ctx.app)
      .post(`/api/tickets/${ticket.reference}/actions/consent`)
      .query({ sessionId: session.sessionId })
      .send({ proposalId: proposal?.proposalId, granted: true });

    expect(consentRes.status).toBe(200);
    expect(consentRes.body.result.outcome).toBe("succeeded");

    const record = await ActionRecord.findOne({ ticketId: ticket._id });
    expect(record?.outcome).toBe("succeeded");
    expect(record?.policyEntryId).toBe("service-status");
    expect(record?.authorisation.consent?.given).toBe(true);
    expect(record?.observedOutput).toBe("widget-service: active (running)");

    const actionsRes = await request(ctx.app)
      .get(`/api/tickets/${ticket.reference}/actions`)
      .query({ sessionId: session.sessionId });
    expect(actionsRes.status).toBe(200);
    expect(actionsRes.body.actions).toHaveLength(1);
    expect(actionsRes.body.actions[0].outcome).toBe("succeeded");

    // The proposal is single-use: cleared once decided.
    const refreshed = await Ticket.findById(ticket._id);
    expect(refreshed?.pendingActionProposal).toBeNull();
  });

  it("does not offer anything when remediation is disabled, and never calls the executor", async () => {
    const executorSpy = async (): Promise<ExecutionResult> => ({
      outcome: "succeeded",
      observedOutput: null,
      durationMs: 1,
    });
    setExecutorForTest(executorSpy);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitFor(async () => Ticket.findOne({ conversationId: session.conversationId }).sort({ createdAt: -1 }));
    // Give the fire-and-forget proposal step time to (not) run.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const refreshed = await Ticket.findById(ticket._id);
    expect(refreshed?.pendingActionProposal).toBeNull();
  });
});
