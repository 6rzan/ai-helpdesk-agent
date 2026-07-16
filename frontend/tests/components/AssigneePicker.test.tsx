import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssigneePicker } from "../../src/components/AssigneePicker";

const getRoster = vi.fn();
vi.mock("../../src/services/api", () => ({ getRoster: () => getRoster() }));

describe("AssigneePicker", () => {
  it("makes availability, workload, suggestion, and manual assignment accessible", async () => {
    getRoster.mockResolvedValue({ suggestedAssigneeId: "busy", staff: [
      { id: "available", displayName: "Aisha Available", availability: "available", openCaseCount: 1 },
      { id: "busy", displayName: "Ben Busy", availability: "busy", openCaseCount: 3 },
      { id: "away", displayName: "Cara Away", availability: "away", openCaseCount: 0 },
    ] });
    const onAssign = vi.fn().mockResolvedValue(undefined);
    render(<AssigneePicker label="Reassign" onAssign={onAssign} />);
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    await screen.findByText("Aisha Available");
    expect(screen.getByText("Available")).toBeInTheDocument(); expect(screen.getByText("Busy")).toBeInTheDocument(); expect(screen.getByText("Away")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument(); expect(screen.getByText("Suggested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" })); await waitFor(() => expect(onAssign).toHaveBeenCalledWith("busy"));
  });

  it("warns when nobody is available without preventing manual choice", async () => {
    getRoster.mockResolvedValue({ suggestedAssigneeId: null, staff: [{ id: "away", displayName: "Cara Away", availability: "away", openCaseCount: 0 }] });
    render(<AssigneePicker label="Reassign" onAssign={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    expect(await screen.findByText(/no staff member is currently available/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /cara away/i })); expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });
});
