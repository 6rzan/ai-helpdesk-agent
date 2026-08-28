import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePanel } from "../../src/components/ProfilePanel";
import type { ProfileFieldStateMap, SupportProfileView } from "../../src/lib/types";
import { NO_RECORDED_AUTHOR_BYLINE, provenanceByline } from "../../src/lib/profileCopy";

const SET_AT = "2026-05-04T09:30:00.000Z";

const STATES: ProfileFieldStateMap = {
  location: {
    setByKind: "staff",
    setById: "s1",
    setByName: "Case Manager",
    setAt: SET_AT,
    controlledBy: "staff",
  },
  hardware: {
    setByKind: "owner",
    setById: "a1",
    setByName: "Amina Yusuf",
    setAt: SET_AT,
    controlledBy: "owner",
  },
  remoteAccessIds: {
    setByKind: "owner",
    setById: "a1",
    setByName: "Amina Yusuf",
    setAt: SET_AT,
    controlledBy: "owner",
  },
};

function profile(overrides: Partial<SupportProfileView> = {}): SupportProfileView {
  return {
    location: "Lab 3",
    hardware: "Dell",
    remoteAccessIds: [{ tool: "TeamViewer", id: "123" }],
    staffEntries: [],
    fieldState: STATES,
    ...overrides,
  };
}

describe("ProfilePanel", () => {
  it("PN-001: shows the same values the profile pages show", () => {
    render(<ProfilePanel profile={profile()} />);
    expect(screen.getByText("Lab 3")).toBeInTheDocument();
    expect(screen.getByText("Dell")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("PN-002: carries one byline per field, in the shared wording", () => {
    render(<ProfilePanel profile={profile()} />);
    expect(screen.getByText(provenanceByline("Case Manager", SET_AT))).toBeInTheDocument();
    // The two owner-set fields share a byline string, so both instances are expected.
    expect(screen.getAllByText(provenanceByline("Amina Yusuf", SET_AT)).length).toBe(2);
  });

  it("PN-003: places the byline directly under its value, muted", () => {
    render(<ProfilePanel profile={profile()} />);
    const value = screen.getByText("Lab 3");
    const byline = screen.getByText(provenanceByline("Case Manager", SET_AT));
    expect(byline.className).toContain("text-xs");
    expect(byline.className).toContain("text-gray-500");
    expect(value.nextElementSibling).toBe(byline);
  });

  it("PN-004: gives the remote access list one byline, not one per entry", () => {
    render(
      <ProfilePanel
        profile={profile({
          remoteAccessIds: [
            { tool: "TeamViewer", id: "123" },
            { tool: "UltraViewer", id: "456" },
          ],
        })}
      />,
    );
    expect(screen.getAllByText(provenanceByline("Amina Yusuf", SET_AT)).length).toBe(2);
  });

  it("PN-005: says when nobody is recorded as having set a value", () => {
    render(
      <ProfilePanel
        profile={profile({
          fieldState: {
            location: { setByKind: null, setById: null, setByName: null, setAt: null, controlledBy: "owner" },
            hardware: STATES.hardware,
            remoteAccessIds: STATES.remoteAccessIds,
          },
        })}
      />,
    );
    expect(screen.getByText(NO_RECORDED_AUTHOR_BYLINE)).toBeInTheDocument();
  });

  it("PN-006: a response with no field state carries no byline rather than an invented one", () => {
    const withoutState = { ...profile() };
    delete withoutState.fieldState;
    const { container } = render(<ProfilePanel profile={withoutState} />);
    expect(container.textContent).not.toMatch(/Set by|No record of who set this/);
    expect(screen.getByText("Lab 3")).toBeInTheDocument();
  });

  it("PN-007: renders a pre-feature correction as an earlier note, not as a badge", () => {
    const { container } = render(
      <ProfilePanel
        profile={profile({
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
        })}
      />,
    );
    expect(screen.getByText(/earlier note about location/i)).toBeInTheDocument();
    expect(container.querySelector("span.bg-gray-200")).toBeNull();
  });

  it("PN-008: keeps its empty state when no profile is on file", () => {
    render(<ProfilePanel profile={null} />);
    expect(screen.getByText(/no profile on file/i)).toBeInTheDocument();
  });

  it("PN-009: no rendered copy contains an em-dash", () => {
    const { container } = render(<ProfilePanel profile={profile()} />);
    expect(container.textContent).not.toContain("—");
  });
});
