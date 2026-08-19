import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEvents, useMyEvents, useStaffEvents } from "../../src/services/useEvents";

type Listener = (event: MessageEvent<string>) => void;

class RecordingEventSource {
  static instances: RecordingEventSource[] = [];
  listeners = new Map<string, Listener[]>();

  constructor(public url: string) {
    RecordingEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(): void {}
  close(): void {}

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent<string>);
    }
  }
}

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  RecordingEventSource.instances = [];
  (globalThis as unknown as { EventSource: unknown }).EventSource = RecordingEventSource;
});

afterEach(() => {
  (globalThis as unknown as { EventSource: unknown }).EventSource = originalEventSource;
});

describe("useEvents", () => {
  it("still fires the existing ticket_created and ticket_updated handlers (regression)", () => {
    const onTicketCreated = vi.fn();
    const onTicketUpdated = vi.fn();
    renderHook(() => useEvents("session-1", { onTicketCreated, onTicketUpdated }));

    const source = RecordingEventSource.instances[0]!;
    source.emit("ticket_created", { ticket: { reference: "T-1" } });
    source.emit("ticket_updated", { reference: "T-1", field: "status", from: "open", to: "closed" });

    expect(onTicketCreated).toHaveBeenCalledWith({ ticket: { reference: "T-1" } });
    expect(onTicketUpdated).toHaveBeenCalledWith({ reference: "T-1", field: "status", from: "open", to: "closed" });
  });

  it("fires the new 005 remediation event handlers", () => {
    const onActionProposed = vi.fn();
    const onActionRecorded = vi.fn();
    const onApprovalPending = vi.fn();
    const onApprovalDecided = vi.fn();
    renderHook(() =>
      useEvents("session-1", { onActionProposed, onActionRecorded, onApprovalPending, onApprovalDecided }),
    );

    const source = RecordingEventSource.instances[0]!;
    const proposed = { ticketId: "t1", proposalId: "p1", tier: "read_only", description: "check status", endpointLabel: "Test Node A" };
    const recorded = { ticketId: "t1", actionRecordId: "a1", outcome: "succeeded", summary: "done" };
    const pending = { ticketId: "t1", approvalId: "ap1", description: "restart service" };
    const decided = { ticketId: "t1", approvalId: "ap1", status: "approved" };

    source.emit("action_proposed", proposed);
    source.emit("action_recorded", recorded);
    source.emit("approval_pending", pending);
    source.emit("approval_decided", decided);

    expect(onActionProposed).toHaveBeenCalledWith(proposed);
    expect(onActionRecorded).toHaveBeenCalledWith(recorded);
    expect(onApprovalPending).toHaveBeenCalledWith(pending);
    expect(onApprovalDecided).toHaveBeenCalledWith(decided);
  });
});

describe("useStaffEvents", () => {
  it("still fires the existing ticket_created and ticket_updated handlers (regression)", () => {
    const onTicketCreated = vi.fn();
    const onTicketUpdated = vi.fn();
    renderHook(() => useStaffEvents(true, { onTicketCreated, onTicketUpdated }));

    const source = RecordingEventSource.instances[0]!;
    source.emit("ticket_created", { ticketId: "t1", reference: "T-1", changed: "created" });
    source.emit("ticket_updated", { ticketId: "t1", reference: "T-1", changed: "status" });

    expect(onTicketCreated).toHaveBeenCalledWith({ ticketId: "t1", reference: "T-1", changed: "created" });
    expect(onTicketUpdated).toHaveBeenCalledWith({ ticketId: "t1", reference: "T-1", changed: "status" });
  });

  it("fires the new 005 remediation event handlers", () => {
    const onActionRecorded = vi.fn();
    const onApprovalPending = vi.fn();
    const onApprovalDecided = vi.fn();
    const onRemediationAvailabilityChanged = vi.fn();
    renderHook(() =>
      useStaffEvents(true, { onActionRecorded, onApprovalPending, onApprovalDecided, onRemediationAvailabilityChanged }),
    );

    const source = RecordingEventSource.instances[0]!;
    const recorded = { ticketId: "t1", actionRecordId: "a1", outcome: "refused", summary: "not permitted" };
    const pending = { ticketId: "t1", approvalId: "ap1", description: "clear print queue" };
    const decided = { ticketId: "t1", approvalId: "ap1", status: "declined" };
    const availability = { globallyEnabled: false, disabledEndpointIds: ["test-node-a"] };

    source.emit("action_recorded", recorded);
    source.emit("approval_pending", pending);
    source.emit("approval_decided", decided);
    source.emit("remediation_availability_changed", availability);

    expect(onActionRecorded).toHaveBeenCalledWith(recorded);
    expect(onApprovalPending).toHaveBeenCalledWith(pending);
    expect(onApprovalDecided).toHaveBeenCalledWith(decided);
    expect(onRemediationAvailabilityChanged).toHaveBeenCalledWith(availability);
  });

  it("does not connect when disabled", () => {
    renderHook(() => useStaffEvents(false, {}));

    expect(RecordingEventSource.instances).toHaveLength(0);
  });
});

describe("useMyEvents", () => {
  it("connects to the account-scoped channel and fires approval handlers (T079/FR-004c)", () => {
    const onApprovalPending = vi.fn();
    const onApprovalDecided = vi.fn();
    renderHook(() => useMyEvents(true, { onApprovalPending, onApprovalDecided }));

    const source = RecordingEventSource.instances[0]!;
    expect(source.url).toBe("/api/my/events");

    const pending = { ticketId: "t1", approvalId: "ap1", description: "unlock account" };
    const decided = { ticketId: "t1", approvalId: "ap1", status: "expired" };
    source.emit("approval_pending", pending);
    source.emit("approval_decided", decided);

    expect(onApprovalPending).toHaveBeenCalledWith(pending);
    expect(onApprovalDecided).toHaveBeenCalledWith(decided);
  });

  it("does not connect when disabled", () => {
    renderHook(() => useMyEvents(false, {}));

    expect(RecordingEventSource.instances).toHaveLength(0);
  });
});
