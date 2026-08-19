import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { Message, type MessageDoc } from "../../src/models/message.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// FR-015: low confidence about what the employee wants must escalate rather
// than result in an action, and ambiguity between two approved actions must
// produce a clarifying question rather than a choice made by the agent
// (US2 AS5, edge case).

async function startAccountSession(ctx: TestContext) {
  const seeded = await seedUser({ displayName: "Riley Park" });
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

function neverExecutes(): ExecutionResult {
  throw new Error("executor must never be called for a low-confidence or ambiguous request");
}

describe("Low confidence escalates and ambiguity clarifies, neither ever chooses for the employee (FR-015)", () => {
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

  it("TC: a vague 'just fix this for me' request escalates instead of guessing at an action", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Can you just fix this for me?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("low_confidence");

    const reply = await waitFor<MessageDoc>(async () =>
      await Message.findOne({ conversationId: session.conversationId, author: "agent", text: /not sure exactly/i }),
    );
    expect(reply).toBeTruthy();

    const ticket = await waitFor<TicketDoc>(async () => await Ticket.findOne({ conversationId: session.conversationId }));
    expect(ticket?.escalated).toBe(true);
    expect(ticket?.escalationReason).toBe("low_confidence");
    expect(ticket?.handlingMode).toBe("human_involved");
  });

  it("TC: another vague phrasing ('could you take care of it') also escalates rather than acting", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you take care of it for me?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("low_confidence");
  });

  it("TC: ambiguity between two approved actions asks a clarifying question rather than the agent picking one", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you restart the widget service or clear the print queue, whichever fixes it?");

    const clarifying = await waitFor<MessageDoc>(async () =>
      await Message.findOne({ conversationId: session.conversationId, author: "agent", text: /just to be sure/i }),
    );
    expect(clarifying?.text).toMatch(/\?/);

    // No action record exists yet -- a clarifying question is asked before
    // any policy decision is made, never a silent pick between candidates.
    const recordBeforeAnswer = await ActionRecord.findOne({ conversationId: session.conversationId });
    expect(recordBeforeAnswer).toBeNull();
  });
});
