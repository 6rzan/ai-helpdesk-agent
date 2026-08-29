import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryListPage } from "../../src/pages/maintainer/CategoryListPage";
import type { MaintainerCategory } from "../../src/lib/maintainerTypes";

// T019 (007). FR-006 to FR-012.
//
// Two claims here are about what is NOT rendered — no retire control on a mandated
// category, no revert control in the version history — and one is about *when* a
// message appears: a bad slug must be reported before the request, not after it.

const CREDENTIALS = { key: "maintainer-key", name: "Jordan" };

function category(overrides: Partial<MaintainerCategory> = {}): MaintainerCategory {
  return {
    name: "printer",
    displayName: "Printer",
    classificationDescription: "Printing, scanning, and paper jams.",
    mandated: false,
    retired: false,
    activeGuideVersion: 3,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(categories: MaintainerCategory[]) {
  fetchMock.mockResolvedValue(jsonResponse({ categories }));
}

function renderList(categories: MaintainerCategory[]) {
  respondWith(categories);
  const onActionError = vi.fn().mockReturnValue(false);
  const result = render(
    <CategoryListPage credentials={CREDENTIALS} onActionError={onActionError} />,
  );
  return { ...result, onActionError };
}

/** The row a category is rendered in, found by its machine name. */
function rowFor(name: string): HTMLElement {
  const slug = screen.getByText(name, { selector: "span" });
  const row = slug.closest("li");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CategoryListPage — the list (FR-006)", () => {
  it("CL-001: shows display name, machine name, description, and active guide version", async () => {
    renderList([category()]);
    const row = await waitFor(() => rowFor("printer"));

    expect(within(row).getByText("Printer")).toBeTruthy();
    expect(within(row).getByText("printer")).toBeTruthy();
    expect(within(row).getByText(/paper jams/i)).toBeTruthy();
    expect(within(row).getByText(/version 3/i)).toBeTruthy();
  });

  it("CL-002: says so plainly when a category has no guide yet", async () => {
    renderList([category({ activeGuideVersion: null })]);
    const row = await waitFor(() => rowFor("printer"));
    expect(within(row).getByText(/no guide published yet/i)).toBeTruthy();
  });

  it("CL-003: a retired category stays visible and is marked retired", async () => {
    // Hiding it would leave a maintainer recreating a category that already exists and
    // being refused for a duplicate machine name they cannot see.
    renderList([category({ name: "fax", displayName: "Fax", retired: true })]);
    const row = await waitFor(() => rowFor("fax"));
    expect(within(row).getByText(/retired/i)).toBeTruthy();
  });
});

describe("CategoryListPage — retire (FR-012)", () => {
  it("CL-004: a mandated category has no retire control at all — absent, not disabled", async () => {
    renderList([category({ name: "email", displayName: "Email", mandated: true })]);
    const row = await waitFor(() => rowFor("email"));

    expect(within(row).queryByRole("button", { name: /retire/i })).toBeNull();
    // A greyed control would invite a click and then explain itself, which is a worse
    // answer than never offering the action.
    const disabled = within(row)
      .queryAllByRole("button")
      .filter((button) => (button as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(0);
  });

  it("CL-005: a non-mandated category offers retire", async () => {
    renderList([category()]);
    const row = await waitFor(() => rowFor("printer"));
    expect(within(row).getByRole("button", { name: /retire/i })).toBeTruthy();
  });

  it("CL-006: an already retired category offers no retire control", async () => {
    renderList([category({ name: "fax", displayName: "Fax", retired: true })]);
    const row = await waitFor(() => rowFor("fax"));
    expect(within(row).queryByRole("button", { name: /retire/i })).toBeNull();
  });

  it("CL-007: the confirmation states the consequence before it is confirmed", async () => {
    renderList([category()]);
    const row = await waitFor(() => rowFor("printer"));
    fireEvent.click(within(row).getByRole("button", { name: /retire/i }));

    const heading = await screen.findByText(/retire printer\?/i);
    const panel = heading.closest("section");
    expect(panel).not.toBeNull();
    const text = panel?.textContent ?? "";
    // Both halves of the consequence, before the confirming click.
    expect(text).toMatch(/tickets already in this category keep it/i);
    expect(text).toMatch(/new reports will stop/i);
    // And nothing has been sent yet.
    expect(
      fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "DELETE"),
    ).toBe(false);
  });

  it("CL-008: confirming sends the retire request; cancelling sends nothing", async () => {
    renderList([category()]);
    const row = await waitFor(() => rowFor("printer"));

    fireEvent.click(within(row).getByRole("button", { name: /retire/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));
    await screen.findByText("Categories");
    expect(
      fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "DELETE"),
    ).toBe(false);

    fireEvent.click(within(rowFor("printer")).getByRole("button", { name: /retire/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^retire printer$/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(call?.[0]).toBe("/api/maintainer/categories/printer");
    });
  });
});

describe("CategoryListPage — slug rules reported before the change (FR-007, edge case)", () => {
  async function openCreateForm() {
    renderList([category()]);
    await waitFor(() => rowFor("printer"));
    fireEvent.click(screen.getByRole("button", { name: /add a category/i }));
    await screen.findByText("Add a category");
    fetchMock.mockClear();
  }

  function fillAndSubmit(machineName: string) {
    fireEvent.change(screen.getByLabelText(/machine name/i), { target: { value: machineName } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "New thing" } });
    fireEvent.change(screen.getByLabelText(/what belongs in this category/i), {
      target: { value: "Problems that belong in the new category." },
    });
    fireEvent.change(screen.getByLabelText(/what the reporter should do/i), {
      target: { value: "Restart the machine and wait for it to come back." },
    });
    fireEvent.change(screen.getByLabelText(/how they know it worked/i), {
      target: { value: "The machine reaches the sign-in screen." },
    });
    fireEvent.click(screen.getByRole("button", { name: /create category/i }));
  }

  it("CL-009: a malformed machine name is reported on that field", async () => {
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/machine name/i), { target: { value: "Not A Slug" } });
    fireEvent.blur(screen.getByLabelText(/machine name/i));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/lowercase letters, numbers and underscores/i);
    // Named on blur, before anything is sent.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CL-010: a malformed machine name blocks the request rather than failing after it", async () => {
    await openCreateForm();
    fillAndSubmit("Not A Slug");

    await screen.findByRole("alert");
    expect(
      fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "POST"),
    ).toBe(false);
  });

  it("CL-011: a duplicate machine name is caught against the loaded list, before the request", async () => {
    await openCreateForm();
    fillAndSubmit("printer");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already exists/i);
    expect(
      fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "POST"),
    ).toBe(false);
  });

  it("CL-012: a refusal does not discard what was already typed", async () => {
    await openCreateForm();
    fillAndSubmit("printer");
    await screen.findByRole("alert");

    expect(screen.getByLabelText(/display name/i)).toHaveValue("New thing");
    expect(screen.getByLabelText(/what the reporter should do/i)).toHaveValue(
      "Restart the machine and wait for it to come back.",
    );
  });

  it("CL-013: a server-side duplicate lands on the machine-name field, not as a generic failure", async () => {
    // Another maintainer took the name between the local check and this request, so the
    // local list cannot catch it. The message still belongs on the field.
    await openCreateForm();
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "CATEGORY_EXISTS", message: "Category already exists" } },
        409,
      ),
    );
    fillAndSubmit("brand_new_thing");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already exists/i);
    // Attached to the machine-name field rather than floating above the form.
    const label = screen.getByLabelText(/machine name/i).closest("label");
    expect(label?.contains(alert)).toBe(true);
  });
});

describe("CategoryListPage — guide version history is read-only", () => {
  it("CL-014: shows each version with who published it and when, and offers no way to change one", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith("/guide/versions")) {
        return Promise.resolve(
          jsonResponse({
            versions: [
              {
                version: 2,
                changedBy: "Jordan",
                changedAt: "2026-06-01T10:00:00.000Z",
                changeNote: "Added the driver step.",
                active: true,
                steps: [{ instruction: "Reinstall the driver.", successHint: "It prints." }],
              },
              {
                version: 1,
                changedBy: "Robin",
                changedAt: "2026-05-01T10:00:00.000Z",
                changeNote: null,
                active: false,
                steps: [{ instruction: "Turn it off and on.", successHint: "It prints." }],
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ categories: [category()] }));
    });

    render(<CategoryListPage credentials={CREDENTIALS} onActionError={vi.fn()} />);
    const row = await waitFor(() => rowFor("printer"));
    fireEvent.click(within(row).getByRole("button", { name: /version history/i }));

    await screen.findByText(/printer guide history/i);
    expect(screen.getByText(/version 2/i)).toBeTruthy();
    expect(screen.getByText(/jordan/i)).toBeTruthy();
    expect(screen.getByText(/added the driver step/i)).toBeTruthy();
    expect(screen.getByText(/^active$/i)).toBeTruthy();

    // No endpoint exists for any of these, and offering one would promise something the
    // system cannot do: a published version is what a reporter was actually told to do.
    for (const label of [/revert/i, /restore/i, /delete/i, /edit this version/i]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });
});
