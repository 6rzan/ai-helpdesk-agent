import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";
import { StaffActionRecord } from "../../src/models/staff-action.js";
import { GuidedSession } from "../../src/models/guided-session.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { Ticket } from "../../src/models/ticket.js";
import { nextTicketReference } from "../../src/services/ticket/counter.js";
import { attemptAction } from "../../src/services/remediation/policy-engine.js";

// T085/contracts/api.md "Remediation availability": a disable takes effect
// immediately against anything not already executing, the employee is told
// the agent cannot act right now (the refused ActionRecord carries
// `remediation_disabled`, rendered plainly per the shared refusal text on
// ActionRecordCard), guidance and escalation keep working, and the disable
// itself is an attributed staff action (US4 AS4, SC-006).

describe("POST /staff/remediation/toggle (US4)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("disables remediation globally, refusing the very next attempt, while attributing the change", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const staff = await seedStaff();

    const before = await request(ctx.app).get("/api/staff/remediation").set("Cookie", staff.cookie);
    expect(before.status).toBe(200);
    expect(before.body.globallyEnabled).toBe(true);

    const toggle = await request(ctx.app)
      .post("/api/staff/remediation/toggle")
      .set("Cookie", staff.cookie)
      .send({ scope: "global", enabled: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.globallyEnabled).toBe(false);

    const after = await request(ctx.app).get("/api/staff/remediation").set("Cookie", staff.cookie);
    expect(after.body.globallyEnabled).toBe(false);

    const result = await attemptAction({
      actor: "user",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "account-status",
      arguments: { username: "test-user-active" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
    });
    expect(result.outcome).toBe("refused");
    expect(result.refusalReason).toBe("remediation_disabled");

    const attribution = await StaffActionRecord.findOne({ action: "remediation_toggle" });
    expect(attribution?.staffId.toString()).toBe(staff.account._id.toString());
    expect(attribution?.details).toMatchObject({ scope: "global", enabled: false });
  });

  it("disables a single endpoint without touching others", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const staff = await seedStaff();

    const toggle = await request(ctx.app)
      .post("/api/staff/remediation/toggle")
      .set("Cookie", staff.cookie)
      .send({ scope: "endpoint", endpointId: "test-node-a", enabled: false });
    expect(toggle.status).toBe(200);
    const endpointA = toggle.body.endpoints.find((e: { id: string }) => e.id === "test-node-a");
    const endpointB = toggle.body.endpoints.find((e: { id: string }) => e.id === "test-node-b");
    expect(endpointA.enabled).toBe(false);
    expect(endpointB.enabled).toBe(true);
    expect(toggle.body.globallyEnabled).toBe(true);

    // The disabled endpoint itself refuses; a different, still-enabled
    // endpoint is unaffected by the same availability gate.
    const onDisabledEndpoint = await attemptAction({
      actor: "user",
      ticketId: null,
      conversationId: null,
      classifiedIntent: "password_login",
      policyEntryId: "account-status",
      arguments: { username: "test-user-active" },
      endpointId: "test-node-a",
      consent: { given: true, byAccountId: new Types.ObjectId(), at: new Date(), messageId: new Types.ObjectId() },
    });
    expect(onDisabledEndpoint.outcome).toBe("refused");
    expect(onDisabledEndpoint.refusalReason).toBe("remediation_disabled");
  });

  it("guidance and escalation keep working while remediation is disabled", async () => {
    const staff = await seedStaff();
    await request(ctx.app)
      .post("/api/staff/remediation/toggle")
      .set("Cookie", staff.cookie)
      .send({ scope: "global", enabled: false });

    const reference = await nextTicketReference();
    const ticket = await Ticket.create({
      reference,
      reporterId: new Types.ObjectId(),
      conversationId: new Types.ObjectId(),
      description: "Cannot sign in, account was locked.",
      category: "password_login",
      status: "open",
      handlingMode: "automated",
    });
    await GuidedSession.create({
      conversationId: ticket.conversationId,
      ticketId: ticket._id,
      categoryName: "password_login",
      guideVersion: 1,
      currentStepIndex: 0,
      stepAttempts: [],
      state: "active",
    });

    // Escalation is a ticket-state transition independent of the remediation
    // gate -- it must still be reachable even with remediation globally off.
    const escalated = await Ticket.findByIdAndUpdate(
      ticket._id,
      { escalated: true, escalationReason: "guidance_exhausted", handlingMode: "human_involved" },
      { new: true },
    );
    expect(escalated?.escalated).toBe(true);
    expect(escalated?.handlingMode).toBe("human_involved");
  });

  it("refuses non-staff accounts with 403 and never applies the change", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    const user = await seedUser();
    const res = await request(ctx.app)
      .post("/api/staff/remediation/toggle")
      .set("Cookie", user.cookie)
      .send({ scope: "global", enabled: false });
    expect(res.status).toBe(403);

    const staff = await seedStaff();
    const after = await request(ctx.app).get("/api/staff/remediation").set("Cookie", staff.cookie);
    expect(after.body.globallyEnabled).toBe(true);
  });
});
