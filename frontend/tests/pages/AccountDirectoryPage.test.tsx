import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccountDirectoryPage } from "../../src/pages/staff/AccountDirectoryPage";
import type { AccountDirectoryEntry } from "../../src/lib/types";

const listStaffAccounts = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, listStaffAccounts: (term?: string) => listStaffAccounts(term) };
});

const ACCOUNTS: AccountDirectoryEntry[] = [
  { id: "a1", displayName: "Amina Yusuf", email: "amina@example.com", role: "user" },
  { id: "a2", displayName: "Brian Ochieng", email: "brian@example.com", role: "user" },
  { id: "a3", displayName: "Chidi Okafor", email: "chidi@example.com", role: "staff" },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountDirectoryPage />
    </MemoryRouter>,
  );
}

describe("AccountDirectoryPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listStaffAccounts.mockReset();
    listStaffAccounts.mockResolvedValue({ accounts: ACCOUNTS });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function loaded() {
    renderPage();
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Amina Yusuf");
  }

  it("AD-001: lists display name, email and role", async () => {
    await loaded();
    expect(screen.getByText("amina@example.com")).toBeInTheDocument();
    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(screen.getAllByText("Reporter").length).toBe(2);
  });

  it("AD-002: shows nothing else about an account", async () => {
    await loaded();
    const row = screen.getByText("Amina Yusuf").closest("a")!;
    expect(row.textContent).toBe("Amina Yusufamina@example.comReporter");
  });

  it("AD-003: narrows as the staff member types, with one request per pause", async () => {
    await loaded();
    listStaffAccounts.mockResolvedValue({ accounts: [ACCOUNTS[0]!] });

    const search = screen.getByLabelText(/search by name or email/i);
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.change(search, { target: { value: "am" } });
    fireEvent.change(search, { target: { value: "ami" } });
    await vi.advanceTimersByTimeAsync(300);

    // One request for the typed word, not one per keystroke.
    await waitFor(() => expect(listStaffAccounts).toHaveBeenCalledTimes(2));
    expect(listStaffAccounts).toHaveBeenLastCalledWith("ami");
    await waitFor(() => expect(screen.queryByText("Brian Ochieng")).toBeNull());
  });

  it("AD-004: names the term in a no-match state rather than showing an empty frame", async () => {
    await loaded();
    listStaffAccounts.mockResolvedValue({ accounts: [] });
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "dupont" },
    });
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByText(/No accounts match dupont/)).toBeInTheDocument();
    expect(screen.getByText(/try part of an email address/i)).toBeInTheDocument();
  });

  it("AD-005: the no-match line names the term that was searched, not what was typed after", async () => {
    await loaded();
    listStaffAccounts.mockResolvedValue({ accounts: [] });
    const search = screen.getByLabelText(/search by name or email/i);
    fireEvent.change(search, { target: { value: "dupont" } });
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText(/No accounts match dupont/);

    fireEvent.change(search, { target: { value: "duponte" } });
    // Before the next request settles, the line still names the term it reported on.
    expect(screen.getByText(/No accounts match dupont\./)).toBeInTheDocument();
  });

  it("AD-006: an empty directory reads differently from a search that found nothing", async () => {
    listStaffAccounts.mockResolvedValue({ accounts: [] });
    renderPage();
    await vi.advanceTimersByTimeAsync(300);
    expect(await screen.findByText(/There are no accounts yet/)).toBeInTheDocument();
  });

  it("AD-007: opens the selected account's profile directly", async () => {
    await loaded();
    expect(screen.getByText("Amina Yusuf").closest("a")?.getAttribute("href")).toBe(
      "/staff/users/a1/profile",
    );
  });

  it("AD-008: offers no bulk-selection affordance, including a disabled one", async () => {
    const { container } = renderPage();
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Amina Yusuf");

    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(0);
    expect(container.textContent).not.toMatch(/select all|bulk|selected/i);
  });

  it("AD-009: reports a failed load rather than showing an empty directory", async () => {
    listStaffAccounts.mockRejectedValue(new Error("Network unavailable"));
    renderPage();
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.queryByText(/There are no accounts yet/)).toBeNull();
  });

  it("AD-010: no rendered copy contains an em-dash", async () => {
    const { container } = renderPage();
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Amina Yusuf");
    expect(container.textContent).not.toContain("—");
  });
});
