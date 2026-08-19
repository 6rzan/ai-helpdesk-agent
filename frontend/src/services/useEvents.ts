import { useEffect, useRef } from "react";
import type {
  ActionProposedEvent,
  ActionRecordedEvent,
  AgentMessageEvent,
  AgentTokenEvent,
  ApprovalDecidedEvent,
  ApprovalPendingEvent,
  RemediationAvailabilityChangedEvent,
  StaffStreamEvent,
  TicketCreatedEvent,
  TicketUpdatedEvent,
} from "../lib/types";

export interface EventHandlers {
  onAgentToken?: (data: AgentTokenEvent) => void;
  onAgentMessage?: (data: AgentMessageEvent) => void;
  onTicketCreated?: (data: TicketCreatedEvent) => void;
  onTicketUpdated?: (data: TicketUpdatedEvent) => void;
  onActionProposed?: (data: ActionProposedEvent) => void;
  onActionRecorded?: (data: ActionRecordedEvent) => void;
  onApprovalPending?: (data: ApprovalPendingEvent) => void;
  onApprovalDecided?: (data: ApprovalDecidedEvent) => void;
}

export interface StaffEventHandlers {
  onTicketCreated?: (data: StaffStreamEvent) => void;
  onTicketUpdated?: (data: StaffStreamEvent) => void;
  onActionRecorded?: (data: ActionRecordedEvent) => void;
  onApprovalPending?: (data: ApprovalPendingEvent) => void;
  onApprovalDecided?: (data: ApprovalDecidedEvent) => void;
  onRemediationAvailabilityChanged?: (data: RemediationAvailabilityChangedEvent) => void;
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
    source.addEventListener("action_proposed", (event) => {
      handlersRef.current.onActionProposed?.(JSON.parse((event as MessageEvent<string>).data) as ActionProposedEvent);
    });
    source.addEventListener("action_recorded", (event) => {
      handlersRef.current.onActionRecorded?.(JSON.parse((event as MessageEvent<string>).data) as ActionRecordedEvent);
    });
    source.addEventListener("approval_pending", (event) => {
      handlersRef.current.onApprovalPending?.(JSON.parse((event as MessageEvent<string>).data) as ApprovalPendingEvent);
    });
    source.addEventListener("approval_decided", (event) => {
      handlersRef.current.onApprovalDecided?.(JSON.parse((event as MessageEvent<string>).data) as ApprovalDecidedEvent);
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
    source.addEventListener("action_recorded", (event) => {
      handlersRef.current.onActionRecorded?.(JSON.parse((event as MessageEvent<string>).data) as ActionRecordedEvent);
    });
    source.addEventListener("approval_pending", (event) => {
      handlersRef.current.onApprovalPending?.(JSON.parse((event as MessageEvent<string>).data) as ApprovalPendingEvent);
    });
    source.addEventListener("approval_decided", (event) => {
      handlersRef.current.onApprovalDecided?.(JSON.parse((event as MessageEvent<string>).data) as ApprovalDecidedEvent);
    });
    source.addEventListener("remediation_availability_changed", (event) => {
      handlersRef.current.onRemediationAvailabilityChanged?.(
        JSON.parse((event as MessageEvent<string>).data) as RemediationAvailabilityChangedEvent,
      );
    });

    return () => {
      source.close();
    };
  }, [enabled]);
}

export function useMyTicketEvents(enabled: boolean, onTicketUpdated: () => void): void {
  const callback = useRef(onTicketUpdated); callback.current = onTicketUpdated;
  useEffect(() => { if (!enabled) return; const source = new EventSource("/api/my/events");
    source.addEventListener("ticket_updated", () => callback.current()); return () => source.close(); }, [enabled]);
}
