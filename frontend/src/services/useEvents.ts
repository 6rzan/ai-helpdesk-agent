import { useEffect, useRef } from "react";
import type {
  AgentMessageEvent,
  AgentTokenEvent,
  StaffStreamEvent,
  TicketCreatedEvent,
  TicketUpdatedEvent,
} from "../lib/types";

export interface EventHandlers {
  onAgentToken?: (data: AgentTokenEvent) => void;
  onAgentMessage?: (data: AgentMessageEvent) => void;
  onTicketCreated?: (data: TicketCreatedEvent) => void;
  onTicketUpdated?: (data: TicketUpdatedEvent) => void;
}

export interface StaffEventHandlers {
  onTicketCreated?: (data: StaffStreamEvent) => void;
  onTicketUpdated?: (data: StaffStreamEvent) => void;
}

export function useEvents(sessionId: string | undefined, handlers: EventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const source = new EventSource(`/api/events?sessionId=${encodeURIComponent(sessionId)}`);

    source.addEventListener("agent_token", (event) => {
      handlersRef.current.onAgentToken?.(JSON.parse((event as MessageEvent<string>).data) as AgentTokenEvent);
    });
    source.addEventListener("agent_message", (event) => {
      handlersRef.current.onAgentMessage?.(JSON.parse((event as MessageEvent<string>).data) as AgentMessageEvent);
    });
    source.addEventListener("ticket_created", (event) => {
      handlersRef.current.onTicketCreated?.(JSON.parse((event as MessageEvent<string>).data) as TicketCreatedEvent);
    });
    source.addEventListener("ticket_updated", (event) => {
      handlersRef.current.onTicketUpdated?.(JSON.parse((event as MessageEvent<string>).data) as TicketUpdatedEvent);
    });

    return () => {
      source.close();
    };
  }, [sessionId]);
}

/** Subscribe to the staff-wide ticket stream (`/api/staff/events`). Emits lightweight
 * `{ ticketId, reference, changed }` events so the dashboard can refresh live. Guarded
 * with `enabled` so it only connects for signed-in staff. */
export function useStaffEvents(enabled: boolean, handlers: StaffEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const source = new EventSource("/api/staff/events");

    source.addEventListener("ticket_created", (event) => {
      handlersRef.current.onTicketCreated?.(JSON.parse((event as MessageEvent<string>).data) as StaffStreamEvent);
    });
    source.addEventListener("ticket_updated", (event) => {
      handlersRef.current.onTicketUpdated?.(JSON.parse((event as MessageEvent<string>).data) as StaffStreamEvent);
    });

    return () => {
      source.close();
    };
  }, [enabled]);
}
