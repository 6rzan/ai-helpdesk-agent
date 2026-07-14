import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../../src/services/api";
import { TicketDetailPage } from "../../src/pages/TicketDetailPage";
import type { Roster, StaffTicketDetail, SupportProfileView } from "../../src/lib/types";

const getStaffTicket = vi.fn();
const takeoverTicket = vi.fn();
const reassignTicket = vi.fn();
const getRoster = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    getStaffTicket: (...args: unknown[]) => getStaffTicket(...args),
    takeoverTicket: (...args: unknown[]) => takeoverTicket(...args),
    reassignTicket: (...args: unknown[]) => reassignTicket(...args),
    getRoster: (...args: unknown[]) => getRoster(...args),
    updateStaffTicketStatus: vi.fn(),
  };
});

function makeDetail(overrides: Partial<StaffTicketDetail> = {}): StaffTicketDetail {
  return {
    reference: "TCK-0001",
    category: "network",
    status: "in_progress",
    handlingMode: "human_involved",
    escalated: true,
    description: "Cannot connect to office wifi.",
    createdAt: "2026-07-13T09:00:00.000Z",
    escalationReason: null,
    classificationConfidence: 0.9,
    history: [],
    transcript: [],
    reporterAccountId: "acc1",
    assignee: null,
    assignmentHistory: [],
    profile: null,
    ...overrides,
  };
}

const PROFILE: SupportProfileView = {
  remoteAccessIds: [{ tool: "TeamViewer", id: "123 456 789" }],
  location: "Building B, Room 204",
  hardware: "Dell Latitude 7440",
  staffEntries: [],
};

const ROSTER: Roster = {
  staff: [
    { id: "s1", displayName: "Sam Support", availability: "available", openCaseCount: 2 },
    { id: "s2", displayName: "Nadia Ng", availability: "available", openCaseCount: 0 },
  ],
  suggestedAssigneeId: "s2",
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/staff/tickets/TCK-0001"]}>
      <Routes>
        <Route path="/staff/tickets/:reference" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TicketDetailPage assignment", () => {
  beforeEach(() => {
    getStaffTicket.mockReset();
    takeoverTicket.mockReset();
    reassignTicket.mockReset();
    getRoster.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes over an unassigned ticket and then shows the assignee", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ assignee: null }) });
    takeoverTicket.mockResolvedValue({
      ticket: makeDetail({ assignee: { accountId: "s1", displayName: "Sam Support", since: "2026-07-13T10:00:00.000Z" } }),
    });

    renderDetail();

    await screen.findByText("TCK-0001");
    fireEvent.click(screen.getByRole("button", { name: /take over/i }));

    await waitFor(() => expect(takeoverTicket).toHaveBeenCalledWith("TCK-0001"));
    expect(await screen.findByText("Sam Support")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reassign/i })).toBeInTheDocument();
  });

  it("shows a conflict message when the ticket was already taken (409)", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ assignee: null }) });
    takeoverTicket.mockRejectedValue(
      new ApiError(409, "ALREADY_ASSIGNED", "already assigned", {
        currentAssignee: { accountId: "s9", displayName: "Prior Holder" },
      }),
    );

    renderDetail();

    await screen.findByText("TCK-0001");
    fireEvent.click(screen.getByRole("button", { name: /take over/i }));

    expect(await screen.findByText(/prior holder is already handling this ticket/i)).toBeInTheDocument();
  });

  it("preselects the suggested assignee in the reassign picker and reassigns on confirm", async () => {
    getStaffTicket.mockResolvedValue({
      ticket: makeDetail({ assignee: { accountId: "s1", displayName: "Sam Support", since: "2026-07-13T10:00:00.000Z" } }),
    });
    getRoster.mockResolvedValue(ROSTER);
    reassignTicket.mockResolvedValue({
      ticket: makeDetail({ assignee: { accountId: "s2", displayName: "Nadia Ng", since: "2026-07-13T11:00:00.000Z" } }),
    });

    renderDetail();

    await screen.findByText("TCK-0001");
    fireEvent.click(screen.getByRole("button", { name: /reassign/i }));

    // Suggested assignee (Nadia, 0 open cases) is preselected once the roster loads.
    const suggested = await screen.findByRole("option", { name: /nadia ng/i });
    await waitFor(() => expect(suggested).toHaveAttribute("aria-selected", "true"));

    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() => expect(reassignTicket).toHaveBeenCalledWith("TCK-0001", "s2"));
  });

  it("surfaces the reporter profile when one is on file", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ profile: PROFILE }) });

    renderDetail();

    await screen.findByText("TCK-0001");
    expect(screen.getByText("Building B, Room 204")).toBeInTheDocument();
    expect(screen.getByText(/dell latitude 7440/i)).toBeInTheDocument();
  });

  it("shows an explicit no-profile state when none exists", async () => {
    getStaffTicket.mockResolvedValue({ ticket: makeDetail({ profile: null }) });

    renderDetail();

    await screen.findByText("TCK-0001");
    const panel = screen.getByRole("heading", { name: /reporter profile/i }).closest("section")!;
    expect(within(panel).getByText(/no profile on file/i)).toBeInTheDocument();
  });
});
