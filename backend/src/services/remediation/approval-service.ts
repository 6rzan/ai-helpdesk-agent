import type { HydratedDocument, Types } from "mongoose";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { ActionRecord } from "../../models/action-record.js";
import { ApprovalRequest, type ApprovalRequestDoc } from "../../models/approval-request.js";
import type { ApprovalStatus } from "../../models/enums.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import { Ticket } from "../../models/ticket.js";
import type { UserAccountDoc } from "../../models/user-account.js";
import { publishAccountEvent, publishEvent, publishStaffEvent } from "../../api/sse/event-bus.js";
import { config } from "../../config/index.js";
import { getPolicy } from "../../policy/policy-loader.js";
import { escalateTicketForGuidance, sendAgentReply } from "../conversation/conversation-guidance.js";
import { isRemediationAvailable } from "./availability-service.js";
import type { ConsentRecordInput } from "./audit-service.js";
import { isPasswordPathEntry, TEST_ACCOUNT_DISCLOSURE } from "./disclosure.js";
import { attemptAction, type AttemptActionResult } from "./policy-engine.js";

// data-model.md §4 "Approval Request" (T071, R6). Nothing state-changing
// executes without an entry here reaching `approved` through this module —
// consent-service raises the request, this module is the only place that
// decides it, and policy-engine.attemptAction is still the only place that
// ever calls the executor.

type Staff = HydratedDocument<UserAccountDoc>;

export interface RaiseApprovalInput {
  ticketId: Types.ObjectId;
  ticketReference: string;
  conversationId: Types.ObjectId;
  reporterAccountId: Types.ObjectId;
  policyEntryId: string;
  arguments: Record<string, string>;
  endpointId: string;
  description: string;
  consent: ConsentRecordInput;
}

/** Raises one pending approval request for a specific proposed action (FR-004a).
 * There is no standing or category-wide approval — every request names one
 * exact (policyEntryId, arguments, endpointId) tuple (data-model.md §4). */
export async function raiseApprovalRequest(input: RaiseApprovalInput): Promise<ApprovalRequestDoc> {
  const expiresAt = new Date(Date.now() + config.REMEDIATION_APPROVAL_TTL_MINUTES * 60_000);

  const request = await ApprovalRequest.create({
    ticketId: input.ticketId,
    conversationId: input.conversationId,
    policyEntryId: input.policyEntryId,
    arguments: input.arguments,
    endpointId: input.endpointId,
    consent: input.consent,
    status: "pending",
    raisedAt: new Date(),
    expiresAt,
  });

  const payload = { ticketId: input.ticketReference, approvalId: request._id.toString(), description: input.description };
  publishAccountEvent(input.reporterAccountId.toString(), "approval_pending", payload);
  publishStaffEvent("approval_pending", payload);

  return request;
}

/** `expired` is evaluated lazily, only when a request is listed or a decision
 * is attempted on it — never on a schedule (R6). Expiry never means approval. */
async function expireIfPastDue(request: ApprovalRequestDoc): Promise<ApprovalRequestDoc> {
  if (request.status !== "pending" || request.expiresAt.getTime() > Date.now()) {
    return request;
  }
  const expired = await ApprovalRequest.findOneAndUpdate(
    { _id: request._id, status: "pending" },
    { status: "expired", decidedAt: new Date(), closureReason: "expired" },
    { new: true },
  );
  return expired ?? request;
}

/** Staff queue read (contracts/api.md `GET /staff/approvals`): lazily expires
 * every currently-pending request before returning, so a stale `pending` row
 * is never shown as actionable. */
export async function listApprovalRequests(statusFilter?: ApprovalStatus): Promise<ApprovalRequestDoc[]> {
  const pending = await ApprovalRequest.find({ status: "pending" });
  await Promise.all(pending.map((request) => expireIfPastDue(request)));

  const query = statusFilter ? { status: statusFilter } : {};
  return ApprovalRequest.find(query).sort({ raisedAt: -1 });
}

/** data-model.md §4, contracts/api.md: the one JSON shape for an approval
 * request, shown identically to staff (`/staff/approvals`) and to the
 * reporter on their own ticket (`GET /tickets/:reference/actions`) — same
 * plain-language principle as `toActionRecordJson` (audit-service.ts). */
export async function toApprovalRequestJson(request: ApprovalRequestDoc) {
  const policy = getPolicy();
  const entry = policy.entries.get(request.policyEntryId);
  const endpoint = policy.endpoints.get(request.endpointId);
  const ticket = await Ticket.findById(request.ticketId);
  return {
    id: request._id.toString(),
    ticketReference: ticket?.reference ?? null,
    policyEntryId: request.policyEntryId,
    description: entry?.description ?? request.policyEntryId,
    command: entry?.command ?? null,
    arguments: request.arguments,
    endpointId: request.endpointId,
    endpointLabel: endpoint?.label ?? request.endpointId,
    consent: {
      given: request.consent.given,
      byAccountId: request.consent.byAccountId.toString(),
      at: request.consent.at,
    },
    status: request.status,
    raisedAt: request.raisedAt,
    expiresAt: request.expiresAt,
    decidedBy: request.decidedBy ? { accountId: request.decidedBy.accountId.toString(), displayName: request.decidedBy.displayName } : null,
    decidedAt: request.decidedAt,
    closureReason: request.closureReason,
    resultingActionRecordId: request.resultingActionRecordId?.toString() ?? null,
  };
}

/** Every approval request raised for one ticket, newest first -- the
 * reporter's own view (US3 AS6) reuses this alongside their action records. */
export async function listApprovalRequestsForTicket(ticketId: Types.ObjectId): Promise<ApprovalRequestDoc[]> {
  return ApprovalRequest.find({ ticketId }).sort({ raisedAt: -1 });
}

/** R6: re-checked at approval time, never assumed still true from when the
 * request was raised — ticket still open, remediation enabled globally and
 * for this endpoint, and this exact action not already executed for the ticket. */
async function preconditionsStillHold(request: ApprovalRequestDoc): Promise<boolean> {
  const ticket = await Ticket.findById(request.ticketId);
  if (!ticket || ticket.status === "resolved" || ticket.status === "closed") {
    return false;
  }
  if (!(await isRemediationAvailable(request.endpointId))) {
    return false;
  }
  const alreadyExecuted = await ActionRecord.exists({
    ticketId: request.ticketId,
    policyEntryId: request.policyEntryId,
    outcome: { $in: ["succeeded", "failed", "timed_out", "attempted_unverified"] },
  });
  return !alreadyExecuted;
}

export interface DecideApprovalInput {
  approvalId: string;
  staff: Staff;
  granted: boolean;
  reason?: string;
}

export interface DecideApprovalResult {
  status: ApprovalStatus;
  execution: AttemptActionResult | null;
}

async function closeAndNotify(
  request: ApprovalRequestDoc,
  status: ApprovalStatus,
  staff: Staff,
  closureReason: string | null,
): Promise<ApprovalRequestDoc | null> {
  return ApprovalRequest.findOneAndUpdate(
    { _id: request._id, status: "pending" },
    { status, decidedAt: new Date(), decidedBy: { accountId: staff._id, displayName: staff.displayName }, closureReason },
    { new: true },
  );
}

/** A conditional update that found no `pending` row to claim means another
 * decision won the race between our read and our write. Still attributed
 * (R6 edge case: "both attempts attributed"), even though this one never
 * takes effect. */
async function attributeLostRace(requestId: Types.ObjectId, staff: Staff, decision: "approved" | "declined"): Promise<void> {
  const now = await ApprovalRequest.findById(requestId);
  await StaffActionRecord.create({
    staffId: staff._id,
    staffName: staff.displayName,
    action: "approval_decision",
    targetType: "remediation",
    targetId: requestId,
    details: { decision, conflict: true, resultingStatus: now?.status ?? "unknown" },
  });
}

function publishDecided(ticketReference: string, reporterAccountId: Types.ObjectId | null, approvalId: string, status: ApprovalStatus, staff: Staff): void {
  const payload = { ticketId: ticketReference, approvalId, status, decidedBy: staff.displayName };
  if (reporterAccountId) {
    publishAccountEvent(reporterAccountId.toString(), "approval_decided", payload);
  }
  publishStaffEvent("approval_decided", payload);
}

/**
 * The single funnel every approval decision passes through (FR-004b). Every
 * transition is a conditional update on `status: "pending"` so two staff
 * deciding at nearly the same moment resolve with the first writer winning
 * and the second receiving `APPROVAL_ALREADY_DECIDED` (R6) — never a plain
 * save. Declining and a failed precondition check never call the executor.
 */
export async function decideApproval(input: DecideApprovalInput): Promise<DecideApprovalResult> {
  const existing = await ApprovalRequest.findById(input.approvalId);
  if (!existing) {
    throw new NotFoundError("Unknown approval request", "APPROVAL_NOT_FOUND");
  }

  const current = await expireIfPastDue(existing);
  if (current.status !== "pending") {
    // Not just refused -- this attempt is attributed too, so a staff member
    // who loses a race still has their own decision on the record (R6 edge
    // case: "both attempts attributed").
    await StaffActionRecord.create({
      staffId: input.staff._id,
      staffName: input.staff.displayName,
      action: "approval_decision",
      targetType: "remediation",
      targetId: current._id,
      details: { decision: input.granted ? "approved" : "declined", conflict: true, resultingStatus: current.status },
    });
    throw new ConflictError("This approval request has already been decided", "APPROVAL_ALREADY_DECIDED");
  }

  const ticket = await Ticket.findById(current.ticketId);
  const ticketReference = ticket?.reference ?? current.ticketId.toString();

  if (!input.granted) {
    const declined = await closeAndNotify(current, "declined", input.staff, input.reason ?? null);
    if (!declined) {
      await attributeLostRace(current._id, input.staff, "declined");
      throw new ConflictError("This approval request has already been decided", "APPROVAL_ALREADY_DECIDED");
    }
    await StaffActionRecord.create({
      staffId: input.staff._id,
      staffName: input.staff.displayName,
      action: "approval_decision",
      targetType: "remediation",
      targetId: declined._id,
      details: { decision: "declined", reason: input.reason ?? null },
    });
    publishDecided(ticketReference, ticket?.reporterAccountId ?? null, declined._id.toString(), "declined", input.staff);
    return { status: "declined", execution: null };
  }

  // Preconditions are re-checked before the row is claimed, so a failing
  // precondition never consumes the pending slot as "approved" (R6).
  if (!(await preconditionsStillHold(current))) {
    const closed = await closeAndNotify(current, "no_longer_applicable", input.staff, "precondition_failed");
    if (!closed) {
      await attributeLostRace(current._id, input.staff, "approved");
      throw new ConflictError("This approval request has already been decided", "APPROVAL_ALREADY_DECIDED");
    }
    await StaffActionRecord.create({
      staffId: input.staff._id,
      staffName: input.staff.displayName,
      action: "approval_decision",
      targetType: "remediation",
      targetId: closed._id,
      details: { decision: "approved", precondition_failed: true },
    });
    publishDecided(ticketReference, ticket?.reporterAccountId ?? null, closed._id.toString(), "no_longer_applicable", input.staff);
    throw new ConflictError("This action is no longer applicable", "APPROVAL_NO_LONGER_APPLICABLE");
  }

  const claimed = await ApprovalRequest.findOneAndUpdate(
    { _id: current._id, status: "pending" },
    { status: "approved", decidedAt: new Date(), decidedBy: { accountId: input.staff._id, displayName: input.staff.displayName } },
    { new: true },
  );
  if (!claimed) {
    await attributeLostRace(current._id, input.staff, "approved");
    throw new ConflictError("This approval request has already been decided", "APPROVAL_ALREADY_DECIDED");
  }

  const policy = getPolicy();
  const entry = policy.entries.get(claimed.policyEntryId);

  const result = await attemptAction({
    actor: "staff",
    ticketId: claimed.ticketId,
    conversationId: claimed.conversationId,
    classifiedIntent: ticket?.category ?? entry?.category ?? claimed.policyEntryId,
    policyEntryId: claimed.policyEntryId,
    arguments: claimed.arguments as Record<string, string>,
    endpointId: claimed.endpointId,
    consent: claimed.consent,
    approval: { requestId: claimed._id, byAccountId: input.staff._id, displayName: input.staff.displayName, at: new Date() },
  });

  claimed.resultingActionRecordId = result.actionRecordId ?? null;
  await claimed.save();

  await StaffActionRecord.create({
    staffId: input.staff._id,
    staffName: input.staff.displayName,
    action: "approval_decision",
    targetType: "remediation",
    targetId: claimed._id,
    details: { decision: "approved", outcome: result.outcome },
  });

  publishDecided(ticketReference, ticket?.reporterAccountId ?? null, claimed._id.toString(), "approved", input.staff);

  if (ticket) {
    const description = entry?.description ?? claimed.policyEntryId;
    const replyCtx = { sessionId: ticketReference, conversationId: ticket.conversationId, reporterId: ticket.reporterId, text: "" };
    const actionRecordedPayload = {
      ticketId: ticketReference,
      actionRecordId: result.actionRecordId?.toString() ?? null,
      outcome: result.outcome,
      summary: `${result.outcome}: ${description}`,
    };
    publishEvent(replyCtx.sessionId, "action_recorded", actionRecordedPayload);
    publishStaffEvent("action_recorded", actionRecordedPayload);
    const report = chatReportForApproval(description, result.outcome, input.staff.displayName);
    const withDisclosure = isPasswordPathEntry(claimed.policyEntryId) ? `${report} ${TEST_ACCOUNT_DISCLOSURE}` : report;
    await sendAgentReply(replyCtx, withDisclosure);
    if (result.outcome === "failed" || result.outcome === "timed_out" || result.outcome === "attempted_unverified") {
      await escalateTicketForGuidance(replyCtx, ticket, "remediation_issue");
    }
  }

  return { status: "approved", execution: result };
}

function chatReportForApproval(description: string, outcome: AttemptActionResult["outcome"], staffName: string): string {
  switch (outcome) {
    case "succeeded":
      return `${staffName} approved and ran that action (${description}), and it completed successfully.`;
    case "failed":
      return `${staffName} approved that action (${description}), but it didn't succeed. I'm bringing in a person to help from here.`;
    case "timed_out":
      return `${staffName} approved that action (${description}), but the test system didn't respond in time. I'm bringing in a person to help from here.`;
    case "attempted_unverified":
      return `${staffName} approved that action (${description}), but I couldn't confirm the result. I'm bringing in a person to help from here.`;
    default:
      return `${staffName} decided that action (${description}): ${outcome}.`;
  }
}
