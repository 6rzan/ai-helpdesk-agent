import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConsentBlock } from "../../src/components/ConsentBlock";
import type { ActionProposal } from "../../src/lib/types";

// T037: the consent block is a distinct affordance (Design Direction) — it
// must not be rendered as a QuickReplies pill, since granting it authorises
// an actual action against a real (test) endpoint, unlike a quick reply.

const PROPOSAL: ActionProposal = {
  ticketId: "TKT-0001",
  proposalId: "proposal-1",
  tier: "read_only",
  description: "check the widget service's status",
  endpointLabel: "Test Node A",
};

describe("ConsentBlock", () => {
  it("states in plain words what will run, against what, and that it is a test system", () => {
    render(<ConsentBlock proposal={PROPOSAL} onDecide={vi.fn()} />);

    expect(screen.getByText(/check the widget service's status/)).toBeInTheDocument();
    expect(screen.getByText(/Test Node A/)).toBeInTheDocument();
    expect(screen.getByText(/test system/i)).toBeInTheDocument();
  });

  it("is a distinct affordance, not rendered as a QuickReplies pill", () => {
    render(<ConsentBlock proposal={PROPOSAL} onDecide={vi.fn()} />);

    // QuickReplies renders role="group" aria-label="Quick replies" with
    // rounded-full pill buttons — the consent block must diverge from both.
    expect(screen.queryByRole("group", { name: /quick replies/i })).toBeNull();

    const grantButton = screen.getByRole("button", { name: /yes, go ahead/i });
    const declineButton = screen.getByRole("button", { name: /no, don't/i });
    expect(grantButton.className).not.toMatch(/rounded-full/);
    expect(declineButton.className).not.toMatch(/rounded-full/);
  });

  it("calls onDecide(true) on grant and onDecide(false) on decline", () => {
    const onDecide = vi.fn();
    render(<ConsentBlock proposal={PROPOSAL} onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: /yes, go ahead/i }));
    expect(onDecide).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /no, don't/i }));
    expect(onDecide).toHaveBeenCalledWith(false);
  });

  it("disables both actions while a decision is in flight, with no optimistic outcome shown", () => {
    render(<ConsentBlock proposal={PROPOSAL} onDecide={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: /yes, go ahead/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /no, don't/i })).toBeDisabled();
    // No "running"/"done" wording appears — outcome only ever arrives via
    // the server's own reply (Design Direction: no optimistic state).
    expect(screen.queryByText(/running|done|succeeded|failed/i)).toBeNull();
  });
});
