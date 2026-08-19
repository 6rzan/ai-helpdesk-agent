import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalQueue } from "../../src/components/staff/ApprovalQueue";
import type { ApprovalRequest } from "../../src/lib/types";

// T088/Design Direction: each row shows ticket, exact action, target
// endpoint, reporter consent, and age; approve requires a confirmation step
// restating the command and target; decline is never styled as destructive
// (declining is a routine outcome, not an error).

function buildApproval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "approval-1",
    ticketReference: "TICK-0001",
    policyEntryId: "unlock-account",
    description: "unlock the account for test-user-locked",
    command: "sudo /usr/local/bin/unlock-account.sh test-user-locked",
    arguments: { username: "test-user-locked" },
    endpointId: "test-node-a",
    endpointLabel: "Test Node A",
    consent: { given: true, byAccountId: "account-1", at: "2026-08-19T09:00:00.000Z", messageId: "message-1" },
    status: "pending",
    raisedAt: "2026-08-19T09:00:00.000Z",
    expiresAt: "2026-08-19T09:30:00.000Z",
    decidedBy: null,
    decidedAt: null,
    closureReason: null,
    ...overrides,
  };
}

describe("ApprovalQueue", () => {
  it("shows ticket, exact action, target endpoint, reporter consent, and age for each row", () => {
    render(<ApprovalQueue approvals={[buildApproval()]} onApprove={vi.fn()} onDecline={vi.fn()} />);

    expect(screen.getByText("TICK-0001")).toBeInTheDocument();
    expect(screen.getByText("sudo /usr/local/bin/unlock-account.sh test-user-locked")).toBeInTheDocument();
    expect(screen.getByText(/Test Node A/)).toBeInTheDocument();
    expect(screen.getByText(/reporter consented/i)).toBeInTheDocument();
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("requires a confirmation step before approving, restating the command and target", () => {
    const onApprove = vi.fn();
    render(<ApprovalQueue approvals={[buildApproval()]} onApprove={onApprove} onDecline={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onApprove).not.toHaveBeenCalled();

    // The confirmation restates the exact command and the target endpoint.
    const confirmDialog = screen.getByRole("region", { name: /confirm approval/i });
    expect(confirmDialog).toHaveTextContent("sudo /usr/local/bin/unlock-account.sh test-user-locked");
    expect(confirmDialog).toHaveTextContent("Test Node A");

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onApprove).toHaveBeenCalledWith("approval-1");
  });

  it("declines immediately without a confirmation step, and never styles decline as destructive", () => {
    const onDecline = vi.fn();
    render(<ApprovalQueue approvals={[buildApproval()]} onApprove={vi.fn()} onDecline={onDecline} />);

    const declineButton = screen.getByRole("button", { name: /decline/i });
    expect(declineButton.className).not.toMatch(/bg-red|text-red|border-red/);

    fireEvent.click(declineButton);
    expect(onDecline).toHaveBeenCalledWith("approval-1", undefined);
  });

  it("renders a designed empty state that reads as a good outcome", () => {
    render(<ApprovalQueue approvals={[]} onApprove={vi.fn()} onDecline={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /^approve$/i })).toBeNull();
    expect(screen.getByText(/nothing (is )?waiting/i)).toBeInTheDocument();
  });
});
