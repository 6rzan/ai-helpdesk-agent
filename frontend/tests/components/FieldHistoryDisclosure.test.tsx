import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FieldHistoryDisclosure } from "../../src/components/profile/FieldHistoryDisclosure";
import type { ProfileFieldHistoryEntry } from "../../src/lib/types";

const NEWEST = "2026-05-06T14:00:00.000Z";
const MIDDLE = "2026-05-05T11:00:00.000Z";
const OLDEST = "2026-05-04T09:30:00.000Z";

function valueEntry(overrides: Partial<ProfileFieldHistoryEntry> = {}): ProfileFieldHistoryEntry {
  return {
    changeKind: "value",
    previousValue: "Block C, Room 214",
    previousSetByKind: "owner",
    previousSetByName: "Amina Yusuf",
    previousSetAt: OLDEST,
    actorKind: "staff",
    actorId: "staff-1",
    actorName: "Case Manager",
    at: NEWEST,
    ...overrides,
  };
}

function renderDisclosure(props: Partial<Parameters<typeof FieldHistoryDisclosure>[0]> = {}) {
  const onOpen = vi.fn();
  const result = render(
    <FieldHistoryDisclosure
      field="location"
      label="Location"
      entries={[valueEntry()]}
      onOpen={onOpen}
      {...props}
    />,
  );
  return { ...result, onOpen };
}

function toggle() {
  return screen.getByRole("button", { name: /previous location values/i });
}

describe("FieldHistoryDisclosure", () => {
  it("FH-001: is collapsed by default", () => {
    const { container } = renderDisclosure();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#history-location")).toBeNull();
    expect(screen.queryByText(/Block C, Room 214/)).toBeNull();
  });

  it("FH-002: expands and collapses again on the same control", () => {
    renderDisclosure();
    fireEvent.click(toggle());
    expect(screen.getByRole("button", { name: /hide previous location values/i })).toBeDefined();
    expect(screen.getByText(/Block C, Room 214/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /hide previous location values/i }));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("FH-003: the toggle names the region it controls", () => {
    const { container } = renderDisclosure();
    fireEvent.click(toggle());
    const control = screen.getByRole("button", { name: /hide previous location values/i });
    expect(control.getAttribute("aria-controls")).toBe("history-location");
    expect(container.querySelector("#history-location")).not.toBeNull();
  });

  it("FH-004: fetches on first open only, not on every toggle", () => {
    const { onOpen } = renderDisclosure({ entries: null });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(toggle());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("FH-005: does not refetch when the entries are already loaded", () => {
    const { onOpen } = renderDisclosure();
    fireEvent.click(toggle());
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("FH-006: shows a loading state while the history is on its way", () => {
    renderDisclosure({ entries: null, isLoading: true });
    fireEvent.click(toggle());
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("FH-007: an empty history says so rather than showing an empty box", () => {
    renderDisclosure({ entries: [] });
    fireEvent.click(toggle());
    expect(screen.getByText(/nothing has changed on this field/i)).toBeDefined();
  });

  it("FH-008: renders entries newest first, in the order given", () => {
    renderDisclosure({
      entries: [
        valueEntry({ previousValue: "Third", at: NEWEST }),
        valueEntry({ previousValue: "Second", at: MIDDLE }),
        valueEntry({ previousValue: "First", at: OLDEST }),
      ],
    });
    fireEvent.click(toggle());
    const items = screen.getAllByRole("listitem").map((node) => node.textContent ?? "");
    expect(items[0]).toContain("Third");
    expect(items[1]).toContain("Second");
    expect(items[2]).toContain("First");
  });

  it("FH-009: a list field's previous value is rendered as a list, not a joined sentence", () => {
    const { container } = renderDisclosure({
      entries: [
        valueEntry({
          previousValue: [
            { tool: "TeamViewer", id: "111 222 333" },
            { tool: "UltraViewer", id: "44 55 66" },
          ],
        }),
      ],
    });
    fireEvent.click(toggle());
    const list = container.querySelector("#history-location ul");
    expect(list).not.toBeNull();
    const values = Array.from(list!.querySelectorAll("li")).map((node) => node.textContent);
    expect(values).toEqual(["TeamViewer: 111 222 333", "UltraViewer: 44 55 66"]);
  });

  it("FH-010: an empty list value reads as empty rather than as a bare label", () => {
    renderDisclosure({ entries: [valueEntry({ previousValue: [] })] });
    fireEvent.click(toggle());
    expect(screen.getByText("Was empty")).toBeDefined();
  });

  it("FH-011: an empty string value reads as empty", () => {
    renderDisclosure({ entries: [valueEntry({ previousValue: "" })] });
    fireEvent.click(toggle());
    expect(screen.getByText("Was empty")).toBeDefined();
  });

  it("FH-012: a control entry says where control moved, not what the value was", () => {
    renderDisclosure({
      entries: [
        valueEntry({ changeKind: "control", newControlledBy: "staff", previousValue: null }),
        valueEntry({ changeKind: "control", newControlledBy: "owner", previousValue: null, at: MIDDLE }),
      ],
    });
    fireEvent.click(toggle());
    expect(screen.getByText("Taken over by staff")).toBeDefined();
    expect(screen.getByText("Returned to the account owner")).toBeDefined();
    expect(screen.queryByText(/^Was/)).toBeNull();
  });

  it("FH-013: each entry carries who made the change and when", () => {
    renderDisclosure();
    fireEvent.click(toggle());
    expect(screen.getByText(/Case Manager/)).toBeDefined();
  });

  it("FH-014: an entry with no recorded actor says so rather than showing a blank", () => {
    renderDisclosure({ entries: [valueEntry({ actorName: null, actorId: null })] });
    fireEvent.click(toggle());
    expect(screen.getByText(/Not recorded/)).toBeDefined();
  });

  it("FH-015: offers no edit or delete affordance, including a disabled one", () => {
    const { container } = renderDisclosure({
      entries: [valueEntry(), valueEntry({ changeKind: "control", newControlledBy: "owner", at: MIDDLE })],
    });
    fireEvent.click(toggle());
    const region = container.querySelector("#history-location")!;
    expect(region.querySelectorAll("button, input, select, textarea, a").length).toBe(0);
    expect(region.textContent).not.toMatch(/edit|delete|remove|undo|restore/i);
  });

  it("FH-016: no rendered copy contains an em-dash", () => {
    const { container } = renderDisclosure();
    fireEvent.click(toggle());
    expect(container.textContent).not.toContain("—");
  });
});
