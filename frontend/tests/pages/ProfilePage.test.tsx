import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfilePage } from "../../src/pages/ProfilePage";

const getMyProfile = vi.fn();
const updateMyProfile = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, getMyProfile: () => getMyProfile(), updateMyProfile: (input: unknown) => updateMyProfile(input) };
});

describe("ProfilePage", () => {
  beforeEach(() => { getMyProfile.mockReset(); updateMyProfile.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("saves support-relevant fields and renders attributed staff entries", async () => {
    getMyProfile.mockResolvedValue({ profile: { remoteAccessIds: [], location: "", hardware: "", staffEntries: [{ kind: "note", field: null, value: "Please call before connecting.", staffId: "s1", staffName: "Sam", at: "2026-07-15T10:00:00.000Z" }] } });
    updateMyProfile.mockResolvedValue({ profile: { remoteAccessIds: [{ tool: "Remote access", id: "123" }], location: "Lab 3", hardware: "Dell", staffEntries: [{ kind: "note", field: null, value: "Please call before connecting.", staffId: "s1", staffName: "Sam", at: "2026-07-15T10:00:00.000Z" }] } });
    render(<ProfilePage />);

    await screen.findByText(/please call before connecting/i);
    fireEvent.change(screen.getByLabelText(/remote access id/i), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^location/i), { target: { value: "Lab 3" } });
    fireEvent.change(screen.getByLabelText(/device or asset/i), { target: { value: "Dell" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith({ remoteAccessIds: [{ tool: "Remote access", id: "123" }], location: "Lab 3", hardware: "Dell" }));
    expect(screen.getByText(/note by sam/i)).toBeInTheDocument();
  });
});
