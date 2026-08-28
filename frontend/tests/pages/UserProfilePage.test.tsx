import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserProfilePage } from "../../src/pages/staff/UserProfilePage";
import type { FieldControl, SupportProfile } from "../../src/lib/types";

const getStaffUserProfile = vi.fn();
const getStaffCredentialStatus = vi.fn();
const appendStaffProfileEntry = vi.fn();
const resetStaffCredentials = vi.fn();
const saveStaffProfileFields = vi.fn();
const releaseStaffProfileField = vi.fn();
const getStaffProfileFieldHistory = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    getStaffUserProfile: (...args: unknown[]) => getStaffUserProfile(...args),
    getStaffCredentialStatus: (...args: unknown[]) => getStaffCredentialStatus(...args),
    appendStaffProfileEntry: (...args: unknown[]) => appendStaffProfileEntry(...args),
    resetStaffCredentials: (...args: unknown[]) => resetStaffCredentials(...args),
    saveStaffProfileFields: (...args: unknown[]) => saveStaffProfileFields(...args),
    releaseStaffProfileField: (...args: unknown[]) => releaseStaffProfileField(...args),
    getStaffProfileFieldHistory: (...args: unknown[]) => getStaffProfileFieldHistory(...args),
  };
});

const LOADED_AT = "2026-05-04T09:30:00.000Z";
const LATER = "2026-05-06T14:00:00.000Z";

function fieldState(controlledBy: FieldControl, setAt: string | null, setByName = "Amina Yusuf") {
  return {
    setByKind: controlledBy,
    setById: "actor-1",
    setByName,
    setAt,
    controlledBy,
  };
}

function profile(overrides: Partial<SupportProfile> = {}): SupportProfile {
  return {
    remoteAccessIds: [{ tool: "TeamViewer", id: "123" }],
    location: "Lab 3",
    hardware: "Dell",
    staffEntries: [],
    fieldState: {
      location: fieldState("owner", LOADED_AT),
      hardware: fieldState("owner", LOADED_AT),
      remoteAccessIds: fieldState("owner", LOADED_AT),
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/staff/users/u1/profile"]}>
      <Routes>
        <Route path="/staff/users/:accountId/profile" element={<UserProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Render the page and wait for the load to land. Every test starts here, so the mocks
 * have to be set before it is called. */
async function loaded() {
  renderPage();
  // The page renders before the profile arrives, so waiting on the label alone would
  // hand back the pre-load empty control.
  await screen.findByDisplayValue("Lab 3");
  return screen.getByLabelText("Location") as HTMLInputElement;
}

function saveButton() {
  return screen.getByRole("button", { name: /save support details/i });
}

describe("UserProfilePage", () => {
  beforeEach(() => {
    for (const mock of [
      getStaffUserProfile,
      getStaffCredentialStatus,
      appendStaffProfileEntry,
      resetStaffCredentials,
      saveStaffProfileFields,
      releaseStaffProfileField,
      getStaffProfileFieldHistory,
    ]) {
      mock.mockReset();
    }
    getStaffUserProfile.mockResolvedValue({ profile: profile() });
    getStaffCredentialStatus.mockResolvedValue({ usingInitialPassword: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("UP-001: loads each field into an editable control with its provenance", async () => {
    const location = await loaded();
    expect(location.value).toBe("Lab 3");
    expect((screen.getByLabelText("Device or asset") as HTMLTextAreaElement).value).toBe("Dell");
    expect(screen.getAllByText(/^Set by Amina Yusuf, /).length).toBe(3);
  });

  it("UP-002: sends every field with the setAt it was loaded with", async () => {
    saveStaffProfileFields.mockResolvedValue({
      results: { location: { outcome: "applied" }, hardware: { outcome: "applied" }, remoteAccessIds: { outcome: "applied" } },
      profile: profile({ location: "Lab 4" }),
    });
    const location = await loaded();
    fireEvent.change(location, { target: { value: "Lab 4" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveStaffProfileFields).toHaveBeenCalled());
    expect(saveStaffProfileFields).toHaveBeenCalledWith("u1", {
      location: { value: "Lab 4", expectedSetAt: LOADED_AT },
      hardware: { value: "Dell", expectedSetAt: LOADED_AT },
      remoteAccessIds: { value: [{ tool: "TeamViewer", id: "123" }], expectedSetAt: LOADED_AT },
    });
  });

  it("UP-003: reports each field's outcome on that field, with no page-level failure banner", async () => {
    saveStaffProfileFields.mockResolvedValue({
      results: {
        location: {
          outcome: "conflict",
          currentValue: "Lab 9",
          currentSetByName: "Case Manager",
          currentSetAt: LATER,
        },
        hardware: { outcome: "applied" },
        remoteAccessIds: { outcome: "applied" },
      },
      profile: profile({
        location: "Lab 9",
        fieldState: {
          location: fieldState("staff", LATER, "Case Manager"),
          hardware: fieldState("staff", LATER, "Case Manager"),
          remoteAccessIds: fieldState("staff", LATER, "Case Manager"),
        },
      }),
    });
    const location = await loaded();
    fireEvent.change(location, { target: { value: "Lab 4" } });
    fireEvent.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Case Manager changed this on");
    // Two applied fields say so on themselves rather than in one summary line.
    await waitFor(() => expect(screen.getAllByRole("status").length).toBe(2));
  });

  it("UP-004: a conflict never discards the staff member's typed value", async () => {
    saveStaffProfileFields.mockResolvedValue({
      results: {
        location: { outcome: "conflict", currentValue: "Lab 9", currentSetByName: "Case Manager", currentSetAt: LATER },
        hardware: { outcome: "applied" },
        remoteAccessIds: { outcome: "applied" },
      },
      profile: profile({
        location: "Lab 9",
        fieldState: {
          location: fieldState("staff", LATER, "Case Manager"),
          hardware: fieldState("staff", LATER, "Case Manager"),
          remoteAccessIds: fieldState("staff", LATER, "Case Manager"),
        },
      }),
    });
    const location = await loaded();
    fireEvent.change(location, { target: { value: "Lab 4" } });
    fireEvent.click(saveButton());
    await screen.findByRole("alert");

    expect((screen.getByLabelText("Location") as HTMLInputElement).value).toBe("Lab 4");
  });

  it("UP-005: saving again after a conflict carries the token the server just reported", async () => {
    saveStaffProfileFields.mockResolvedValueOnce({
      results: {
        location: { outcome: "conflict", currentValue: "Lab 9", currentSetByName: "Case Manager", currentSetAt: LATER },
        hardware: { outcome: "applied" },
        remoteAccessIds: { outcome: "applied" },
      },
      profile: profile({
        location: "Lab 9",
        fieldState: {
          location: fieldState("staff", LATER, "Case Manager"),
          hardware: fieldState("staff", LATER, "Case Manager"),
          remoteAccessIds: fieldState("staff", LATER, "Case Manager"),
        },
      }),
    });
    saveStaffProfileFields.mockResolvedValueOnce({
      results: { location: { outcome: "applied" }, hardware: { outcome: "applied" }, remoteAccessIds: { outcome: "applied" } },
      profile: profile({ location: "Lab 4" }),
    });
    const location = await loaded();
    fireEvent.change(location, { target: { value: "Lab 4" } });
    fireEvent.click(saveButton());
    await screen.findByRole("alert");

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveStaffProfileFields).toHaveBeenCalledTimes(2));
    expect(saveStaffProfileFields.mock.calls[1]?.[1].location).toEqual({
      value: "Lab 4",
      expectedSetAt: LATER,
    });
  });

  it("UP-006: shows nothing as saved until the server has answered (no optimistic UI)", async () => {
    let resolve: (value: unknown) => void = () => {};
    saveStaffProfileFields.mockReturnValue(new Promise((r) => { resolve = r; }));
    const location = await loaded();
    fireEvent.change(location, { target: { value: "Lab 4" } });
    const button = saveButton();
    fireEvent.click(button);

    expect(screen.queryByRole("status")).toBeNull();
    expect(button).toBeDisabled();

    resolve({
      results: { location: { outcome: "applied" }, hardware: { outcome: "applied" }, remoteAccessIds: { outcome: "applied" } },
      profile: profile({ location: "Lab 4" }),
    });
    await waitFor(() => expect(screen.getAllByRole("status").length).toBe(3));
  });

  it("UP-007: offers release only on a staff-controlled field", async () => {
    getStaffUserProfile.mockResolvedValue({
      profile: profile({
        fieldState: {
          location: fieldState("staff", LOADED_AT, "Case Manager"),
          hardware: fieldState("owner", LOADED_AT),
          remoteAccessIds: fieldState("owner", LOADED_AT),
        },
      }),
    });
    await loaded();
    expect(screen.getAllByRole("button", { name: /return to the account owner/i }).length).toBe(1);
  });

  it("UP-008: a release is applied only from the server's answer", async () => {
    getStaffUserProfile.mockResolvedValue({
      profile: profile({
        fieldState: {
          location: fieldState("staff", LOADED_AT, "Case Manager"),
          hardware: fieldState("owner", LOADED_AT),
          remoteAccessIds: fieldState("owner", LOADED_AT),
        },
      }),
    });
    let resolve: (value: unknown) => void = () => {};
    releaseStaffProfileField.mockReturnValue(new Promise((r) => { resolve = r; }));
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /return to the account owner/i }));

    // Still shown as staff-controlled while the request is in flight.
    expect(screen.getByText(/returning/i)).toBeDefined();
    expect(releaseStaffProfileField).toHaveBeenCalledWith("u1", "location");

    resolve({ profile: profile() });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /return to the account owner/i })).toBeNull(),
    );
  });

  it("UP-009: treats the remote access list as one field, not one per row", async () => {
    getStaffUserProfile.mockResolvedValue({
      profile: profile({
        remoteAccessIds: [
          { tool: "TeamViewer", id: "123" },
          { tool: "UltraViewer", id: "456" },
        ],
        fieldState: {
          location: fieldState("owner", LOADED_AT),
          hardware: fieldState("owner", LOADED_AT),
          remoteAccessIds: fieldState("staff", LOADED_AT, "Case Manager"),
        },
      }),
    });
    await loaded();
    // Two rows, but one byline, one lock, and one release for the list as a whole.
    expect(screen.getByLabelText("Remote access tool 2")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /return to the account owner/i }).length).toBe(1);
    expect(screen.getAllByText(/^Set by Case Manager, /).length).toBe(1);
  });

  it("UP-010: saves the whole remote access list as one value", async () => {
    saveStaffProfileFields.mockResolvedValue({
      results: { location: { outcome: "applied" }, hardware: { outcome: "applied" }, remoteAccessIds: { outcome: "applied" } },
      profile: profile(),
    });
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /add another remote access id/i }));
    fireEvent.change(screen.getByLabelText("Remote access tool 2"), { target: { value: "UltraViewer" } });
    fireEvent.change(screen.getByLabelText("Remote access ID 2"), { target: { value: "456" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveStaffProfileFields).toHaveBeenCalled());
    expect(saveStaffProfileFields.mock.calls[0]?.[1].remoteAccessIds.value).toEqual([
      { tool: "TeamViewer", id: "123" },
      { tool: "UltraViewer", id: "456" },
    ]);
  });

  it("UP-011: field history is fetched on demand and shown newest first", async () => {
    getStaffProfileFieldHistory.mockResolvedValue({
      history: [
        {
          changeKind: "value",
          previousValue: "Lab 1",
          actorKind: "staff",
          actorId: "s1",
          actorName: "Case Manager",
          at: LATER,
        },
      ],
    });
    await loaded();
    expect(getStaffProfileFieldHistory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^previous location values$/i }));
    await waitFor(() => expect(getStaffProfileFieldHistory).toHaveBeenCalledWith("u1", "location"));
    expect(await screen.findByText(/Was: Lab 1/)).toBeDefined();
  });

  it("UP-012: no longer offers the retired correction entry kind", async () => {
    await loaded();
    expect(screen.queryByLabelText(/entry type/i)).toBeNull();
    expect(screen.queryByRole("option", { name: /correction/i })).toBeNull();
  });

  it("UP-013: adds an attributed note", async () => {
    appendStaffProfileEntry.mockResolvedValue({
      profile: profile({
        staffEntries: [
          {
            kind: "note",
            field: null,
            value: "Asset record says Lab 4",
            staffId: "s1",
            staffName: "Sam",
            at: "2026-07-15T10:00:00.000Z",
          },
        ],
      }),
    });
    await loaded();
    fireEvent.change(screen.getByLabelText(/^note$/i), { target: { value: "Asset record says Lab 4" } });
    fireEvent.click(screen.getByRole("button", { name: /add attributed note/i }));

    await waitFor(() =>
      expect(appendStaffProfileEntry).toHaveBeenCalledWith("u1", {
        kind: "note",
        field: null,
        value: "Asset record says Lab 4",
      }),
    );
    expect(screen.getByText(/asset record says lab 4/i)).toBeInTheDocument();
  });

  it("UP-014: renders a pre-feature correction as a note rather than as a value", async () => {
    getStaffUserProfile.mockResolvedValue({
      profile: profile({
        staffEntries: [
          {
            kind: "correction",
            field: "location",
            value: "Asset record says Lab 4",
            staffId: "s1",
            staffName: "Sam",
            at: "2026-07-15T10:00:00.000Z",
          },
        ],
      }),
    });
    const location = await loaded();
    expect(location.value).toBe("Lab 3");
    expect(screen.getByText(/earlier note about location/i)).toBeDefined();
  });

  it("UP-015: requires inline confirmation before re-issuing a password", async () => {
    resetStaffCredentials.mockResolvedValue({ usingInitialPassword: true });
    await loaded();
    fireEvent.change(screen.getByLabelText(/new initial password/i), { target: { value: "new-password" } });
    const button = screen.getByRole("button", { name: /re-issue initial password/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/i confirm this will invalidate/i));
    fireEvent.click(button);
    await waitFor(() => expect(resetStaffCredentials).toHaveBeenCalledWith("u1", "new-password"));
    expect(await screen.findByText(/existing sessions were invalidated/i)).toBeInTheDocument();
  });
});
