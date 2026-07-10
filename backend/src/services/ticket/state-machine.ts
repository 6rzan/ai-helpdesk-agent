import { clock } from "../../lib/clock.js";
import { ConflictError } from "../../lib/errors.js";
import type { Actor, HandlingMode, TicketStatus } from "../../models/enums.js";

export interface TransitionRecordLike {
  at: Date;
  field: "status" | "handlingMode";
  from: string;
  to: string;
  actor: Actor;
}

export interface TransitionableTicket {
  status: TicketStatus;
  handlingMode: HandlingMode;
  history: TransitionRecordLike[];
}

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

const HANDLING_MODE_TRANSITIONS: Record<HandlingMode, HandlingMode[]> = {
  automated: ["waiting_on_user", "human_involved"],
  waiting_on_user: ["automated", "human_involved"],
  human_involved: [],
};

export function transitionStatus(ticket: TransitionableTicket, to: TicketStatus, actor: Actor): void {
  const from = ticket.status;
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition ticket status from "${from}" to "${to}"`, "INVALID_TRANSITION");
  }
  ticket.status = to;
  ticket.history.push({ at: clock.now(), field: "status", from, to, actor });
}

export function transitionHandlingMode(ticket: TransitionableTicket, to: HandlingMode, actor: Actor): void {
  const from = ticket.handlingMode;
  if (!HANDLING_MODE_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition ticket handling mode from "${from}" to "${to}"`, "INVALID_TRANSITION");
  }
  ticket.handlingMode = to;
  ticket.history.push({ at: clock.now(), field: "handlingMode", from, to, actor });
}
