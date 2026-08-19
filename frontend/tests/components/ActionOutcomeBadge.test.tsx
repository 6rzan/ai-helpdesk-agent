import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionOutcomeBadge, ApprovalStatusBadge } from "../../src/components/ActionOutcomeBadge";

describe("ActionOutcomeBadge", () => {
  it.each([
    ["succeeded", "Succeeded"],
    ["failed", "Failed"],
    ["timed_out", "Timed out"],
    ["attempted_unverified", "Attempted, unverified"],
    ["refused", "Refused"],
  ] as const)("renders the %s outcome as %s", (outcome, label) => {
    render(<ActionOutcomeBadge outcome={outcome} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("never renders a refusal in the failure colour", () => {
    render(<ActionOutcomeBadge outcome="refused" />);

    const badge = screen.getByText("Refused");
    expect(badge.className).not.toMatch(/text-red|bg-red/);
  });

  it("reserves the failure colour for an actually-failed execution", () => {
    render(<ActionOutcomeBadge outcome="failed" />);

    const badge = screen.getByText("Failed");
    expect(badge.className).toMatch(/text-red/);
  });
});

describe("ApprovalStatusBadge", () => {
  it.each([
    ["pending", "Pending approval"],
    ["approved", "Approved"],
    ["declined", "Declined"],
    ["expired", "Expired"],
    ["no_longer_applicable", "No longer applicable"],
  ] as const)("renders the %s status as %s", (status, label) => {
    render(<ApprovalStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("never renders a decline in the failure colour", () => {
    render(<ApprovalStatusBadge status="declined" />);

    const badge = screen.getByText("Declined");
    expect(badge.className).not.toMatch(/text-red|bg-red/);
  });
});
