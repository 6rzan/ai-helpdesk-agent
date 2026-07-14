import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import { RequireAuth, RequireStaff } from "../../src/components/RouteGuards";
import { LoginPage } from "../../src/pages/LoginPage";
import { RegisterPage } from "../../src/pages/RegisterPage";
import type { Account } from "../../src/lib/types";

const getMe = vi.fn();
const login = vi.fn();
const register = vi.fn();
const logout = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    getMe: (...args: unknown[]) => getMe(...args),
    login: (...args: unknown[]) => login(...args),
    register: (...args: unknown[]) => register(...args),
    logout: (...args: unknown[]) => logout(...args),
  };
});

const USER: Account = { id: "u1", email: "alex@example.com", displayName: "Alex", role: "user", usingInitialPassword: false };
const STAFF: Account = { id: "s1", email: "sam@it.example.com", displayName: "Sam", role: "staff", availability: "available", usingInitialPassword: false };

function renderApp(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>Chat home</div>} />
          </Route>
          <Route element={<RequireStaff />}>
            <Route path="/staff" element={<div>Staff area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("auth pages and route guards", () => {
  beforeEach(() => {
    getMe.mockReset();
    login.mockReset();
    register.mockReset();
    logout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects an unauthenticated visitor from a protected route to /login", async () => {
    getMe.mockRejectedValue(new Error("unauthenticated"));
    renderApp("/");
    await screen.findByRole("heading", { name: /sign in/i });
    expect(screen.queryByText(/chat home/i)).not.toBeInTheDocument();
  });

  it("signs in through the login form and lands on the protected home", async () => {
    getMe.mockRejectedValue(new Error("unauthenticated"));
    login.mockResolvedValue(USER);
    renderApp("/login");
    await screen.findByRole("heading", { name: /sign in/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter2pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: "alex@example.com", password: "hunter2pass" }));
    await screen.findByText(/chat home/i);
  });

  it("shows a plain-language error when sign-in fails", async () => {
    getMe.mockRejectedValue(new Error("unauthenticated"));
    login.mockRejectedValue(new Error("Email or password is incorrect."));
    renderApp("/login");
    await screen.findByRole("heading", { name: /sign in/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrongpass1" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByText(/email or password is incorrect/i);
    expect(screen.queryByText(/chat home/i)).not.toBeInTheDocument();
  });

  it("registers a new account and lands on the protected home", async () => {
    getMe.mockRejectedValue(new Error("unauthenticated"));
    register.mockResolvedValue(USER);
    renderApp("/register");
    await screen.findByRole("heading", { name: /create an account/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter2pass" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({ email: "alex@example.com", displayName: "Alex", password: "hunter2pass" }),
    );
    await screen.findByText(/chat home/i);
  });

  it("blocks a signed-in non-staff user from the staff area", async () => {
    getMe.mockResolvedValue(USER);
    renderApp("/staff");
    await screen.findByText(/only available to it staff/i);
    expect(screen.queryByText(/staff area/i)).not.toBeInTheDocument();
  });

  it("lets a staff account into the staff area", async () => {
    getMe.mockResolvedValue(STAFF);
    renderApp("/staff");
    await screen.findByText(/staff area/i);
  });
});
