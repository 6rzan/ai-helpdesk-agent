import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { seedStaff } from "../helpers/auth.js";
import { createApprovalRequestFixture, createTicketFixture } from "../helpers/factories.js";
import { Message } from "../../src/models/message.js";
import { RemediationSettings, REMEDIATION_SETTINGS_ID } from "../../src/models/remediation-settings.js";
import { decideApproval } from "../../src/services/remediation/approval-service.js";
import { setExecutorForTest, type ExecutionResult, type ExecutionRequest } from "../../src/services/remediation/policy-engine.js";

// T068/US3 AS7, FR-019: the unlock path genuinely unlocks the local test
// account, verifies before reporting, and every report on this path states
// plainly it applied to the test account, never the organisational
// directory -- with no em-dash (T080).

describe("password-path disclosure (US3 AS7, FR-019)", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
    setExecutorForTest(undefined);
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("genuinely unlocks the test account, verifies it, and discloses this is a test account with no em-dash", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });

    const commandsRun: string[] = [];
    setExecutorForTest(async (request: ExecutionRequest): Promise<ExecutionResult> => {
      commandsRun.push(request.command);
      if (request.command.includes("unlock-account.sh")) {
        return { outcome: "succeeded", observedOutput: "unlocked=test-user-locked", durationMs: 3 };
      }
      return { outcome: "succeeded", observedOutput: "account=test-user-locked\nlocked=false\npassword_change_required=false", durationMs: 3 };
    });

    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      policyEntryId: "unlock-account",
      arguments: { username: "test-user-locked" },
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    const decision = await decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true });
    expect(decision.execution?.outcome).toBe("succeeded");

    // The unlock command actually ran against the endpoint, and its own
    // verification entry (account-status) ran afterward -- not assumed.
    expect(commandsRun.some((c) => c.includes("unlock-account.sh test-user-locked"))).toBe(true);
    expect(commandsRun.some((c) => c.includes("account-status.sh test-user-locked"))).toBe(true);

    const messages = await Message.find({ conversationId: fixture.conversationId }).sort({ sentAt: 1 });
    const report = messages[messages.length - 1];
    expect(report?.author).toBe("agent");
    expect(report?.text).toMatch(/test account/i);
    expect(report?.text).toMatch(/not your organisational/i);
    expect(report?.text).not.toContain("—"); // em-dash
  });

  it("discloses the test account on the expire-password path too, regardless of outcome", async () => {
    await RemediationSettings.create({ _id: REMEDIATION_SETTINGS_ID, globallyEnabled: true, disabledEndpointIds: [] });
    setExecutorForTest(async (request: ExecutionRequest): Promise<ExecutionResult> => {
      if (request.command.includes("expire-password.sh")) {
        return { outcome: "succeeded", observedOutput: "expired=test-user-locked", durationMs: 3 };
      }
      // Verification contradicts -- still password-path, still discloses.
      return { outcome: "succeeded", observedOutput: "account=test-user-locked\nlocked=false\npassword_change_required=false", durationMs: 3 };
    });

    const fixture = await createTicketFixture({ category: "password_login" });
    const request = await createApprovalRequestFixture({
      ticketId: fixture.ticket._id,
      conversationId: fixture.conversationId,
      byAccountId: fixture.reporterId,
      policyEntryId: "expire-password",
      arguments: { username: "test-user-locked" },
    });
    const staff = await seedStaff({ displayName: "Staff Decider" });

    const decision = await decideApproval({ approvalId: request._id.toString(), staff: staff.account, granted: true });
    expect(decision.execution?.outcome).toBe("failed");

    const messages = await Message.find({ conversationId: fixture.conversationId }).sort({ sentAt: 1 });
    const report = messages[messages.length - 1];
    expect(report?.text).toMatch(/test account/i);
    expect(report?.text).not.toContain("—");
  });
});
