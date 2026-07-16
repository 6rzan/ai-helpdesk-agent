import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyTicketsPage } from "../../src/pages/MyTicketsPage";

const listMyTickets = vi.fn();
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, listMyTickets: () => listMyTickets() };
});

describe("MyTicketsPage", () => {
  beforeEach(() => { listMyTickets.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("lists only the server-provided own tickets with their current handler", async () => {
    listMyTickets.mockResolvedValue({ tickets: [{ reference: "TCK-0001", category: "network", status: "in_progress", handlingMode: "human_involved", escalated: true, description: "Wi-Fi drops", createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:02:00.000Z", assigneeName: "Sam Support" }] });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    expect(await screen.findByText("TCK-0001")).toBeInTheDocument();
    expect(screen.getByText(/sam support is handling this/i)).toBeInTheDocument();
  });
});
