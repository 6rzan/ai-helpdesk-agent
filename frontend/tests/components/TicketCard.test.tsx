import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketCard } from "../../src/components/TicketCard";
import type { TicketSummary } from "../../src/lib/types";

const baseTicket: TicketSummary = {
  reference: "HD-0001",
  category: "printer",
  status: "open",
  handlingMode: "automated",
  escalated: false,
  description: "The printer on the 3rd floor is jammed",
  createdAt: "2026-07-01T10:00:00.000Z",
};

describe("TicketCard", () => {
  it("renders the ticket reference, category, description, and status", () => {
    render(<TicketCard ticket={baseTicket} />);

    expect(screen.getByText("HD-0001")).toBeInTheDocument();
    expect(screen.getByText("Printer")).toBeInTheDocument();
    expect(screen.getByText("The printer on the 3rd floor is jammed")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("mentions the ticket reference in the saved-report footer", () => {
    render(<TicketCard ticket={baseTicket} />);

    expect(screen.getByText(/quote this reference any time/i)).toHaveTextContent("HD-0001");
  });

  it("shows the handling-mode badge when escalated to staff", () => {
    render(<TicketCard ticket={{ ...baseTicket, handlingMode: "human_involved" }} />);

    expect(screen.getByText("With IT staff")).toBeInTheDocument();
  });

  it("renders the category label for each known issue category", () => {
    render(<TicketCard ticket={{ ...baseTicket, category: "password_login" }} />);

    expect(screen.getByText("Password & Login")).toBeInTheDocument();
  });
});
