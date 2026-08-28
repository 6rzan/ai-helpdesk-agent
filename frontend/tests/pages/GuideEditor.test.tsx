import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuideEditor } from "../../src/pages/maintainer/GuideEditor";
import { MaintainerApiError } from "../../src/services/maintainerApi";

// T020 (007). FR-013, research.md R12.
//
// The requirement is not "show an error" — it is "show it on the step the maintainer is
// looking at". A message above a list of twenty steps makes the maintainer re-read all
// twenty to find the one that is wrong, which is the failure this component exists to
// avoid.

function renderEditor(overrides: Partial<Parameters<typeof GuideEditor>[0]> = {}) {
  const onPublish = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const onError = vi.fn();
  const result = render(
    <GuideEditor
      heading="New guide version for Printer"
      currentVersion={2}
      onCancel={onCancel}
      onPublish={onPublish}
      onError={onError}
      {...overrides}
    />,
  );
  return { ...result, onPublish, onCancel, onError };
}

function instructionInputs() {
  return screen.getAllByLabelText(/what the reporter should do/i) as HTMLTextAreaElement[];
}

function hintInputs() {
  return screen.getAllByLabelText(/how they know it worked/i) as HTMLTextAreaElement[];
}

function typeStep(index: number, instruction: string, hint: string) {
  const instructionInput = instructionInputs()[index];
  const hintInput = hintInputs()[index];
  if (!instructionInput || !hintInput) throw new Error(`no step at index ${index}`);
  fireEvent.change(instructionInput, { target: { value: instruction } });
  fireEvent.change(hintInput, { target: { value: hint } });
}

function addStep() {
  fireEvent.click(screen.getByRole("button", { name: /add a step/i }));
}

function publish() {
  fireEvent.click(screen.getByRole("button", { name: /publish new version/i }));
}

function stepError(index: number, field: "instruction" | "successHint", message = "Refused.") {
  return new MaintainerApiError(400, "GUIDE_STEP_INVALID", message, {
    stepIndex: index,
    field,
  });
}

describe("GuideEditor — composing a guide", () => {
  it("GE-001: starts with one step and numbers steps the way a person counts", () => {
    renderEditor();
    expect(instructionInputs()).toHaveLength(1);
    expect(screen.getByText("Step 1")).toBeTruthy();
  });

  it("GE-002: adding and removing steps renumbers the rest", () => {
    renderEditor();
    addStep();
    addStep();
    expect(screen.getByText("Step 3")).toBeTruthy();

    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "Second instruction here.", "Second hint.");
    typeStep(2, "Third instruction here.", "Third hint.");

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[1] as HTMLElement);

    expect(instructionInputs()).toHaveLength(2);
    expect(screen.queryByText("Step 3")).toBeNull();
    // The step that was third is now second, with its text intact.
    expect(instructionInputs()[1]?.value).toBe("Third instruction here.");
  });

  it("GE-003: the last remaining step cannot be removed", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
  });

  it("GE-004: reordering moves the step and its text together", () => {
    renderEditor();
    addStep();
    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "Second instruction here.", "Second hint.");

    fireEvent.click(screen.getAllByRole("button", { name: /move up/i })[1] as HTMLElement);

    expect(instructionInputs()[0]?.value).toBe("Second instruction here.");
    expect(hintInputs()[0]?.value).toBe("Second hint.");
  });

  it("GE-005: says what publishing does to the active version", () => {
    renderEditor({ currentVersion: 2 });
    expect(screen.getByText(/version 3/i)).toBeTruthy();
    expect(screen.getByText(/version 2 stays in the history/i)).toBeTruthy();
  });

  it("GE-006: a first guide is described as version 1, not as replacing something", () => {
    renderEditor({ currentVersion: null });
    expect(screen.getByText(/this will be version 1/i)).toBeTruthy();
  });

  it("GE-007: publishes the steps in order with the change note", async () => {
    const { onPublish } = renderEditor();
    addStep();
    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "Second instruction here.", "Second hint.");
    fireEvent.change(screen.getByLabelText(/what changed, and why/i), {
      target: { value: "Added the driver step." },
    });

    publish();

    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    expect(onPublish.mock.calls[0]?.[0]).toEqual([
      { instruction: "First instruction here.", successHint: "First hint." },
      { instruction: "Second instruction here.", successHint: "Second hint." },
    ]);
    expect(onPublish.mock.calls[0]?.[1]).toBe("Added the driver step.");
  });
});

describe("GuideEditor — a rejected step is reported on that step (FR-013)", () => {
  it("GE-008: the message appears under the offending instruction", async () => {
    const { onPublish } = renderEditor();
    addStep();
    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "", "Second hint.");
    onPublish.mockRejectedValue(stepError(1, "instruction", "Step 2 needs an instruction."));

    publish();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Step 2 needs an instruction.");
    // Inside the second step's instruction label, not floating above the list.
    const label = instructionInputs()[1]?.closest("label");
    expect(label?.contains(alert)).toBe(true);
  });

  it("GE-009: a success-hint failure lands on the hint, not the instruction", async () => {
    const { onPublish } = renderEditor();
    typeStep(0, "First instruction here.", "");
    onPublish.mockRejectedValue(stepError(0, "successHint", "Step 1 needs a success hint."));

    publish();

    const alert = await screen.findByRole("alert");
    expect(hintInputs()[0]?.closest("label")?.contains(alert)).toBe(true);
    expect(instructionInputs()[0]?.closest("label")?.contains(alert)).toBe(false);
  });

  it("GE-010: only one step is marked — the others are not implicated", async () => {
    const { onPublish } = renderEditor();
    addStep();
    addStep();
    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "", "Second hint.");
    typeStep(2, "Third instruction here.", "Third hint.");
    onPublish.mockRejectedValue(stepError(1, "instruction"));

    publish();

    await screen.findByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("GE-011: a refusal discards nothing that was typed", async () => {
    const { onPublish } = renderEditor();
    addStep();
    addStep();
    typeStep(0, "First instruction here.", "First hint.");
    typeStep(1, "", "Second hint.");
    typeStep(2, "Third instruction here.", "Third hint.");
    fireEvent.change(screen.getByLabelText(/what changed, and why/i), {
      target: { value: "Rewrote the whole guide." },
    });
    onPublish.mockRejectedValue(stepError(1, "instruction"));

    publish();
    await screen.findByRole("alert");

    // Losing eight steps to one missing hint is what makes people stop using an editor.
    expect(instructionInputs()).toHaveLength(3);
    expect(instructionInputs()[2]?.value).toBe("Third instruction here.");
    expect(screen.getByLabelText(/what changed, and why/i)).toHaveValue(
      "Rewrote the whole guide.",
    );
  });

  it("GE-012: editing the offending step clears its message", async () => {
    const { onPublish } = renderEditor();
    typeStep(0, "", "First hint.");
    onPublish.mockRejectedValue(stepError(0, "instruction"));

    publish();
    await screen.findByRole("alert");

    typeStep(0, "A real instruction now, long enough to pass.", "First hint.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("GE-013: publishing again after a fix is allowed — the button is not left disabled", async () => {
    const { onPublish } = renderEditor();
    typeStep(0, "", "First hint.");
    onPublish.mockRejectedValue(stepError(0, "instruction"));
    publish();
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: /publish new version/i })).not.toBeDisabled();
  });

  it("GE-014: an error with no step index goes to the caller, not onto a step", async () => {
    // A count-level 422 or a rotated key is not about any one step, and pinning it to
    // step 1 would send the maintainer to fix something that is not wrong.
    const { onPublish, onError } = renderEditor();
    typeStep(0, "First instruction here.", "First hint.");
    const error = new MaintainerApiError(422, "INVALID_GUIDE_STEPS", "A guide needs at least one step.");
    onPublish.mockRejectedValue(error);

    publish();

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("GuideEditor — the server stays the enforcement point", () => {
  it("GE-015: the step maximum is mirrored as guidance, and publishing is never blocked locally on step content", async () => {
    const { onPublish } = renderEditor();
    for (let i = 0; i < 19; i += 1) addStep();
    expect(instructionInputs()).toHaveLength(20);
    expect(screen.getByRole("button", { name: /add a step/i })).toBeDisabled();
    expect(screen.getByText(/up to 20 steps/i)).toBeTruthy();

    // Every step is empty, and the request still goes out: the server decides.
    publish();
    await waitFor(() => expect(onPublish).toHaveBeenCalled());
  });
});
