import { useEffect, useState } from "react";
import type {
  MaintainerCategory,
  MaintainerGuideStep,
  MaintainerGuideVersion,
} from "../../lib/maintainerTypes";
import {
  MaintainerApiError,
  listMaintainerGuideVersions,
  type MaintainerCredentials,
} from "../../services/maintainerApi";
import { GuideEditor } from "./GuideEditor";

/**
 * The console's forms: create, edit metadata, retire, and read a guide's version history
 * (007 T019, US1).
 *
 * Split out of `CategoryListPage` so neither file passes 500 lines. The page owns the
 * list, the row, and which view is showing; this file owns the four screens a view can
 * switch to. They are separated along that seam rather than by size alone: the page
 * decides what is being done, and these decide how it is entered.
 */

const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

/** The server owns these limits; they are mirrored here only so the maintainer is told
 * before they hit one rather than after. The server stays the enforcement point. */
const LIMITS = {
  slug: 60,
  displayName: 60,
  descriptionMin: 10,
  descriptionMax: 500,
  changeNote: 300,
} as const;

/**
 * Client-side slug check, run **before** the request rather than after.
 *
 * FR-006's edge case asks for the rule to be reported on the offending field before the
 * change is attempted. A malformed slug that reaches the server comes back as a generic
 * validation failure, which tells the maintainer that something is wrong but not what
 * they should type instead.
 */
function slugProblem(slug: string, existing: MaintainerCategory[]): string | null {
  if (slug.length === 0) return "Enter a short machine name for this category.";
  if (slug.length > LIMITS.slug) return `Keep the machine name to ${LIMITS.slug} characters or fewer.`;
  if (!SLUG_PATTERN.test(slug)) {
    return "Use lowercase letters, numbers and underscores only, starting with a letter. For example: email_calendar.";
  }
  if (existing.some((category) => category.name === slug)) {
    // Named against the loaded list so it is caught while typing. The server's 409 is
    // still handled below, because another maintainer may have taken the name since.
    return "A category with this machine name already exists. Choose a different one.";
  }
  return null;
}
interface CategoryValues {
  name: string;
  displayName: string;
  classificationDescription: string;
}

interface CategoryFormProps {
  heading: string;
  existing: MaintainerCategory[];
  onCancel: () => void;
  onSubmit: (
    values: CategoryValues,
    steps: MaintainerGuideStep[],
    changeNote: string,
  ) => Promise<void>;
  onError: (error: unknown) => void;
}

/** Creating a category means creating its first guide too, so this form composes the
 * step editor rather than duplicating it. */
export function CategoryForm({ heading, existing, onCancel, onSubmit, onError }: CategoryFormProps) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [classificationDescription, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{heading}</h1>

      <div className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            type="text"
            className="rounded border border-gray-300 px-3 py-2"
            value={displayName}
            maxLength={LIMITS.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <span className="text-xs text-gray-600">
            What staff and reporters see. Up to {LIMITS.displayName} characters.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Machine name
          <input
            type="text"
            className="rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            onBlur={() => setNameError(slugProblem(name, existing))}
          />
          <span className="text-xs text-gray-600">
            Lowercase letters, numbers and underscores, starting with a letter. It cannot be
            changed later.
          </span>
          {nameError && (
            <span role="alert" className="text-xs text-red-600">
              {nameError}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          What belongs in this category
          <textarea
            className="rounded border border-gray-300 px-3 py-2"
            rows={3}
            value={classificationDescription}
            maxLength={LIMITS.descriptionMax}
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="text-xs text-gray-600">
            Between {LIMITS.descriptionMin} and {LIMITS.descriptionMax} characters. This is what
            decides which reports land here, so describe the problems it covers.
          </span>
        </label>
      </div>

      <GuideEditor
        heading="First guide"
        currentVersion={null}
        submitLabel="Create category"
        onCancel={onCancel}
        onPublish={async (steps, changeNote) => {
          const problem = slugProblem(name, existing);
          if (problem) {
            setNameError(problem);
            // Thrown so the editor does not clear itself: the maintainer's steps are
            // still wanted, and only the machine name needs fixing.
            throw new Error(problem);
          }
          await onSubmit({ name, displayName, classificationDescription }, steps, changeNote);
        }}
        onError={(err) => {
          if (
            err instanceof MaintainerApiError &&
            (err.code === "CATEGORY_EXISTS" || err.code === "CATEGORY_ALREADY_EXISTS")
          ) {
            // Another maintainer took the name between the local check and this request.
            setNameError("A category with this machine name already exists. Choose a different one.");
            return;
          }
          onError(err);
        }}
      />
    </section>
  );
}

interface MetadataFormProps {
  category: MaintainerCategory;
  onCancel: () => void;
  onSubmit: (values: { displayName?: string; classificationDescription?: string }) => Promise<void>;
  onError: (error: unknown) => void;
}

export function CategoryMetadataForm({ category, onCancel, onSubmit, onError }: MetadataFormProps) {
  const [displayName, setDisplayName] = useState(category.displayName);
  const [classificationDescription, setDescription] = useState(category.classificationDescription);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      await onSubmit({ displayName, classificationDescription });
    } catch (err) {
      onError(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Edit {category.displayName}</h1>
        <p className="font-mono text-xs text-gray-500">{category.name}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          type="text"
          className="rounded border border-gray-300 px-3 py-2"
          value={displayName}
          maxLength={LIMITS.displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        What belongs in this category
        <textarea
          className="rounded border border-gray-300 px-3 py-2"
          rows={3}
          value={classificationDescription}
          maxLength={LIMITS.descriptionMax}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="text-xs text-gray-600">
          Changing this changes which new reports land here. Existing tickets keep the category
          they already have.
        </span>
      </label>

      <p className="text-sm text-gray-600">
        The machine name cannot be changed. Existing tickets and guides refer to it.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
      </div>
    </section>
  );
}

interface RetireProps {
  category: MaintainerCategory;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onError: (error: unknown) => void;
}

/** The consequence is stated **before** the confirming click, not reported after it.
 * Retiring is reversible only by a developer, so the maintainer needs to know what it
 * does while they can still change their mind. */
export function RetireConfirmation({ category, onCancel, onConfirm, onError }: RetireProps) {
  const [isRetiring, setIsRetiring] = useState(false);

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Retire {category.displayName}?</h1>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-gray-700">
        <li>Tickets already in this category keep it, and staff can still work on them.</li>
        <li>New reports will stop being classified into it.</li>
        <li>It stays visible in this list, marked as retired, so nobody recreates it by mistake.</li>
      </ul>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isRetiring}
          onClick={async () => {
            setIsRetiring(true);
            try {
              await onConfirm();
            } catch (err) {
              onError(err);
            } finally {
              setIsRetiring(false);
            }
          }}
          className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {isRetiring ? "Retiring…" : `Retire ${category.displayName}`}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
      </div>
    </section>
  );
}

interface HistoryProps {
  category: MaintainerCategory;
  credentials: MaintainerCredentials;
  onBack: () => void;
  onError: (error: unknown) => void;
}

/** Read-only by construction. There is no revert, restore, or edit control, because no
 * such endpoint exists: a published version is what some reporter was actually told to
 * do, and the record of that does not change. */
export function GuideVersionHistory({ category, credentials, onBack, onError }: HistoryProps) {
  const [versions, setVersions] = useState<MaintainerGuideVersion[] | null>(null);
  const [openVersion, setOpenVersion] = useState<number | null>(null);

  useEffect(() => {
    listMaintainerGuideVersions(credentials, category.name)
      .then(({ versions: loaded }) => setVersions([...loaded].sort((a, b) => b.version - a.version)))
      .catch(onError);
  }, [credentials, category.name, onError]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{category.displayName} guide history</h1>
        <p className="font-mono text-xs text-gray-500">{category.name}</p>
      </div>

      {versions === null && <p className="text-sm text-gray-600">Loading versions…</p>}

      {versions !== null && (
        <ul className="divide-y divide-gray-200 border-y border-gray-200">
          {versions.map((version) => (
            <li key={version.version} className="flex flex-col gap-2 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-base tabular-nums text-gray-900">
                  Version {version.version}
                </span>
                {version.active && <span className="text-xs text-emerald-700">Active</span>}
              </div>
              <p className="text-sm tabular-nums text-gray-600">
                {version.changedBy} · {new Date(version.changedAt).toLocaleString()}
              </p>
              {version.changeNote && (
                <p className="max-w-prose text-sm text-gray-700">{version.changeNote}</p>
              )}
              <button
                type="button"
                onClick={() =>
                  setOpenVersion(openVersion === version.version ? null : version.version)
                }
                className="self-start text-sm text-blue-600 hover:underline"
              >
                {openVersion === version.version ? "Hide steps" : "Show steps"}
              </button>
              {openVersion === version.version && (
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-gray-700">
                  {version.steps.map((step, index) => (
                    <li key={index} className="flex flex-col gap-0.5">
                      <span>{step.instruction}</span>
                      <span className="text-xs text-gray-600">
                        Worked when: {step.successHint}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onBack} className="self-start text-sm text-blue-600 hover:underline">
        Back to categories
      </button>
    </section>
  );
}
