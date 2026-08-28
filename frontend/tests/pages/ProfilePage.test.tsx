import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfilePage } from "../../src/pages/ProfilePage";
import type { FieldControl, ProfileFieldStateMap, SupportProfile } from "../../src/lib/types";
import {
  ALL_FIELDS_LOCKED_EXPLANATION,
  LOCKED_FIELD_EXPLANATION,
  LOCKED_ON_SAVE_EXPLANATION,
} from "../../src/lib/profileCopy";

const getMyProfile = vi.fn();
const updateMyProfile = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    getMyProfile: () => getMyProfile(),
    updateMyProfile: (input: unknown) => updateMyProfile(input),
  };
});

const SET_AT = "2026-05-04T09:30:00.000Z";

const NOTE = {
  kind: "note" as const,
  field: null,
  value: "Please call before connecting.",
  staffId: "s1",
  staffName: "Sam",
  at: "2026-07-15T10:00:00.000Z",
};

function fieldState(controlledBy: FieldControl, setByName: string | null = "Amina Yusuf") {
  return {
    setByKind: controlledBy,
    setById: "actor-1",
    setByName,
    setAt: setByName === null ? null : SET_AT,
    controlledBy,
  };
}

function states(
  location: FieldControl,
  hardware: FieldControl,
  remoteAccessIds: FieldControl,
): ProfileFieldStateMap {
  return {
    location: fieldState(location, location === "staff" ? "Case Manager" : "Amina Yusuf"),
    hardware: fieldState(hardware, hardware === "staff" ? "Case Manager" : "Amina Yusuf"),
    remoteAccessIds: fieldState(
      remoteAccessIds,
      remoteAccessIds === "staff" ? "Case Manager" : "Amina Yusuf",
    ),
  };
}

function profile(overrides: Partial<SupportProfile> = {}): SupportProfile {
  return {
    remoteAccessIds: [],
    location: "",
    hardware: "",
    staffEntries: [],
    ...overrides,
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    getMyProfile.mockReset();
    updateMyProfile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PP-001: saves support-relevant fields and renders attributed staff entries", async () => {
    getMyProfile.mockResolvedValue({ profile: profile({ staffEntries: [NOTE] }) });
    updateMyProfile.mockResolvedValue({
      results: {},
      profile: profile({
        remoteAccessIds: [{ tool: "Remote access", id: "123" }],
        location: "Lab 3",
        hardware: "Dell",
        staffEntries: [NOTE],
      }),
    });
    render(<ProfilePage />);

    await screen.findByText(/please call before connecting/i);
    fireEvent.change(screen.getByLabelText("Remote access ID 1"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "Lab 3" } });
    fireEvent.change(screen.getByLabelText(/device or asset/i), { target: { value: "Dell" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith({
        remoteAccessIds: [{ tool: "Remote access", id: "123" }],
        location: "Lab 3",
        hardware: "Dell",
      }),
    );
    expect(screen.getByText(/Sam ·/)).toBeInTheDocument();
  });

  it("PP-002: preserves multiple labelled remote-access IDs through save and reload", async () => {
    const entries = [
      { tool: "TeamViewer", id: "one" },
      { tool: "AnyDesk", id: "two" },
    ];
    getMyProfile.mockResolvedValue({ profile: profile({ remoteAccessIds: entries }) });
    updateMyProfile.mockResolvedValue({
      results: {},
      profile: profile({
        remoteAccessIds: [{ tool: "TeamViewer", id: "one-edited" }, entries[1]!],
      }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("AnyDesk");
    fireEvent.change(screen.getByLabelText("Remote access ID 1"), { target: { value: "one-edited" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          remoteAccessIds: [{ tool: "TeamViewer", id: "one-edited" }, { tool: "AnyDesk", id: "two" }],
        }),
      ),
    );
    expect(screen.getByDisplayValue("two")).toBeInTheDocument();
  });

  it("PP-003: removes one remote-access ID without collapsing the remaining entries", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        remoteAccessIds: [
          { tool: "TeamViewer", id: "one" },
          { tool: "AnyDesk", id: "two" },
        ],
      }),
    });
    updateMyProfile.mockResolvedValue({
      results: {},
      profile: profile({ remoteAccessIds: [{ tool: "AnyDesk", id: "two" }] }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("TeamViewer");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({ remoteAccessIds: [{ tool: "AnyDesk", id: "two" }] }),
      ),
    );
    expect(screen.getByDisplayValue("AnyDesk")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("TeamViewer")).not.toBeInTheDocument();
  });

  it("PP-004: every field shows who set it and when", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({ location: "Lab 3", fieldState: states("owner", "owner", "owner") }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Lab 3");
    expect(screen.getAllByText(/^Set by Amina Yusuf, /).length).toBe(3);
  });

  it("PP-005: a staff-controlled field is read-only text with the explanation on the field", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        hardware: "Dell",
        fieldState: states("staff", "owner", "owner"),
      }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Dell");

    expect(screen.queryByLabelText(/^location$/i)).toBeNull();
    expect(screen.getByText("Lab 3")).toBeInTheDocument();
    expect(screen.getByText(LOCKED_FIELD_EXPLANATION)).toBeInTheDocument();
  });

  it("PP-006: a locked field is never a disabled input and is never coloured as a warning", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({ location: "Lab 3", fieldState: states("staff", "owner", "owner") }),
    });
    const { container } = render(<ProfilePage />);
    await screen.findByText(LOCKED_FIELD_EXPLANATION);

    expect(container.querySelectorAll("input[disabled], textarea[disabled]").length).toBe(0);
    const lockedRegion = screen.getByText(LOCKED_FIELD_EXPLANATION).parentElement!;
    expect(lockedRegion.innerHTML).not.toMatch(/amber|red|yellow/);
  });

  it("PP-007: fields the owner still controls stay editable exactly as before", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        hardware: "Dell",
        fieldState: states("staff", "owner", "owner"),
      }),
    });
    updateMyProfile.mockResolvedValue({ results: {}, profile: profile({ location: "Lab 3" }) });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Dell");

    fireEvent.change(screen.getByLabelText(/device or asset/i), { target: { value: "Dell XPS" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled());
  });

  it("PP-008: a locked field is not submitted, so a standing lock is not reported as a new failure", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        hardware: "Dell",
        fieldState: states("staff", "owner", "owner"),
      }),
    });
    updateMyProfile.mockResolvedValue({ results: {}, profile: profile({ location: "Lab 3" }) });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Dell");
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled());
    expect(updateMyProfile.mock.calls[0]?.[0]).not.toHaveProperty("location");
    expect(updateMyProfile.mock.calls[0]?.[0]).toHaveProperty("hardware");
  });

  it("PP-009: a field locked while the page was open is explained, not silently discarded", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({ location: "Lab 3", fieldState: states("owner", "owner", "owner") }),
    });
    updateMyProfile.mockResolvedValue({
      results: {
        location: { outcome: "locked", currentSetByName: "Case Manager", currentSetAt: SET_AT },
        hardware: { outcome: "applied" },
        remoteAccessIds: { outcome: "applied" },
      },
      profile: profile({ location: "Lab 9", fieldState: states("staff", "owner", "owner") }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Lab 3");
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "Lab 4" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText(LOCKED_ON_SAVE_EXPLANATION)).toBeInTheDocument();
    // The value staff set is what the field now shows.
    expect(screen.getByText("Lab 9")).toBeInTheDocument();
  });

  it("PP-010: an all-locked page still explains what it is for and how to get a value corrected", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        hardware: "Dell",
        remoteAccessIds: [{ tool: "TeamViewer", id: "123" }],
        fieldState: states("staff", "staff", "staff"),
      }),
    });
    render(<ProfilePage />);
    await screen.findByText(ALL_FIELDS_LOCKED_EXPLANATION);

    // Nothing to save, so no button whose only outcome is a refusal.
    expect(screen.queryByRole("button", { name: /save profile/i })).toBeNull();
    expect(screen.getByText(/These details help IT staff/)).toBeInTheDocument();
  });

  it("PP-011: no field-history affordance appears anywhere, not even collapsed or disabled", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        hardware: "Dell",
        fieldState: states("staff", "owner", "owner"),
      }),
    });
    const { container } = render(<ProfilePage />);
    await screen.findByText(LOCKED_FIELD_EXPLANATION);

    expect(container.textContent).not.toMatch(/previous .* values|history/i);
    expect(container.querySelector("[aria-expanded]")).toBeNull();
  });

  it("PP-012: a profile with no recorded authorship says so rather than showing nothing", async () => {
    getMyProfile.mockResolvedValue({
      profile: profile({
        location: "Lab 3",
        fieldState: {
          location: fieldState("owner", null),
          hardware: fieldState("owner", null),
          remoteAccessIds: fieldState("owner", null),
        },
      }),
    });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Lab 3");
    expect(screen.getAllByText(/No record of who set this or when/).length).toBe(3);
  });

  it("PP-013: a pre-feature profile with no field state stays fully editable", async () => {
    getMyProfile.mockResolvedValue({ profile: profile({ location: "Lab 3", hardware: "Dell" }) });
    render(<ProfilePage />);
    await screen.findByDisplayValue("Lab 3");

    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save profile/i })).toBeInTheDocument();
    expect(screen.queryByText(ALL_FIELDS_LOCKED_EXPLANATION)).toBeNull();
  });
});
