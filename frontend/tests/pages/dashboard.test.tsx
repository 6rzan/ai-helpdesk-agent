import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "../../src/pages/DashboardPage";
import { TicketDetailPage } from "../../src/pages/TicketDetailPage";
import type { StaffTicketDetail, StaffTicketRow } from "../../src/lib/types";

const listStaffTickets = vi.fn();
const getStaffTicket = vi.fn();
const updateStaffTicketStatus = vi.fn();
let staffHandlers: { onTicketUpdated?: (event: { reference: string }) => void } | undefined;

vi.mock("../../src/services/useEvents", () => ({ useStaffEvents: (_enabled: boolean, handlers: typeof staffHandlers) => { staffHandlers = handlers; } }));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    listStaffTickets: (...args: unknown[]) => listStaffTickets(...args),
    getStaffTicket: (...args: unknown[]) => getStaffTicket(...args),
    updateStaffTicketStatus: (...args: unknown[]) => updateStaffTicketStatus(...args),
  };
});

function makeRow(overrides: Partial<StaffTicketRow> = {}): StaffTicketRow {
  return {
    reference: "TCK-0001",
    category: "network",
    status: "open",
    handlingMode: "automated",
    escalated: false,
    description: "Cannot connect to office wifi.",
    reporter: "Alex Reporter",
    assignee: null,
    createdAt: "2026-07-13T09:00:00.000Z",
    updatedAt: "2026-07-13T09:00:00.000Z",
    ...overrides,
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    listStaffTickets.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the ticket list with reporter names once loaded", async () => {
    listStaffTickets.mockResolvedValue({
      tickets: [makeRow(), makeRow({ reference: "TCK-0002", reporter: null, description: "Printer jam." })],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await screen.findByText("TCK-0001");
    expect(screen.getByText("Alex Reporter")).toBeInTheDocument();
    expect(screen.getByText("TCK-0002")).toBeInTheDocument();
    // Legacy ticket without a linked account stays visible, marked as such (FR-014).
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
  });

  it("groups escalated tickets under an attention heading", async () => {
    listStaffTickets.mockResolvedValue({
      tickets: [
        makeRow({ reference: "TCK-0100", escalated: true, description: "Server down." }),
        makeRow({ reference: "TCK-0200", escalated: false }),
      ],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await screen.findByText("TCK-0100");
    expect(screen.getByText(/needs staff attention/i)).toBeInTheDocument();
  });

  it("passes the selected status filter to the API", async () => {
    listStaffTickets.mockResolvedValue({ tickets: [makeRow()] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText("TCK-0001");

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "resolved" } });

    await waitFor(() =>
      expect(listStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ status: "resolved" })),
    );
  });

  it("shows a teaching empty state when there are no tickets", async () => {
    listStaffTickets.mockResolvedValue({ tickets: [] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await screen.findByText(/no tickets match these filters/i);
  });

  it("links each row through to its detail page", async () => {
    listStaffTickets.mockResolvedValue({ tickets: [makeRow()] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", { name: "TCK-0001" });
    expect(link).toHaveAttribute("href", "/staff/tickets/TCK-0001");
  });
});

function makeDetail(overrides: Partial<StaffTicketDetail> = {}): StaffTicketDetail {
  return {
    reference: "TCK-0001",
    category: "network",
    status: "in_progress",
    handlingMode: "automated",
    escalated: false,
    description: "Cannot connect to office wifi.",
    createdAt: "2026-07-13T09:00:00.000Z",
    escalationReason: null,
    classificationConfidence: 0.91,
    history: [
      { at: "2026-07-13T09:05:00.000Z", field: "status", from: "open", to: "in_progress", actor: "staff" },
    ],
    transcript: [
      {
        _id: "m1",
        conversationId: "c1",
        author: "user",
        text: "my wifi keeps dropping",
        inputOrigin: "typed",
        sentAt: "2026-07-13T09:00:00.000Z",
      },
    ],
    reporterAccountId: "acc1",
    assignee: null,
    assignmentHistory: [],
    profile: null,
    ...overrides,
  };
}

function renderDetail(reference = "TCK-0001") {
  return render(
    <MemoryRouter initialEntries={[`/staff/tickets/${reference}`]}>
      <Routes>
        <Route path="/staff/tickets/:reference" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TicketDetailPage", () => {
  beforeEach(() => {
    getStaffTicket.mockReset();
    updateStaffTicketStatus.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows transcript, classification and history", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail() });

    renderDetail();

    await screen.findByText("TCK-0001");
    expect(screen.getByText(/my wifi keeps dropping/i)).toBeInTheDocument();
    expect(screen.getByText(/classification confidence: 91%/i)).toBeInTheDocument();
    expect(screen.getByText(/changed from/i)).toBeInTheDocument();
  });

  it("only offers status transitions the state machine allows", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ status: "in_progress" }) });

    renderDetail();

    await screen.findByText("TCK-0001");
    // in_progress -> resolved only
    expect(screen.getByRole("button", { name: /mark resolved/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark closed/i })).not.toBeInTheDocument();
  });

  it("renders handling and timestamp columns, then pulses an SSE-updated row", async () => {
    listStaffTickets.mockResolvedValue({ tickets: [makeRow({ escalated: true, handlingMode: "human_involved", createdAt: "2026-07-13T09:00:00.000Z", updatedAt: "2026-07-13T10:00:00.000Z" })] });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: "TCK-0001" });
    expect(screen.getByRole("columnheader", { name: "Handling" })).toBeInTheDocument(); expect(screen.getByRole("columnheader", { name: "Created" })).toBeInTheDocument(); expect(screen.getByRole("columnheader", { name: "Updated" })).toBeInTheDocument();
    expect(screen.getByText("human involved")).toBeInTheDocument(); expect(screen.getByText(/needs staff attention/i)).toBeInTheDocument();
    await act(async () => { staffHandlers?.onTicketUpdated?.({ reference: "TCK-0001" }); });
    expect(link.closest("tr")).toHaveClass("motion-safe:animate-pulse");
  });

  it("renders attributed staff actions and the complete assignment history", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({
      staffActions: [{ staffId: "s1", staffName: "Sam Support", action: "status_change", details: { status: "resolved", note: "User confirmed fix" }, at: "2026-07-13T10:00:00.000Z" }],
      assignmentHistory: [{ assigneeId: "s2", assigneeName: "Nadia Ng", byId: "s1", byName: "Sam Support", kind: "reassign", at: "2026-07-13T10:01:00.000Z" }],
    }) });
    renderDetail();
    await screen.findByText("TCK-0001");
    expect(screen.getAllByText(/sam support/i)).toHaveLength(2); expect(screen.getByText(/status: resolved, note: user confirmed fix/i)).toBeInTheDocument(); expect(screen.getByText(/nadia ng/i)).toBeInTheDocument(); expect(screen.getByText(/reassigned by sam support/i)).toBeInTheDocument();
  });

  it("applies a status change through the API and reflects it", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ status: "in_progress" }) });
    updateStaffTicketStatus.mockResolvedValue({ ticket: makeDetail({ status: "resolved" }) });

    renderDetail();

    await screen.findByText("TCK-0001");
    fireEvent.click(screen.getByRole("button", { name: /mark resolved/i }));

    await waitFor(() => expect(updateStaffTicketStatus).toHaveBeenCalledWith("TCK-0001", "resolved"));
    const statusPanel = screen.getByRole("heading", { name: "Status" }).closest("section")!;
    await within(statusPanel).findByText("Resolved");
  });
});
