import type { Types } from "mongoose";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { nextTicketReference } from "./counter.js";
import { Message } from "../../models/message.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import type { Actor, EscalationReason, HandlingMode, IssueCategory, TicketStatus } from "../../models/enums.js";
import { askResolutionConfirmation, notifyTicketUpdated } from "./notifications.js";
import { transitionHandlingMode, transitionStatus, type TransitionableTicket } from "./state-machine.js";

export interface CreateTicketInput {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  description: string;
  category: IssueCategory;
  confidence: number | null;
  handlingMode: HandlingMode;
  escalated: boolean;
  escalationReason?: EscalationReason;
}

export async function createTicket(input: CreateTicketInput): Promise<TicketDoc> {
  const reference = await nextTicketReference();
  const ticket = await Ticket.create({
    reference,
    reporterId: input.reporterId,
    conversationId: input.conversationId,
    description: input.description,
    category: input.category,
    classificationConfidence: input.confidence,
    status: "open",
    handlingMode: input.handlingMode,
    escalated: input.escalated,
    escalationReason: input.escalationReason ?? null,
  });
  return ticket as unknown as TicketDoc;
}

export function toTicketSummary(ticket: TicketDoc) {
  return {
    reference: ticket.reference,
    category: ticket.category,
    status: ticket.status,
    handlingMode: ticket.handlingMode,
    escalated: ticket.escalated,
    description: ticket.description,
    createdAt: ticket.createdAt,
  };
}

export async function toTicketDetail(ticket: TicketDoc) {
  const transcript = await Message.find({ conversationId: ticket.conversationId }).sort({ sentAt: 1 });
  return {
    ...toTicketSummary(ticket),
    escalationReason: ticket.escalationReason ?? null,
    classificationConfidence: ticket.classificationConfidence ?? null,
    history: ticket.history.map((record) => ({
      at: record.at,
      field: record.field,
      from: record.from,
      to: record.to,
      actor: record.actor,
    })),
    transcript: transcript.map((message) => ({
      _id: message._id.toString(),
      author: message.author,
      text: message.text,
      inputOrigin: message.inputOrigin,
      sentAt: message.sentAt,
    })),
  };
}

export async function listTicketsForReporter(reporterId: Types.ObjectId) {
  const tickets = await Ticket.find({ reporterId }).sort({ createdAt: -1 });
  return tickets.map((ticket) => toTicketSummary(ticket as unknown as TicketDoc));
}

export async function findOwnedTicket(reference: string, reporterId: Types.ObjectId): Promise<TicketDoc> {
  const ticket = await Ticket.findOne({ reference });
  if (!ticket) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }
  if (!ticket.reporterId.equals(reporterId)) {
    throw new ForbiddenError("This ticket belongs to another reporter", "TICKET_FORBIDDEN");
  }
  return ticket as unknown as TicketDoc;
}

export interface StateTransitionInput {
  reference: string;
  field: "status" | "handlingMode";
  to: string;
  actor: Actor;
}

export async function applyStateTransition(input: StateTransitionInput) {
  const ticket = await Ticket.findOne({ reference: input.reference });
  if (!ticket) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }

  const transitionable = ticket as unknown as TransitionableTicket;
  if (input.field === "status") {
    transitionStatus(transitionable, input.to as TicketStatus, input.actor);
  } else {
    transitionHandlingMode(transitionable, input.to as HandlingMode, input.actor);
    if (input.to === "human_involved") {
      ticket.escalated = true;
    }
  }
  await ticket.save();

  const transition = ticket.history[ticket.history.length - 1];
  if (transition) {
    notifyTicketUpdated(ticket, transition);
  }
  if (input.field === "status" && input.to === "resolved") {
    await askResolutionConfirmation(ticket);
  }
  return toTicketDetail(ticket as unknown as TicketDoc);
}
