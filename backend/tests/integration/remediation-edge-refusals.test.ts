import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { HydratedDocument } from "mongoose";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { proposeActionForStep } from "../../src/services/remediation/consent-service.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// FR-012 edge cases: acting on a ticket the requester does not own, and
// re-offering an action that already failed for a ticket, are both refused
// and audited -- never silently ignored, and never re-run.

async function startAccountSession(ctx: TestContext, displayName: string) {
  const seeded = await seedUser({ displayName });
  const res = await request(ctx.app).post("/api/sessions").set("Cookie", seeded.cookie).send({});
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string, reporterId: res.body.reporter.id as string };
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

async function waitForProposal(conversationId: string): Promise<HydratedDocument<TicketDoc>> {
  return waitFor(async () => {
    const ticket = await Ticket.findOne({ conversationId }).sort({ createdAt: -1 });
    return ticket?.pendingActionProposal ? ticket : null;
  });
}

function neverExecutes(): ExecutionResult {
  throw new Error("executor must never be called for a refused edge-case request");
}

describe("Edge-case refusals: not_ticket_owner and already_attempted are both refused and audited (FR-012)", () => {
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

  it("TC: consenting to another reporter's proposal is refused as not_ticket_owner, audited, no execution", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const owner = await startAccountSession(ctx, "Owner Ticketholder");
    await postMessage(ctx, owner, "The widget service is down for everyone right now.");
    const ticket = await waitForProposal(owner.conversationId);
    const proposal = ticket.pendingActionProposal;
    expect(proposal).toBeTruthy();

    const intruder = await startAccountSession(ctx, "Someone Else");
    const res = await request(ctx.app)
      .post(`/api/tickets/${ticket.reference}/actions/consent`)
      .query({ sessionId: intruder.sessionId })
      .send({ proposalId: proposal?.proposalId, granted: true });

    expect(res.status).toBe(403);

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ ticketId: ticket._id }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("not_ticket_owner");

    // The owner's proposal is untouched -- an intruder's attempt neither
    // consumes it nor executes it.
    const stillPending = await Ticket.findById(ticket._id);
    expect(stillPending?.pendingActionProposal?.proposalId).toBe(proposal?.proposalId);
  });

  it("TC: re-offering a step whose only candidate already failed for this ticket is refused as already_attempted, audited, never re-run", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx, "Repeat Requester");
    await postMessage(ctx, session, "The widget service is down for everyone right now.");
    const ticket = await waitForProposal(session.conversationId);

    // Simulate the step being reached again after the first offer resolved
    // (proposeActionForStep declines to offer anything while a proposal is
    // still pending, regardless of already_attempted -- that's a separate
    // guard). Clear it so this call reaches the already_attempted check.
    ticket.pendingActionProposal = null;
    await ticket.save();

    // Seed the exact failure this ticket already suffered for the one
    // read-only tool mapped to `service_status:0` (action-policy.json).
    await ActionRecord.create({
      actor: "agent",
      ticketId: ticket._id,
      conversationId: session.conversationId,
      classifiedIntent: "service_status:0",
      policyEntryId: "service-status",
      requestedAction: "sudo /usr/local/bin/service-status.sh widget-service",
      outcome: "failed",
      observedOutput: "ssh: connect to host 127.0.0.1 port 2201: Connection refused",
    });

    const outcome = await proposeActionForStep({
      sessionId: session.sessionId,
      conversationId: ticket.conversationId,
      ticket,
      categoryName: "service_status",
      stepIndex: 0,
      history: [],
      stepInstruction: "Check the widget service's status.",
    });

    // Nothing is re-offered -- the only candidate for this step already failed.
    expect(outcome).toBeNull();

    const record = await waitFor<ActionRecordDoc>(async () =>
      await ActionRecord.findOne({ ticketId: ticket._id, refusalReason: "already_attempted" }),
    );
    expect(record?.outcome).toBe("refused");
    expect(record?.requestedAction).toContain("service-status");
  });
});
