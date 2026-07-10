import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../../src/components/StatusBadge";

describe("StatusBadge", () => {
  it("renders the status label", () => {
    render(<StatusBadge status="in_progress" handlingMode="automated" />);

    expect(screen.getByText("Being worked on")).toBeInTheDocument();
  });

  it("shows no handling-mode badge when automated", () => {
    render(<StatusBadge status="open" handlingMode="automated" />);

    expect(screen.queryByText("Waiting on you")).toBeNull();
    expect(screen.queryByText("With IT staff")).toBeNull();
  });

  it("shows the handling-mode badge when waiting on the user", () => {
    render(<StatusBadge status="open" handlingMode="waiting_on_user" />);

    expect(screen.getByText("Waiting on you")).toBeInTheDocument();
  });

  it("shows the handling-mode badge when escalated to staff", () => {
    render(<StatusBadge status="open" handlingMode="human_involved" />);

    expect(screen.getByText("With IT staff")).toBeInTheDocument();
  });

  it.each([
    ["open", "Open"],
    ["in_progress", "Being worked on"],
    ["resolved", "Resolved"],
    ["closed", "Closed"],
  ] as const)("renders the %s status as %s", (status, label) => {
    render(<StatusBadge status={status} handlingMode="automated" />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
