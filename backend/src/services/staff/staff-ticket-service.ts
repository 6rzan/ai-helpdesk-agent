import type { HydratedDocument, Types } from "mongoose";
import { NotFoundError, UnprocessableEntityError, isAppError } from "../../lib/errors.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { UserAccount } from "../../models/user-account.js";
import { SupportProfile } from "../../models/support-profile.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import type { UserAccountDoc } from "../../models/user-account.js";
import type { TicketStatus } from "../../models/enums.js";
import { applyStateTransition, toTicketDetail } from "../ticket/ticket-service.js";
import { publishStaffEvent } from "../../api/sse/event-bus.js";

export interface StaffTicketFilters {
  status?: string | undefined;
  category?: string | undefined;
  escalated?: boolean | undefined;
  sort?: "newest" | "oldest" | "updated" | undefined;
}

const SORT_ORDER: Record<NonNullable<StaffTicketFilters["sort"]>, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
};

/** All tickets for the dashboard list, each row carrying its reporter display name or
 * `null` when no account is linked (legacy tickets stay visible — FR-014). */
export async function listStaffTickets(filters: StaffTicketFilters) {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (typeof filters.escalated === "boolean") query.escalated = filters.escalated;

  const sort = SORT_ORDER[filters.sort ?? "newest"];
  const tickets = await Ticket.find(query).sort(sort);

  const accountIds = tickets
    .map((t) => t.reporterAccountId)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const accounts = await UserAccount.find({ _id: { $in: accountIds } }).select("displayName");
  const nameById = new Map(accounts.map((a) => [String(a._id), a.displayName]));

  return tickets.map((ticket) => ({
    reference: ticket.reference,
    category: ticket.category,
    status: ticket.status,
    handlingMode: ticket.handlingMode,
    escalated: ticket.escalated,
    description: ticket.description,
    reporter: ticket.reporterAccountId ? (nameById.get(String(ticket.reporterAccountId)) ?? null) : null,
    assignee: ticket.assignee ? ticket.assignee.displayName : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }));
}

/** Full-context detail for one ticket (transcript, classification, guided steps,
 * status history, current assignee + assignment trail) plus the reporter's support
 * profile surfaced automatically for the handling staff (FR-013). `profile` is
 * explicitly `null` when the reporter has no linked account or no profile on file. */
export async function getStaffTicketDetail(reference: string) {
  const ticket = await Ticket.findOne({ reference });
  if (!ticket) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }
  const detail = await toTicketDetail(ticket as unknown as TicketDoc);
  const profile = ticket.reporterAccountId ? await loadProfile(ticket.reporterAccountId) : null;
  const actions = await StaffActionRecord.find({ targetType: "ticket", targetId: ticket._id }).sort({ at: 1 });
  return {
    ...detail,
    reporterAccountId: ticket.reporterAccountId ? String(ticket.reporterAccountId) : null,
    assignee: ticket.assignee
      ? {
          accountId: String(ticket.assignee.accountId),
          displayName: ticket.assignee.displayName,
          since: ticket.assignee.since,
        }
      : null,
    assignmentHistory: ticket.assignmentHistory.map((entry) => ({
      assigneeId: String(entry.assigneeId),
      assigneeName: entry.assigneeName,
      byId: String(entry.byId),
      byName: entry.byName,
      at: entry.at,
      kind: entry.kind,
    })),
    staffActions: actions.map((action) => ({
      action: action.action,
      staffId: String(action.staffId),
      staffName: action.staffName,
      details: action.details,
      at: action.at,
    })),
    profile,
  };
}

async function loadProfile(accountId: Types.ObjectId) {
  const profile = await SupportProfile.findOne({ accountId });
  if (!profile) {
    return null;
  }
  return {
    remoteAccessIds: profile.remoteAccessIds.map((entry) => ({ tool: entry.tool, id: entry.id })),
    location: profile.location,
    hardware: profile.hardware,
    staffEntries: profile.staffEntries.map((entry) => ({
      kind: entry.kind,
      field: entry.field,
      value: entry.value,
      staffId: String(entry.staffId),
      staffName: entry.staffName,
      at: entry.at,
    })),
  };
}

export interface StaffStatusChangeInput {
  reference: string;
  status: TicketStatus;
  staff: HydratedDocument<UserAccountDoc>;
}

export async function applyStaffStatusChange(input: StaffStatusChangeInput) {
  const before = await Ticket.findOne({ reference: input.reference });
  if (!before) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }
  const from = before.status;

  let detail;
  try {
    detail = await applyStateTransition({
      reference: input.reference,
      field: "status",
      to: input.status,
      actor: "staff",
    });
  } catch (err) {
    // The shared state machine rejects invalid transitions with 409; the staff
    // contract surfaces them as 422 INVALID_TRANSITION (contracts/api.md).
    if (isAppError(err) && err.code === "INVALID_TRANSITION") {
      throw new UnprocessableEntityError(err.message, "INVALID_TRANSITION");
    }
    throw err;
  }

  await StaffActionRecord.create({
    staffId: input.staff._id,
    staffName: input.staff.displayName,
    action: input.status === "resolved" ? "resolve" : "status_change",
    targetType: "ticket",
    targetId: before._id,
    details: { from, to: input.status },
  });

  publishStaffEvent("ticket_updated", {
    ticketId: String(before._id),
    reference: input.reference,
    changed: "status",
  });

  return detail;
}
