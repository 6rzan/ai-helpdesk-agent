import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { Guide } from "../../src/models/guide.js";
import { GuidedSession } from "../../src/models/guided-session.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// FR-014/US1 AS2: an action can satisfy or inform a guided step without the
// guide's own step sequence or version pinning changing — the offer and its
// outcome are strictly supplementary to the deterministic guided pipeline
// already shipped and tested (guide-version-pinning.test.ts).

async function startAccountSession(ctx: TestContext) {
  const seeded = await seedUser({ displayName: "Jordan Lee" });
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

describe("Guided step order is unaffected by an offered action (FR-014, US1 AS2)", () => {
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

  it("offers a diagnostic at step 0 without touching the guide's step count or version", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async (): Promise<ExecutionResult> => ({
      outcome: "succeeded",
      observedOutput: "widget-service: active (running)",
      durationMs: 10,
    }));

    const guideBefore = await Guide.findOne({ categoryName: "service_status", active: true });
    expect(guideBefore?.version).toBe(1);
    expect(guideBefore?.steps).toHaveLength(1);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitForProposal(session.conversationId);
    const proposal = ticket.pendingActionProposal;
    expect(proposal?.policyEntryId).toBe("service-status");

    const guidedSession = await GuidedSession.findOne({ ticketId: ticket._id });
    // Offering the action happens after the step-0 prompt, not instead of it,
    // and never advances or rewrites the session's own step tracking.
    expect(guidedSession?.currentStepIndex).toBe(0);
    expect(guidedSession?.categoryName).toBe("service_status");
    expect(guidedSession?.guideVersion).toBe(1);

    const consentRes = await request(ctx.app)
      .post(`/api/tickets/${ticket.reference}/actions/consent`)
      .query({ sessionId: session.sessionId })
      .send({ proposalId: proposal?.proposalId, granted: true });
    expect(consentRes.status).toBe(200);
    expect(consentRes.body.result.outcome).toBe("succeeded");

    // Deciding the proposal still hasn't touched the guide or the session's
    // own step position — the action only ever supplements the guided flow.
    const guideAfter = await Guide.findOne({ categoryName: "service_status", active: true });
    expect(guideAfter?.version).toBe(1);
    expect(guideAfter?.steps).toHaveLength(1);
    expect(guideAfter?._id.toString()).toBe(guideBefore?._id.toString());

    const guidedSessionAfter = await GuidedSession.findOne({ ticketId: ticket._id });
    expect(guidedSessionAfter?.currentStepIndex).toBe(0);
  });
});
