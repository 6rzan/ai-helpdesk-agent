import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketTimeline } from "../../src/components/TicketTimeline";
import type { ActionRecord, StaffTicketDetail } from "../../src/lib/types";

// T097: action records interleave into the existing timeline as their own
// section, alongside history, staff activity, assignment history, and guided
// troubleshooting -- no second timeline, no duplicated staff-action entry
// (US4 AS3, FR-010).

function buildActionRecord(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: "record-1",
    at: "2026-08-19T10:00:00.000Z",
    actor: "agent",
    ticketId: "TICK-0001",
    classifiedIntent: "check service status",
    policyEntryId: "service-status",
    tier: "read_only",
    requestedAction: "sudo /usr/local/bin/service-status.sh widget-service",
    arguments: { service: "widget-service" },
    endpointId: "test-node-a",
    endpointLabel: "Test Node A",
    authorisation: { consent: null, approval: null },
    outcome: "succeeded",
    refusalReason: null,
    observedOutput: null,
    verification: null,
    durationMs: 120,
    ...overrides,
  };
}

function buildTicket(overrides: Partial<StaffTicketDetail> = {}): StaffTicketDetail {
  return {
    reference: "TICK-0001",
    category: "network",
    status: "open",
    handlingMode: "automated",
    escalated: false,
    description: "vpn keeps dropping",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
    escalationReason: null,
    classificationConfidence: 0.9,
    history: [],
    transcript: [],
    reporterAccountId: null,
    assignee: null,
    assignmentHistory: [],
    profile: null,
    ...overrides,
  } as StaffTicketDetail;
}

describe("TicketTimeline", () => {
  it("renders an Automated actions section with each action record", () => {
    render(
      <TicketTimeline
        ticket={buildTicket({
          actions: [buildActionRecord(), buildActionRecord({ id: "record-2", outcome: "refused", refusalReason: "missing_consent" })],
        })}
      />,
    );

    expect(screen.getByText("Automated actions")).toBeInTheDocument();
    expect(screen.getAllByText("check service status")).toHaveLength(2);
  });

  it("shows a plain empty state when the agent has attempted no actions", () => {
    render(<TicketTimeline ticket={buildTicket({ actions: [] })} />);
    expect(screen.getByText(/has not attempted any actions/i)).toBeInTheDocument();
  });

  it("does not duplicate action records into the staff activity section", () => {
    render(
      <TicketTimeline
        ticket={buildTicket({
          actions: [buildActionRecord()],
          staffActions: [
            { action: "takeover", staffId: "s1", staffName: "Sam Support", details: {}, at: "2026-08-19T09:30:00.000Z" },
          ],
        })}
      />,
    );

    // Staff activity lists only the staff action, not the agent's action record.
    const staffSection = screen.getByText("Staff activity").closest("section")!;
    expect(staffSection.textContent).toContain("Sam Support");
    expect(staffSection.textContent).not.toContain("check service status");
  });
});
