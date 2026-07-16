import type { HydratedDocument, Types } from "mongoose";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "../../lib/errors.js";
import { Ticket } from "../../models/ticket.js";
import { UserAccount, type UserAccountDoc } from "../../models/user-account.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import type { AvailabilityStatus } from "../../models/enums.js";
import { transitionHandlingMode, type TransitionableTicket } from "../ticket/state-machine.js";
import { notifyTicketAssigned } from "../ticket/notifications.js";
import { publishStaffEvent } from "../../api/sse/event-bus.js";
import { getStaffTicketDetail } from "./staff-ticket-service.js";

type Staff = HydratedDocument<UserAccountDoc>;

const OPEN_CASE_STATUSES = ["open", "in_progress"];

/**
 * Claim an unassigned ticket for the caller (FR-007). The claim is a single atomic
 * conditional update (research R6): only the writer that flips `assignee` from null
 * wins; a concurrent second takeover matches nothing and is refused with the current
 * assignee (US2-5).
 */
export async function takeoverTicket(reference: string, staff: Staff) {
  const assignee = { accountId: staff._id, displayName: staff.displayName, since: new Date() };

  const claimed = await Ticket.findOneAndUpdate(
    // Closed work must remain immutable. Keeping this condition in the atomic claim
    // prevents a race from assigning a ticket that was resolved concurrently.
    { reference, assignee: null, status: { $nin: ["resolved", "closed"] } },
    { $set: { assignee } },
    { new: true },
  );

  if (!claimed) {
    const existing = await Ticket.findOne({ reference });
    if (!existing) {
      throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
    }
    if (existing.status === "resolved" || existing.status === "closed") {
      throw new ConflictError("Resolved or closed tickets cannot be taken over", "TICKET_NOT_ACTIONABLE");
    }
    throw new ConflictError("This ticket is already assigned to someone else", "ALREADY_ASSIGNED", {
      currentAssignee: existing.assignee
        ? { accountId: String(existing.assignee.accountId), displayName: existing.assignee.displayName }
        : null,
    });
  }

  // A takeover always lands the ticket in human handling (FR-007). The mode may already
  // be human_involved (escalated ticket) — the state machine makes that terminal, so
  // only transition when we're actually leaving automated/waiting.
  if (claimed.handlingMode !== "human_involved") {
    transitionHandlingMode(claimed as unknown as TransitionableTicket, "human_involved", "staff");
  }
  claimed.escalated = true;
  claimed.assignmentHistory.push({
    assigneeId: staff._id,
    assigneeName: staff.displayName,
    byId: staff._id,
    byName: staff.displayName,
    at: new Date(),
    kind: "takeover",
  });
  await claimed.save();

  await recordAndNotify(claimed, staff, "takeover", staff.displayName);
  return getStaffTicketDetail(reference);
}

/**
 * Reassign an already-owned ticket to another staff member (FR-019). The target must
 * be staff — a ticket is never handed back to a user or the agent. The move is guarded
 * on the current assignee so a stale reassignment loses cleanly (409).
 */
export async function reassignTicket(reference: string, toAccountId: string, staff: Staff) {
  const current = await Ticket.findOne({ reference });
  if (!current) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }
  if (!current.assignee) {
    throw new ConflictError("This ticket has no assignee to reassign — take it over first", "NOT_ASSIGNED");
  }

  const target = await UserAccount.findById(toAccountId);
  if (!target || target.role !== "staff") {
    throw new UnprocessableEntityError("A ticket can only be reassigned to IT staff", "INVALID_ASSIGNEE");
  }

  const newAssignee = { accountId: target._id, displayName: target.displayName, since: new Date() };
  const updated = await Ticket.findOneAndUpdate(
    { reference, "assignee.accountId": current.assignee.accountId },
    { $set: { assignee: newAssignee } },
    { new: true },
  );
  if (!updated) {
    throw new ConflictError("This ticket was reassigned by someone else — refresh and try again", "ASSIGNEE_CHANGED");
  }

  updated.assignmentHistory.push({
    assigneeId: target._id,
    assigneeName: target.displayName,
    byId: staff._id,
    byName: staff.displayName,
    at: new Date(),
    kind: "reassign",
  });
  await updated.save();

  await recordAndNotify(updated, staff, "reassign", target.displayName);
  return getStaffTicketDetail(reference);
}

async function recordAndNotify(
  ticket: { _id: Types.ObjectId; reference: string; reporterId: Types.ObjectId; reporterAccountId?: Types.ObjectId | null },
  staff: Staff,
  action: "takeover" | "reassign",
  assigneeName: string,
): Promise<void> {
  await StaffActionRecord.create({
    staffId: staff._id,
    staffName: staff.displayName,
    action,
    targetType: "ticket",
    targetId: ticket._id,
    details: { assigneeName },
  });
  notifyTicketAssigned(ticket, assigneeName);
  publishStaffEvent("ticket_updated", { ticketId: String(ticket._id), reference: ticket.reference, changed: "assignee" });
}

export interface RosterEntry {
  id: string;
  displayName: string;
  availability: AvailabilityStatus;
  openCaseCount: number;
}

/**
 * Every staff member with their live open-case count plus an advisory suggested
 * assignee: available, fewest open cases (research R7). Advisory only — staff always
 * confirm explicitly (FR-021), never auto-assigned.
 */
export async function getRoster(): Promise<{ staff: RosterEntry[]; suggestedAssigneeId: string | null }> {
  const accounts = await UserAccount.find({ role: "staff" }).sort({ displayName: 1 });

  const counts = await Ticket.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: { $in: OPEN_CASE_STATUSES }, "assignee.accountId": { $ne: null } } },
    { $group: { _id: "$assignee.accountId", count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  const staff: RosterEntry[] = accounts.map((account) => ({
    id: String(account._id),
    displayName: account.displayName,
    availability: (account.availability ?? "available") as AvailabilityStatus,
    openCaseCount: countById.get(String(account._id)) ?? 0,
  }));

  const suggested = staff
    .filter((s) => s.availability === "available")
    .sort((a, b) => a.openCaseCount - b.openCaseCount)[0];

  return { staff, suggestedAssigneeId: suggested ? suggested.id : null };
}

export async function updateAvailability(staff: Staff, availability: AvailabilityStatus): Promise<void> {
  staff.availability = availability;
  await staff.save();
}
