import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MyTicketDetailPage, MyTicketsPage } from "../../src/pages/MyTicketsPage";

const listMyTickets = vi.fn();
const getMyTicket = vi.fn(); let refreshDetail: (() => void) | undefined;
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, listMyTickets: () => listMyTickets(), getMyTicket: (reference: string) => getMyTicket(reference) };
});
vi.mock("../../src/services/useEvents", () => ({ useMyTicketEvents: (_enabled: boolean, callback: () => void) => { refreshDetail = callback; } }));

describe("MyTicketsPage", () => {
  beforeEach(() => { listMyTickets.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("lists only the server-provided own tickets with their current handler", async () => {
    listMyTickets.mockResolvedValue({ tickets: [{ reference: "TCK-0001", category: "network", status: "in_progress", handlingMode: "human_involved", escalated: true, description: "Wi-Fi drops", createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:02:00.000Z", assigneeName: "Sam Support" }] });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    expect(await screen.findByText("TCK-0001")).toBeInTheDocument();
    expect(screen.getByText(/sam support is handling this/i)).toBeInTheDocument();
  });
  it("refreshes the authenticated owner detail immediately after an account-scoped ticket event", async () => {
    getMyTicket.mockResolvedValueOnce({ ticket: { reference: "TCK-0001", category: "network", status: "open", handlingMode: "automated", escalated: false, description: "Wi-Fi drops", createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:02:00.000Z", assigneeName: null, history: [] } })
      .mockResolvedValueOnce({ ticket: { reference: "TCK-0001", category: "network", status: "in_progress", handlingMode: "human_involved", escalated: false, description: "Wi-Fi drops", createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:03:00.000Z", assigneeName: "Sam Support", history: [] } });
    render(<MemoryRouter initialEntries={["/tickets/TCK-0001"]}><Routes><Route path="/tickets/:reference" element={<MyTicketDetailPage />} /></Routes></MemoryRouter>);
    await screen.findByText("Awaiting assignment"); await act(async () => { refreshDetail?.(); });
    await waitFor(() => expect(screen.getByText("Sam Support")).toBeInTheDocument()); expect(screen.getByText("in progress")).toBeInTheDocument();
  });
});
