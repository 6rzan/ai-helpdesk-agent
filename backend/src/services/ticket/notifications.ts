import type { Types } from "mongoose";
import { publishEvent } from "../../api/sse/event-bus.js";
import { Message } from "../../models/message.js";
import { getSessionIdsForReporter } from "../session/session-service.js";

const STATUS_LABELS: Record<string, string> = {
  open: "open",
  in_progress: "being worked on",
  resolved: "resolved",
  closed: "closed",
};

const HANDLING_MODE_LABELS: Record<string, string> = {
  automated: "being handled automatically",
  waiting_on_user: "waiting on a reply from you",
  human_involved: "with IT staff",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function handlingModeLabel(mode: string): string {
  return HANDLING_MODE_LABELS[mode] ?? mode.replace(/_/g, " ");
}

export interface TicketTransition {
  at: Date;
  field: "status" | "handlingMode";
  from: string;
  to: string;
}

export function plainTextForTransition(reference: string, transition: Pick<TicketTransition, "field" | "to">): string {
  const label = transition.field === "status" ? statusLabel(transition.to) : handlingModeLabel(transition.to);
  return `Ticket ${reference} is now ${label}.`;
}

export function notifyTicketUpdated(
  ticket: { reporterId: Types.ObjectId; reference: string },
  transition: TicketTransition,
): void {
  const payload = {
    reference: ticket.reference,
    field: transition.field,
    from: transition.from,
    to: transition.to,
    at: transition.at,
    plainText: plainTextForTransition(ticket.reference, transition),
  };
  for (const sessionId of getSessionIdsForReporter(ticket.reporterId)) {
    publishEvent(sessionId, "ticket_updated", payload);
  }
}

// FR-009/FR-020: mirror an assignment change into the reporter's chat in plain
// language, so they always know a named person now owns their case.
export function notifyTicketAssigned(
  ticket: { reporterId: Types.ObjectId; reference: string },
  assigneeName: string,
): void {
  const at = new Date();
  const payload = {
    reference: ticket.reference,
    field: "handlingMode" as const,
    from: "",
    to: "human_involved",
    at,
    assigneeName,
    plainText: `Ticket ${ticket.reference} is now being handled by ${assigneeName}.`,
  };
  for (const sessionId of getSessionIdsForReporter(ticket.reporterId)) {
    publishEvent(sessionId, "ticket_updated", payload);
  }
}

// US2-AS4/FR-004: when staff mark a ticket resolved, ask the reporter to confirm
// the fix so the ticket can be closed (or reopened if the problem persists).
export async function askResolutionConfirmation(ticket: {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  reference: string;
}): Promise<void> {
  const text = `Ticket ${ticket.reference} has been marked resolved — is everything working now? Reply "yes" to close it, or tell me if it's still not working.`;
  const message = await Message.create({
    conversationId: ticket.conversationId,
    author: "agent",
    text,
    inputOrigin: "typed",
  });
  const payload = {
    conversationId: ticket.conversationId.toString(),
    message: {
      _id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      author: message.author,
      text: message.text,
      sentAt: message.sentAt,
    },
  };
  for (const sessionId of getSessionIdsForReporter(ticket.reporterId)) {
    publishEvent(sessionId, "agent_message", payload);
  }
}
