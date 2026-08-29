import { useState } from "react";
import type { MaintainerGuideStep } from "../../lib/maintainerTypes";
import { MaintainerApiError } from "../../services/maintainerApi";

/**
 * The guide step editor (007 T020, US1, FR-013).
 *
 * Two things this component exists to get right:
 *
 *   1. **A rejected step is reported on that step.** The server returns `stepIndex` and
 *      `field`; this puts the message under the offending input rather than above a list
 *      of twenty. A maintainer told "a step is invalid" above the list has to re-read
 *      every step to find out which one.
 *   2. **A refusal never discards typed work.** Publishing failing leaves every step
 *      exactly as typed. Losing eight steps to one missing success hint is the failure
 *      mode that makes people stop using an editor.
 *
 * Steps are ordered and the order is the guide, so reordering is explicit (move up /
 * move down) rather than drag-and-drop — no new dependency, and it works from a keyboard.
 */

const MAX_STEPS = 20;
const MAX_INSTRUCTION = 500;
const MAX_SUCCESS_HINT = 300;
const MAX_CHANGE_NOTE = 300;

interface DraftStep extends MaintainerGuideStep {
  /** Stable across reorder and removal so React keeps input focus and per-step errors
   * stay attached to the step they describe rather than to a position. */
  id: number;
}

/** Which step and field the server refused, if any. */
interface StepError {
  stepIndex: number;
  field: string | null;
  message: string;
}

let nextId = 1;
function emptyStep(): DraftStep {
  return { id: nextId++, instruction: "", successHint: "" };
}

interface Props {
  heading: string;
  /** The currently active version, or `null` when this category has no guide yet. Shown
   * so the maintainer knows publishing supersedes something. */
  currentVersion: number | null;
  submitLabel?: string;
  onCancel: () => void;
  onPublish: (steps: MaintainerGuideStep[], changeNote: string) => Promise<void>;
  onError: (error: unknown) => void;
}

export function GuideEditor({
  heading,
  currentVersion,
  submitLabel,
  onCancel,
  onPublish,
  onError,
}: Props) {
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep()]);
  const [changeNote, setChangeNote] = useState("");
  const [stepError, setStepError] = useState<StepError | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  function updateStep(id: number, patch: Partial<MaintainerGuideStep>) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
    // Editing clears the message on that step: it described a value that no longer
    // exists. Leaving it up would have the maintainer fixing something already fixed.
    setStepError(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
    setStepError(null);
  }

  async function publish() {
    setIsPublishing(true);
    setStepError(null);
    try {
      await onPublish(
        steps.map(({ instruction, successHint }) => ({ instruction, successHint })),
        changeNote.trim(),
      );
    } catch (err) {
      if (err instanceof MaintainerApiError && err.stepIndex !== null) {
        // The whole reason FR-013 asks the server for an index: put it on the step.
        setStepError({ stepIndex: err.stepIndex, field: err.field, message: err.message });
      } else {
        onError(err);
      }
      // Nothing is cleared. The steps stay as typed.
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="text-sm text-gray-600">
          {currentVersion === null
            ? "This will be version 1. Reporters see these steps in order, and confirm each one before moving on."
            : `Version ${currentVersion} is active now. Publishing creates version ${currentVersion + 1} and makes it the active one. Version ${currentVersion} stays in the history.`}
        </p>
      </div>

      <ol className="flex flex-col gap-5">
        {steps.map((step, index) => (
          <li key={step.id} className="flex flex-col gap-3 border-l-2 border-gray-200 pl-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm tabular-nums text-gray-600">Step {index + 1}</span>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSteps((current) => current.filter((s) => s.id !== step.id));
                    setStepError(null);
                  }}
                  disabled={steps.length === 1}
                  className="text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              What the reporter should do
              <textarea
                className="rounded border border-gray-300 px-3 py-2"
                rows={2}
                value={step.instruction}
                maxLength={MAX_INSTRUCTION}
                onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
              />
              {stepError?.stepIndex === index && stepError.field === "instruction" && (
                <span role="alert" className="text-xs text-red-600">
                  {stepError.message}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              How they know it worked
              <textarea
                className="rounded border border-gray-300 px-3 py-2"
                rows={2}
                value={step.successHint}
                maxLength={MAX_SUCCESS_HINT}
                onChange={(e) => updateStep(step.id, { successHint: e.target.value })}
              />
              <span className="text-xs text-gray-600">
                What the reporter should see if this step fixed the problem.
              </span>
              {stepError?.stepIndex === index && stepError.field === "successHint" && (
                <span role="alert" className="text-xs text-red-600">
                  {stepError.message}
                </span>
              )}
            </label>

            {/* A step-level refusal with no field named still belongs on its step. */}
            {stepError?.stepIndex === index && stepError.field === null && (
              <p role="alert" className="text-xs text-red-600">
                {stepError.message}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setSteps((current) => [...current, emptyStep()])}
          disabled={steps.length >= MAX_STEPS}
          className="self-start text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          Add a step
        </button>
        {steps.length >= MAX_STEPS && (
          <span className="text-xs text-gray-600">
            A guide holds up to {MAX_STEPS} steps. Longer than that and the reporter stops
            following it.
          </span>
        )}
      </div>

      <label className="flex max-w-xl flex-col gap-1 text-sm">
        What changed, and why
        <input
          type="text"
          className="rounded border border-gray-300 px-3 py-2"
          value={changeNote}
          maxLength={MAX_CHANGE_NOTE}
          onChange={(e) => setChangeNote(e.target.value)}
        />
        <span className="text-xs text-gray-600">
          Optional. Recorded against this version so a later maintainer can see why it was
          written this way.
        </span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={isPublishing}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPublishing ? "Publishing…" : (submitLabel ?? "Publish new version")}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
      </div>
    </section>
  );
}
