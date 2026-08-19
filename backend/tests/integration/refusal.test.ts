import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedUser } from "../helpers/auth.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { setExecutorForTest, type ExecutionResult } from "../../src/services/remediation/policy-engine.js";

// Regression coverage for FR-016: today's blanket refusal of every remediation
// request keyed off `REMEDIATION_PATTERN`'s verb list. Now that a matched and
// authorised request may proceed, every one of these phrasings -- none of
// which name an approved, correctly-argued, permitted action -- must still
// come out refused. Nothing that was refused before this feature may become
// executable except through an explicit policy entry (data-model.md action
// policy), and none of these phrasings names one.

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
  throw new Error("executor must never be called for a request the old blanket rule would have refused");
}

// One phrasing per trigger verb the old blanket `REMEDIATION_PATTERN` rule
// recognised, each naming something with no approved policy entry.
const OLD_BLANKET_RULE_PHRASINGS = [
  "Could you reset the router firmware for me?",
  "Can you unlock the supply cabinet for me?",
  "Would you reinstall Photoshop on my machine?",
  "Could you install a VPN client for me?",
  "Can you uninstall the old antivirus for me?",
  "Will you restart my monitor for me?",
  "Could you reboot the office printer for me?",
  "Can you delete my old email drafts for me?",
  "Would you remove the shared drive mapping for me?",
  "Could you wipe my personal phone for me?",
  "Can you format the spare hard drive for me?",
  "Will you change the domain name for me?",
  "Could you handle the VPN outage for me?",
];

describe("Regression: every request the old blanket keyword rule refused is still refused (FR-016)", () => {
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

  it.each(OLD_BLANKET_RULE_PHRASINGS)("TC: '%s' is still refused, never executed", async (text) => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async () => neverExecutes());

    const session = await startAccountSession(ctx);
    await postMessage(ctx, session, text);

    const record = await waitFor<ActionRecordDoc>(async () => await ActionRecord.findOne({ conversationId: session.conversationId }));
    expect(record?.outcome).toBe("refused");
  });
});
