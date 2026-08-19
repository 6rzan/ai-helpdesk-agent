import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RemediationControls } from "../../src/components/staff/RemediationControls";
import type { RemediationAvailability } from "../../src/lib/types";

// T095/Design Direction: the kill switch is asymmetric -- off is one click,
// on requires confirmation -- plus a persistent, non-dismissible banner
// while remediation is disabled (FR-008, FR-022).

function buildAvailability(overrides: Partial<RemediationAvailability> = {}): RemediationAvailability {
  return {
    globallyEnabled: true,
    endpoints: [
      { id: "test-node-a", label: "Test Node A", enabled: true, description: "General node" },
      { id: "test-node-b", label: "Test Node B", enabled: true, description: "Print node" },
    ],
    ...overrides,
  };
}

describe("RemediationControls", () => {
  it("turns remediation off in a single click, with no confirmation", () => {
    const onToggle = vi.fn();
    render(<RemediationControls availability={buildAvailability()} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /^turn off$/i }));
    expect(onToggle).toHaveBeenCalledWith({ scope: "global" }, false);
  });

  it("requires confirmation before turning remediation back on", () => {
    const onToggle = vi.fn();
    render(<RemediationControls availability={buildAvailability({ globallyEnabled: false })} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /^turn on$/i }));
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onToggle).toHaveBeenCalledWith({ scope: "global" }, true);
  });

  it("shows a persistent banner while remediation is disabled", () => {
    render(<RemediationControls availability={buildAvailability({ globallyEnabled: false })} onToggle={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/disabled/i);
  });

  it("shows no banner while remediation is enabled", () => {
    render(<RemediationControls availability={buildAvailability({ globallyEnabled: true })} onToggle={vi.fn()} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lets each endpoint be toggled independently", () => {
    const onToggle = vi.fn();
    render(<RemediationControls availability={buildAvailability()} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /turn off test node a/i }));
    expect(onToggle).toHaveBeenCalledWith({ scope: "endpoint", endpointId: "test-node-a" }, false);
  });
});
