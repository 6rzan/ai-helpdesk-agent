import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionRecordCard } from "../../src/components/ActionRecordCard";
import type { ActionRecord } from "../../src/lib/types";

function buildRecord(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: "record-1",
    at: "2026-08-19T10:00:00.000Z",
    actor: "agent",
    ticketId: "ticket-1",
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

describe("ActionRecordCard", () => {
  it("renders the classified intent and outcome", () => {
    render(<ActionRecordCard record={buildRecord()} />);

    expect(screen.getByText("check service status")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });

  it("labels a read-only action distinctly from a state-changing one", () => {
    render(<ActionRecordCard record={buildRecord({ tier: "read_only" })} />);
    expect(screen.getByText("Read-only diagnostic")).toBeInTheDocument();

    render(<ActionRecordCard record={buildRecord({ tier: "state_changing" })} />);
    expect(screen.getByText("State-changing")).toBeInTheDocument();
  });

  it("shows the exact command as inert mono text", () => {
    render(<ActionRecordCard record={buildRecord()} />);

    const command = screen.getByText("sudo /usr/local/bin/service-status.sh widget-service");
    expect(command.tagName).toBe("P");
    expect(command.className).toMatch(/font-mono/);
  });

  it("keeps observed output collapsed by default and reveals it on demand", () => {
    render(<ActionRecordCard record={buildRecord({ observedOutput: "account is locked" })} />);

    expect(screen.queryByText("account is locked")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show output" }));

    expect(screen.getByText("account is locked")).toBeInTheDocument();
  });

  it("explains a refusal in plain language without implying an error", () => {
    render(
      <ActionRecordCard
        record={buildRecord({ outcome: "refused", refusalReason: "missing_consent", requestedAction: "service-status" })}
      />,
    );

    expect(screen.getByText("Refused")).toBeInTheDocument();
    expect(screen.getByText("The reporter had not given consent.")).toBeInTheDocument();
  });
});
