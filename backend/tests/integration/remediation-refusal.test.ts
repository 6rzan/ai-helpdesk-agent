import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { Conversation, type ConversationDoc } from "../../src/models/conversation.js";
import { Message, type MessageDoc } from "../../src/models/message.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// US2: every out-of-whitelist ad-hoc request is refused with its exact
// reason, audited, and offered escalation — never executed (SC-001, FR-016).

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
  throw new Error("executor must never be called for a refused ad-hoc request");
}

describe("Ad-hoc remediation requests are a real policy decision, not a blanket refusal (US2)", () => {
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

  it("TC: no policy entry matches at all -> refused as no_matching_entry, audited, escalation offered", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you reinstall Office for me?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("no_matching_entry");

    const reply = await waitFor<MessageDoc>(async () =>
      await Message.findOne({ conversationId: session.conversationId, author: "agent", text: /don't have an approved way/i }),
    );
    expect(reply?.text).toMatch(/escalate/i);
  });

  it("TC: a real action named with an unapproved argument -> refused as argument_mismatch", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Can you unlock the account for jsmith?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("argument_mismatch");
  });

  it("TC: a real action aimed at the employee's own device -> refused as unregistered_target", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Can you restart the widget service on my laptop?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("unregistered_target");
  });

  it("TC: a real action aimed at a registered endpoint it isn't permitted against -> refused as endpoint_not_permitted", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you clear the print queue on test node a?");

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
    expect(record?.refusalReason).toBe("endpoint_not_permitted");
  });

  it("TC: ambiguous between two approved actions -> a clarifying question, then escalation if still ambiguous (FR-015)", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you restart the widget service or clear the print queue, whichever fixes it?");

    const clarifying = await waitFor<MessageDoc>(async () =>
      await Message.findOne({ conversationId: session.conversationId, author: "agent", text: /just to be sure/i }),
    );
    expect(clarifying).toBeTruthy();

    const pendingAfterAsk = await waitFor<ConversationDoc>(async () => await Conversation.findById(session.conversationId));
    expect(pendingAfterAsk?.pendingAmbiguousRemediation?.candidates).toHaveLength(2);

    // Still doesn't resolve to exactly one of the two named candidates.
    await postMessage(ctx, session, "Whichever one works, I don't mind.");

    const escalationReply = await waitFor<MessageDoc>(async () =>
      await Message.findOne({ conversationId: session.conversationId, author: "agent", text: /still can't tell/i }),
    );
    expect(escalationReply).toBeTruthy();

    const stillAmbiguousRecord = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(stillAmbiguousRecord?.refusalReason).toBe("low_confidence");

    const pendingAfterResolve = await waitFor<ConversationDoc>(async () => await Conversation.findById(session.conversationId));
    expect(pendingAfterResolve?.pendingAmbiguousRemediation).toBeNull();
  });

  it("TC: a clear disambiguating reply resolves to a single specific refusal instead of escalating", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, "Could you restart the widget service or clear the print queue, whichever fixes it?");
    await waitFor<ConversationDoc["pendingAmbiguousRemediation"]>(async () => await Conversation.findById(session.conversationId).then((c) => c?.pendingAmbiguousRemediation ?? null));

    await postMessage(ctx, session, "I meant the widget service.");

    // Resolves to restart-service with a real, permitted endpoint and valid
    // arguments — everything matches except that nobody ever gave consent.
    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.refusalReason).toBe("missing_consent");
    expect(record?.policyEntryId).toBe("restart-service");
  });
});
