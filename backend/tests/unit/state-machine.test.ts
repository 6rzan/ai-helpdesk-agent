import { describe, expect, it } from "vitest";
import { HANDLING_MODES, TICKET_STATUSES, type HandlingMode, type TicketStatus } from "../../src/models/enums.js";
import {
  transitionHandlingMode,
  transitionStatus,
  type TransitionableTicket,
} from "../../src/services/ticket/state-machine.js";

const ALLOWED_STATUS_TRANSITIONS: [TicketStatus, TicketStatus][] = [
  ["open", "in_progress"],
  ["in_progress", "resolved"],
  ["resolved", "closed"],
  ["resolved", "in_progress"],
  ["open", "closed"],
];

const ALLOWED_HANDLING_MODE_TRANSITIONS: [HandlingMode, HandlingMode][] = [
  ["automated", "waiting_on_user"],
  ["waiting_on_user", "automated"],
  ["automated", "human_involved"],
  ["waiting_on_user", "human_involved"],
];

function isAllowed<T extends string>(pairs: [T, T][], from: T, to: T): boolean {
  return pairs.some(([a, b]) => a === from && b === to);
}

function makeTicket(status: TicketStatus, handlingMode: HandlingMode): TransitionableTicket {
  return { status, handlingMode, history: [] };
}

describe("transitionStatus", () => {
  for (const from of TICKET_STATUSES) {
    for (const to of TICKET_STATUSES) {
      const allowed = isAllowed(ALLOWED_STATUS_TRANSITIONS, from, to);

      if (allowed) {
        it(`TC-019: allows status "${from}" -> "${to}" and records history`, () => {
          const ticket = makeTicket(from, "automated");
          transitionStatus(ticket, to, "staff");

          expect(ticket.status).toBe(to);
          expect(ticket.history).toHaveLength(1);
          expect(ticket.history[0]).toMatchObject({ field: "status", from, to, actor: "staff" });
          expect(ticket.history[0]?.at).toBeInstanceOf(Date);
        });
      } else {
        it(`TC-020: rejects status "${from}" -> "${to}"`, () => {
          const ticket = makeTicket(from, "automated");

          expect(() => transitionStatus(ticket, to, "staff")).toThrow();
          expect(ticket.status).toBe(from);
          expect(ticket.history).toHaveLength(0);
        });
      }
    }
  }
});

describe("transitionHandlingMode", () => {
  for (const from of HANDLING_MODES) {
    for (const to of HANDLING_MODES) {
      const allowed = isAllowed(ALLOWED_HANDLING_MODE_TRANSITIONS, from, to);

      if (allowed) {
        it(`TC-021: allows handlingMode "${from}" -> "${to}" and records history`, () => {
          const ticket = makeTicket("open", from);
          transitionHandlingMode(ticket, to, "system");

          expect(ticket.handlingMode).toBe(to);
          expect(ticket.history).toHaveLength(1);
          expect(ticket.history[0]).toMatchObject({ field: "handlingMode", from, to, actor: "system" });
          expect(ticket.history[0]?.at).toBeInstanceOf(Date);
        });
      } else {
        it(`TC-022: rejects handlingMode "${from}" -> "${to}"`, () => {
          const ticket = makeTicket("open", from);

          expect(() => transitionHandlingMode(ticket, to, "system")).toThrow();
          expect(ticket.handlingMode).toBe(from);
          expect(ticket.history).toHaveLength(0);
        });
      }
    }
  }
});

describe("state machine history", () => {
  it("TC-023: is append-only across multiple transitions", () => {
    const ticket = makeTicket("open", "automated");

    transitionStatus(ticket, "in_progress", "staff");
    transitionHandlingMode(ticket, "waiting_on_user", "agent");
    transitionStatus(ticket, "resolved", "staff");

    expect(ticket.history).toHaveLength(3);
    expect(ticket.history.map((h) => `${h.field}:${h.from}->${h.to}`)).toEqual([
      "status:open->in_progress",
      "handlingMode:automated->waiting_on_user",
      "status:in_progress->resolved",
    ]);
  });

  it("TC-024: human_involved has no outgoing handlingMode transitions", () => {
    const ticket = makeTicket("open", "human_involved");

    for (const to of HANDLING_MODES) {
      expect(() => transitionHandlingMode(ticket, to, "staff")).toThrow();
    }
    expect(ticket.history).toHaveLength(0);
  });
});
