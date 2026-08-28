import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileField } from "../../src/components/profile/ProfileField";
import type { FieldState } from "../../src/lib/types";
import {
  LOCKED_FIELD_EXPLANATION,
  LOCKED_ON_SAVE_EXPLANATION,
  NO_RECORDED_AUTHOR_BYLINE,
  OWNER_CONTROLLED_NOTE,
  STAFF_CONTROLLED_NOTE,
} from "../../src/lib/profileCopy";

const SET_AT = "2026-05-04T09:30:00.000Z";

function state(overrides: Partial<FieldState> = {}): FieldState {
  return {
    setByKind: "owner",
    setById: "acct-1",
    setByName: "Amina Yusuf",
    setAt: SET_AT,
    controlledBy: "owner",
    ...overrides,
  };
}

function renderField(props: Partial<Parameters<typeof ProfileField>[0]> = {}) {
  return render(
    <ProfileField
      label="Location"
      id="location"
      state={state()}
      readOnlyValue="Block C, Room 214"
      audience="owner"
      {...props}
    >
      <input id="location" defaultValue="Block C, Room 214" />
    </ProfileField>,
  );
}

describe("ProfileField", () => {
  it("PF-001: labels the control, with the label above it", () => {
    const { container } = renderField();
    const label = screen.getByText("Location");
    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe("location");
    const input = container.querySelector("#location");
    expect(input).not.toBeNull();
    // Label precedes the control in document order, which is what puts it above it.
    expect(label.compareDocumentPosition(input!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("PF-002: an owner-controlled field renders its editable control for the owner", () => {
    const { container } = renderField();
    expect(container.querySelector("input#location")).not.toBeNull();
    expect(screen.queryByText(LOCKED_FIELD_EXPLANATION)).toBeNull();
  });

  it("PF-003: a staff-controlled field is read-only text for the owner, never an input", () => {
    const { container } = renderField({
      state: state({ controlledBy: "staff", setByKind: "staff", setByName: "Case Manager" }),
    });
    expect(container.querySelector("input")).toBeNull();
    expect(screen.getByText("Block C, Room 214")).toBeDefined();
    expect(screen.getByText(LOCKED_FIELD_EXPLANATION)).toBeDefined();
  });

  it("PF-004: a locked field is never a disabled input (FR-022, Design Direction)", () => {
    const { container } = renderField({ state: state({ controlledBy: "staff" }) });
    expect(container.querySelectorAll("[disabled]").length).toBe(0);
  });

  it("PF-005: a lock is neutral, never amber or red", () => {
    const { container } = renderField({ state: state({ controlledBy: "staff" }) });
    const classes = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .map((node) => node.className)
      .join(" ");
    expect(classes).not.toMatch(/amber|red|yellow|orange/);
  });

  it("PF-006: provenance is a muted byline, not a badge", () => {
    const { container } = renderField();
    const byline = screen.getByText(/^Set by Amina Yusuf, /);
    expect(byline.tagName).toBe("P");
    expect(byline.className).toContain("text-xs");
    expect(byline.className).toContain("text-gray-500");
    // No pill or badge shape anywhere in the field.
    const classes = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .map((node) => node.className)
      .join(" ");
    expect(classes).not.toMatch(/rounded-full/);
  });

  it("PF-007: a field with no recorded authorship says so rather than showing nothing", () => {
    renderField({ state: state({ setByKind: null, setById: null, setByName: null, setAt: null }) });
    expect(screen.getByText(NO_RECORDED_AUTHOR_BYLINE)).toBeDefined();
  });

  it("PF-008: an undefined state is treated as owner-controlled", () => {
    const { container } = renderField({ state: undefined });
    expect(container.querySelector("input#location")).not.toBeNull();
    expect(screen.queryByText(LOCKED_FIELD_EXPLANATION)).toBeNull();
  });

  it("PF-009: staff see who controls the field", () => {
    const { rerender } = renderField({ audience: "staff" });
    expect(screen.getByText(OWNER_CONTROLLED_NOTE)).toBeDefined();

    rerender(
      <ProfileField
        label="Location"
        id="location"
        state={state({ controlledBy: "staff" })}
        readOnlyValue="Block C, Room 214"
        audience="staff"
      >
        <input id="location" defaultValue="Block C, Room 214" />
      </ProfileField>,
    );
    expect(screen.getByText(STAFF_CONTROLLED_NOTE)).toBeDefined();
  });

  it("PF-010: the owner never sees the staff control notes", () => {
    renderField({ audience: "owner", state: state({ controlledBy: "staff" }) });
    expect(screen.queryByText(STAFF_CONTROLLED_NOTE)).toBeNull();
    expect(screen.queryByText(OWNER_CONTROLLED_NOTE)).toBeNull();
  });

  it("PF-011: staff can edit a staff-controlled field", () => {
    const { container } = renderField({ audience: "staff", state: state({ controlledBy: "staff" }) });
    expect(container.querySelector("input#location")).not.toBeNull();
    expect(screen.queryByText(LOCKED_FIELD_EXPLANATION)).toBeNull();
  });

  it("PF-012: release is offered only on a staff-controlled field", () => {
    const onRelease = vi.fn();
    const { rerender } = renderField({
      audience: "staff",
      state: state({ controlledBy: "owner" }),
      onRelease,
    });
    // Not even a disabled one: there is nothing to release from an owner-controlled field.
    expect(screen.queryByRole("button", { name: /return to the account owner/i })).toBeNull();

    rerender(
      <ProfileField
        label="Location"
        id="location"
        state={state({ controlledBy: "staff" })}
        readOnlyValue="Block C, Room 214"
        audience="staff"
        onRelease={onRelease}
      >
        <input id="location" defaultValue="Block C, Room 214" />
      </ProfileField>,
    );
    fireEvent.click(screen.getByRole("button", { name: /return to the account owner/i }));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("PF-013: the owner is never offered release", () => {
    renderField({ audience: "owner", state: state({ controlledBy: "staff" }), onRelease: vi.fn() });
    expect(screen.queryByRole("button", { name: /return to the account owner/i })).toBeNull();
  });

  it("PF-014: an applied outcome is announced as a status, per field", () => {
    renderField({ outcome: { outcome: "applied" } });
    expect(screen.getByRole("status").textContent).toContain("Saved.");
  });

  it("PF-015: a conflict explains what happened and keeps the typed value", () => {
    const { container } = renderField({
      audience: "staff",
      state: state({ controlledBy: "staff" }),
      outcome: {
        outcome: "conflict",
        currentValue: "Block D, Room 101",
        currentSetByName: "Case Manager",
        currentSetAt: SET_AT,
      },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Case Manager changed this on");
    expect(alert.textContent).toContain("Your text is still here");
    // The control, and therefore whatever was typed into it, is still rendered.
    expect(container.querySelector("input#location")).not.toBeNull();
  });

  it("PF-016: a locked-on-save outcome is explained neutrally", () => {
    const { container } = renderField({
      state: state({ controlledBy: "staff" }),
      outcome: { outcome: "locked", currentSetByName: "Case Manager", currentSetAt: SET_AT },
    });
    expect(screen.getByRole("alert").textContent).toBe(LOCKED_ON_SAVE_EXPLANATION);
    const classes = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .map((node) => node.className)
      .join(" ");
    expect(classes).not.toMatch(/amber|red/);
  });

  it("PF-017: history is rendered only where the caller passes it", () => {
    renderField({ audience: "staff", history: <p>history slot</p> });
    expect(screen.getByText("history slot")).toBeDefined();

    // The owner page passes none, and the component invents none (FR-018).
    const owner = render(
      <ProfileField label="Location" id="location-2" state={state()} readOnlyValue="x" audience="owner">
        <input id="location-2" />
      </ProfileField>,
    );
    expect(owner.container.textContent).not.toMatch(/previous|history/i);
  });

  it("PF-018: no rendered copy contains an em-dash", () => {
    const { container } = renderField({
      audience: "staff",
      state: state({ controlledBy: "staff" }),
      onRelease: vi.fn(),
      hint: "One line is enough.",
      outcome: {
        outcome: "conflict",
        currentValue: "x",
        currentSetByName: "Case Manager",
        currentSetAt: SET_AT,
      },
    });
    expect(container.textContent).not.toContain("—");
  });
});
