import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "../../src/components/AppNav";
import type { Account } from "../../src/lib/types";

// T021 (007). FR-015 says the maintainer console is reachable only by knowing its URL:
// no link, no menu entry, nothing discoverable from inside the application. That is a
// claim about what the navigation does NOT contain, so it needs a test that fails if
// someone later adds the link "for convenience".

let currentAccount: Account | null = null;

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    account: currentAccount,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function accountWith(role: Account["role"]): Account {
  return {
    id: "account-1",
    displayName: role === "staff" ? "Sam Staff" : "Alex Chen",
    email: `${role}@example.test`,
    role,
  } as Account;
}

function renderNav() {
  return render(
    <MemoryRouter>
      <AppNav />
    </MemoryRouter>,
  );
}

/** Everything that would make the console discoverable from inside the app. */
function assertNoMaintainerAffordance(container: HTMLElement) {
  expect(container.textContent ?? "").not.toMatch(/maintainer/i);
  expect(container.textContent ?? "").not.toMatch(/admin/i);
  for (const link of Array.from(container.querySelectorAll("a"))) {
    expect(link.getAttribute("href") ?? "").not.toContain("maintainer");
  }
}

afterEach(() => {
  currentAccount = null;
});

describe("AppNav — no maintainer affordance (007 FR-015)", () => {
  it("AN-001: signed out, the nav offers no route to the console", () => {
    const { container } = renderNav();
    expect(screen.getByText("Sign in")).toBeTruthy();
    assertNoMaintainerAffordance(container);
  });

  it("AN-002: as a reporter, the nav offers no route to the console", () => {
    currentAccount = accountWith("user");
    const { container } = renderNav();
    expect(screen.getByText("My tickets")).toBeTruthy();
    assertNoMaintainerAffordance(container);
  });

  it("AN-003: as staff, the nav offers no route to the console", () => {
    // The one most likely to be added by mistake: staff are the closest thing the
    // application has to an administrator, and they still must not see it. The console
    // is not a higher staff tier, it is a different axis entirely (Principle III).
    currentAccount = accountWith("staff");
    const { container } = renderNav();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    assertNoMaintainerAffordance(container);
  });

  it("AN-004: the console route is mounted outside AppLayout, so AppNav never renders inside it", async () => {
    // Structural rather than behavioural: if the route were nested under the layout,
    // the nav would render above the console even with no link pointing at it.
    const source = (await import("../../src/App.tsx?raw")) as unknown as { default: string };
    const text = source.default;

    const maintainerRoute = text.indexOf('path="/maintainer"');
    const layoutRoute = text.indexOf("<Route element={<AppLayout />}>");
    expect(maintainerRoute).toBeGreaterThan(-1);
    expect(layoutRoute).toBeGreaterThan(-1);
    // The maintainer route opens and closes before the layout route begins, so it
    // cannot be one of its children.
    expect(maintainerRoute).toBeLessThan(layoutRoute);
  });
});
