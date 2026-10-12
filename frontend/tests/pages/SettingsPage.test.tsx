import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "../../src/pages/SettingsPage";
import { AuthProvider } from "../../src/context/AuthContext";
import type { Account } from "../../src/lib/types";

const getMe = vi.fn();
const changePassword = vi.fn();
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, getMe: (...args: unknown[]) => getMe(...args), changePassword: (input: unknown) => changePassword(input) };
});

const USER: Account = { id: "u1", email: "alex@example.com", displayName: "Alex", role: "user", usingInitialPassword: false };

function renderSettings() {
  return render(
    <AuthProvider>
      <SettingsPage />
    </AuthProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => { getMe.mockReset(); changePassword.mockReset(); getMe.mockResolvedValue(USER); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("shows an inline error when a password update fails", async () => {
    changePassword.mockRejectedValue(new Error("Current password is incorrect."));
    renderSettings();
    await screen.findByRole("heading", { name: /settings/i });
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: "wrong-password", newPassword: "new-password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/current password is incorrect/i);
  });

  it("shows a forced-change banner for an account still on its initial password", async () => {
    getMe.mockResolvedValue({ ...USER, usingInitialPassword: true });
    renderSettings();
    expect(await screen.findByRole("alert")).toHaveTextContent(/initial password/i);
  });

  it("does not show the forced-change banner once the password is not initial", async () => {
    renderSettings();
    await screen.findByRole("heading", { name: /settings/i });
    expect(screen.queryByText(/initial password/i)).not.toBeInTheDocument();
  });
});
