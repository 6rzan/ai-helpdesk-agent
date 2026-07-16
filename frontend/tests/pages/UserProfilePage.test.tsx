import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserProfilePage } from "../../src/pages/staff/UserProfilePage";

const getStaffUserProfile = vi.fn();
const getStaffCredentialStatus = vi.fn();
const appendStaffProfileEntry = vi.fn();
const resetStaffCredentials = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    getStaffUserProfile: (...args: unknown[]) => getStaffUserProfile(...args),
    getStaffCredentialStatus: (...args: unknown[]) => getStaffCredentialStatus(...args),
    appendStaffProfileEntry: (...args: unknown[]) => appendStaffProfileEntry(...args),
    resetStaffCredentials: (...args: unknown[]) => resetStaffCredentials(...args),
  };
});

const PROFILE = { remoteAccessIds: [{ tool: "TeamViewer", id: "123" }], location: "Lab 3", hardware: "Dell", staffEntries: [] };

function renderPage() {
  return render(<MemoryRouter initialEntries={["/staff/users/u1/profile"]}><Routes><Route path="/staff/users/:accountId/profile" element={<UserProfilePage />} /></Routes></MemoryRouter>);
}

describe("UserProfilePage", () => {
  beforeEach(() => {
    getStaffUserProfile.mockReset(); getStaffCredentialStatus.mockReset(); appendStaffProfileEntry.mockReset(); resetStaffCredentials.mockReset();
    getStaffUserProfile.mockResolvedValue({ profile: PROFILE }); getStaffCredentialStatus.mockResolvedValue({ usingInitialPassword: false });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("adds an attributed correction without changing the visible user value", async () => {
    appendStaffProfileEntry.mockResolvedValue({ profile: { ...PROFILE, staffEntries: [{ kind: "correction", field: "location", value: "Asset record says Lab 4", staffId: "s1", staffName: "Sam", at: "2026-07-15T10:00:00.000Z" }] } });
    renderPage();
    await screen.findByText("Lab 3");
    fireEvent.change(screen.getByLabelText(/entry type/i), { target: { value: "correction" } });
    fireEvent.change(screen.getByLabelText(/^entry$/i), { target: { value: "Asset record says Lab 4" } });
    fireEvent.click(screen.getByRole("button", { name: /add attributed entry/i }));
    await waitFor(() => expect(appendStaffProfileEntry).toHaveBeenCalledWith("u1", { kind: "correction", field: "location", value: "Asset record says Lab 4" }));
    expect(screen.getByText(/asset record says lab 4/i)).toBeInTheDocument();
  });

  it("requires inline confirmation before re-issuing a password", async () => {
    resetStaffCredentials.mockResolvedValue({ usingInitialPassword: true });
    renderPage();
    await screen.findByText("Lab 3");
    fireEvent.change(screen.getByLabelText(/new initial password/i), { target: { value: "new-password" } });
    const button = screen.getByRole("button", { name: /re-issue initial password/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/i confirm this will invalidate/i));
    fireEvent.click(button);
    await waitFor(() => expect(resetStaffCredentials).toHaveBeenCalledWith("u1", "new-password"));
    expect(await screen.findByText(/existing sessions were invalidated/i)).toBeInTheDocument();
  });
});
