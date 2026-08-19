import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord } from "../../src/models/action-record.js";
import { Message } from "../../src/models/message.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// US1 AS3: an unreachable/failing endpoint gets an honest failure message, the
// attempt and its outcome are audited, and the ticket escalates rather than
// silently retrying (FR-012, T051).

async function startAccountSession(ctx: TestContext) {
  const seeded = await seedUser({ displayName: "Sam Rivera" });
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

describe("Remediation diagnostic — endpoint failure escalates (US1 AS3)", () => {
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

  it("reports an honest failure, audits it, and escalates the ticket to a person", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const stubExecutor = async (): Promise<ExecutionResult> => ({
      outcome: "failed",
      observedOutput: "ssh: connect to host 127.0.0.1 port 2201: Connection refused",
      durationMs: 900,
    });
    setExecutorForTest(stubExecutor);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitForProposal(session.conversationId);
    const proposal = ticket.pendingActionProposal;
    expect(proposal).toBeTruthy();

    const consentRes = await request(ctx.app)
      .post(`/api/tickets/${ticket.reference}/actions/consent`)
      .query({ sessionId: session.sessionId })
      .send({ proposalId: proposal?.proposalId, granted: true });

    expect(consentRes.status).toBe(200);
    expect(consentRes.body.result.outcome).toBe("failed");

    const record = await ActionRecord.findOne({ ticketId: ticket._id });
    expect(record?.outcome).toBe("failed");
    expect(record?.observedOutput).toMatch(/Connection refused/);

    const escalated = await Ticket.findById(ticket._id);
    expect(escalated?.escalated).toBe(true);
    expect(escalated?.escalationReason).toBe("remediation_issue");
    expect(escalated?.handlingMode).toBe("human_involved");

    // Honest, plain-language, in the transcript — never a silent retry.
    const honestMessage = await Message.findOne({
      conversationId: session.conversationId,
      author: "agent",
      text: /didn't succeed/i,
    });
    expect(honestMessage).toBeTruthy();
  });

  it("times out honestly and escalates the same way a hard failure does", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const stubExecutor = async (): Promise<ExecutionResult> => ({
      outcome: "timed_out",
      observedOutput: null,
      durationMs: 5000,
    });
    setExecutorForTest(stubExecutor);

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "The widget service is down for everyone right now.");

    const ticket = await waitForProposal(session.conversationId);
    const proposal = ticket.pendingActionProposal;

    const consentRes = await request(ctx.app)
      .post(`/api/tickets/${ticket.reference}/actions/consent`)
      .query({ sessionId: session.sessionId })
      .send({ proposalId: proposal?.proposalId, granted: true });

    expect(consentRes.body.result.outcome).toBe("timed_out");

    const escalated = await Ticket.findById(ticket._id);
    expect(escalated?.escalated).toBe(true);
    expect(escalated?.escalationReason).toBe("remediation_issue");
  });
});
