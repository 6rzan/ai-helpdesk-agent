import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditTrail } from "../../src/components/staff/AuditTrail";
import type { ActionRecord } from "../../src/lib/types";

// T087/Design Direction: the audit view is append-only made visible, not
// merely true -- no edit, delete, or overflow affordance anywhere, including
// disabled ones (US4 AS5).

function buildRecord(overrides: Partial<ActionRecord> = {}): ActionRecord {
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

describe("AuditTrail", () => {
  it("renders every action record passed to it", () => {
    render(
      <AuditTrail
        records={[
          buildRecord(),
          buildRecord({ id: "record-2", classifiedIntent: "clear the print queue", outcome: "refused", refusalReason: "missing_consent" }),
        ]}
        filters={{}}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(screen.getByText("check service status")).toBeInTheDocument();
    expect(screen.getByText("clear the print queue")).toBeInTheDocument();
    // "Succeeded"/"Refused" also appear as filter <option> labels, so scope
    // to the badge itself rather than any text match.
    expect(screen.getAllByText("Succeeded").some((el) => el.tagName === "SPAN")).toBe(true);
    expect(screen.getAllByText("Refused").some((el) => el.tagName === "SPAN")).toBe(true);
  });

  it("renders no edit, delete, or overflow affordance anywhere, including disabled ones", () => {
    render(<AuditTrail records={[buildRecord()]} filters={{}} onFiltersChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /more|options|\.\.\./i })).toBeNull();
    // Not even a disabled one -- the absence itself is the requirement.
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.getAttribute("aria-label") ?? button.textContent ?? "").not.toMatch(/edit|delete|more options/i);
    }
  });

  it("exposes ticket, endpoint, and outcome filters", () => {
    render(<AuditTrail records={[]} filters={{}} onFiltersChange={vi.fn()} />);

    expect(screen.getByLabelText(/ticket/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/endpoint/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/outcome/i)).toBeInTheDocument();
  });

  it("shows a plain empty state when there are no records", () => {
    render(<AuditTrail records={[]} filters={{}} onFiltersChange={vi.fn()} />);
    expect(screen.getByText(/no actions/i)).toBeInTheDocument();
  });
});
