import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "../../src/pages/SettingsPage";

const changePassword = vi.fn();
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, changePassword: (input: unknown) => changePassword(input) };
});

describe("SettingsPage", () => {
  beforeEach(() => { changePassword.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("shows an inline error when a password update fails", async () => {
    changePassword.mockRejectedValue(new Error("Current password is incorrect."));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: "wrong-password", newPassword: "new-password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/current password is incorrect/i);
  });
});
