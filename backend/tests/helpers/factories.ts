import { Types, type HydratedDocument } from "mongoose";
import { Reporter } from "../../src/models/reporter.js";
import { Conversation } from "../../src/models/conversation.js";
import { Message } from "../../src/models/message.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { nextTicketReference } from "../../src/services/ticket/counter.js";
import type { Actor, ActionOutcome, ActionTier, ApprovalStatus, MessageAuthor, RefusalReason } from "../../src/models/enums.js";
import { ActionRecord, type ActionRecordDoc } from "../../src/models/action-record.js";
import { ApprovalRequest, type ApprovalRequestDoc } from "../../src/models/approval-request.js";
import type { ActionPolicyEntry, ArgumentSpec, TestEndpoint } from "../../src/policy/policy-schema.js";

let orgCounter = 0;

interface TicketFixtureOptions {
  reporterAccountId?: Types.ObjectId;
  reporterDisplayName?: string;
  category?: string;
  status?: "open" | "in_progress" | "resolved" | "closed";
  handlingMode?: "automated" | "waiting_on_user" | "human_involved";
  escalated?: boolean;
  confidence?: number | null;
  description?: string;
  messages?: { author: MessageAuthor; text: string }[];
}

export interface TicketFixture {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  ticket: HydratedDocument<TicketDoc>;
  reference: string;
}

/**
 * Seed a Reporter + Conversation + optional transcript + Ticket directly, bypassing
 * the chat flow. Used by staff-facing tests that need existing tickets to act on.
 */
export async function createTicketFixture(options: TicketFixtureOptions = {}): Promise<TicketFixture> {
  orgCounter += 1;
  const reporter = await Reporter.create({
    orgId: `ORG-${orgCounter}-${Date.now()}`.slice(0, 32),
    displayName: options.reporterDisplayName ?? "Chat Reporter",
  });
  const conversation = await Conversation.create({ reporterId: reporter._id });

  for (const message of options.messages ?? []) {
    await Message.create({
      conversationId: conversation._id,
      author: message.author,
      text: message.text,
      inputOrigin: "typed",
    });
  }

  const reference = await nextTicketReference();
  const ticket = await Ticket.create({
    reference,
    reporterId: reporter._id,
    conversationId: conversation._id,
    description: options.description ?? "Cannot connect to the office wifi.",
    category: options.category ?? "network",
    classificationConfidence: options.confidence ?? 0.82,
    status: options.status ?? "open",
    handlingMode: options.handlingMode ?? "automated",
    escalated: options.escalated ?? false,
    ...(options.reporterAccountId ? { reporterAccountId: options.reporterAccountId } : {}),
  });

  return {
    reporterId: reporter._id,
    conversationId: conversation._id,
    ticket: ticket as unknown as HydratedDocument<TicketDoc>,
    reference,
  };
}

// T026: fixtures for 005 (constrained automated remediation). Policy entries
// and endpoints are plain-object builders (the real things are frozen JSON,
// not Mongoose models — see policy-schema.ts), while action records go
// through the actual model so audit-trail tests exercise real validation.

export function buildArgumentSpec(overrides: Partial<ArgumentSpec> = {}): ArgumentSpec {
  return { name: "username", kind: "enum", values: ["test-user-locked"], ...overrides } as ArgumentSpec;
}

export function buildPolicyEntry(overrides: Partial<ActionPolicyEntry> = {}): ActionPolicyEntry {
  return {
    id: "account-status",
    description: "Checks whether a local test account is locked",
    category: "password_login",
    guidedStepRef: null,
    tier: "read_only",
    command: "sudo /usr/local/bin/account-status.sh {{username}}",
    arguments: [buildArgumentSpec()],
    allowedEndpointIds: ["test-node-a"],
    verifiedBy: null,
    timeoutMs: null,
    ...overrides,
  };
}

export function buildTestEndpoint(overrides: Partial<TestEndpoint> = {}): TestEndpoint {
  return {
    id: "test-node-a",
    label: "Test Node A",
    host: "127.0.0.1",
    port: 2201,
    username: "remediation",
    hostKeyFingerprint: "fixture-fingerprint",
    description: "Fixture endpoint",
    ...overrides,
  };
}

interface ActionRecordFixtureOptions {
  actor?: Actor;
  ticketId?: Types.ObjectId | null;
  classifiedIntent?: string;
  policyEntryId?: string | null;
  tier?: ActionTier | null;
  requestedAction?: string;
  endpointId?: string | null;
  outcome?: ActionOutcome;
  refusalReason?: RefusalReason | null;
}

export async function createActionRecordFixture(options: ActionRecordFixtureOptions = {}): Promise<HydratedDocument<ActionRecordDoc>> {
  const doc = await ActionRecord.create({
    actor: options.actor ?? "agent",
    ticketId: options.ticketId ?? null,
    classifiedIntent: options.classifiedIntent ?? "check service status",
    policyEntryId: options.policyEntryId ?? "service-status",
    tier: options.tier ?? "read_only",
    requestedAction: options.requestedAction ?? "service-status widget-service",
    endpointId: options.endpointId ?? "test-node-a",
    authorisation: {},
    outcome: options.outcome ?? "succeeded",
    refusalReason: options.refusalReason ?? null,
  });
  return doc as unknown as HydratedDocument<ActionRecordDoc>;
}

interface ApprovalRequestFixtureOptions {
  ticketId: Types.ObjectId;
  conversationId: Types.ObjectId;
  byAccountId: Types.ObjectId;
  messageId?: Types.ObjectId;
  policyEntryId?: string;
  arguments?: Record<string, string>;
  endpointId?: string;
  status?: ApprovalStatus;
  expiresAt?: Date;
}

// T070/data-model.md §4: a pending (or already-decided, via `status`) approval
// request, ready for approval-service.test.ts and the Phase 5 integration tests.
export async function createApprovalRequestFixture(
  options: ApprovalRequestFixtureOptions,
): Promise<HydratedDocument<ApprovalRequestDoc>> {
  const doc = await ApprovalRequest.create({
    ticketId: options.ticketId,
    conversationId: options.conversationId,
    policyEntryId: options.policyEntryId ?? "unlock-account",
    arguments: options.arguments ?? { username: "test-user-locked" },
    endpointId: options.endpointId ?? "test-node-a",
    consent: {
      given: true,
      byAccountId: options.byAccountId,
      at: new Date(),
      messageId: options.messageId ?? new Types.ObjectId(),
    },
    status: options.status ?? "pending",
    raisedAt: new Date(),
    expiresAt: options.expiresAt ?? new Date(Date.now() + 30 * 60_000),
  });
  return doc as unknown as HydratedDocument<ApprovalRequestDoc>;
}
