import { useCallback, useEffect, useState } from "react";
import type {
  MaintainerCategory,
} from "../../lib/types";
import {
  createMaintainerCategory,
  listMaintainerCategories,
  publishMaintainerGuide,
  retireMaintainerCategory,
  updateMaintainerCategory,
  type MaintainerCredentials,
} from "../../services/maintainerApi";
import { GuideEditor } from "./GuideEditor";
import {
  CategoryForm,
  CategoryMetadataForm,
  GuideVersionHistory,
  RetireConfirmation,
} from "./CategoryForms";

/**
 * The console's home: every category, and the actions available on one (007 T019, US1).
 *
 * A divided list rather than a grid of cards. At six-or-so rows, card-boxing each
 * category adds a border per row and says nothing the divider does not.
 *
 * Retired categories stay visible, rendered inert in neutral. Hiding them would leave a
 * maintainer trying to recreate a category that already exists and being refused for a
 * duplicate slug they cannot see.
 */


type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; category: MaintainerCategory }
  | { kind: "guide"; category: MaintainerCategory }
  | { kind: "versions"; category: MaintainerCategory }
  | { kind: "retire"; category: MaintainerCategory };

interface Props {
  credentials: MaintainerCredentials;
  /** Returns `true` when the shell consumed the error (rotated key, administration
   * switched off, cooling off), in which case this screen shows nothing of its own. */
  onActionError: (error: unknown) => boolean;
}

export function CategoryListPage({ credentials, onActionError }: Props) {
  const [categories, setCategories] = useState<MaintainerCategory[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const report = useCallback(
    (err: unknown) => {
      if (onActionError(err)) return;
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    },
    [onActionError],
  );

  const reload = useCallback(async () => {
    try {
      const { categories: loaded } = await listMaintainerCategories(credentials);
      setCategories(loaded);
    } catch (err) {
      report(err);
    }
  }, [credentials, report]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function backToList(message?: string) {
    setView({ kind: "list" });
    setError(null);
    setConfirmation(message ?? null);
    void reload();
  }

  if (view.kind === "create") {
    return (
      <CategoryForm
        heading="Add a category"
        existing={categories ?? []}
        onCancel={() => setView({ kind: "list" })}
        onSubmit={async (values, steps, changeNote) => {
          await createMaintainerCategory(credentials, {
            name: values.name,
            displayName: values.displayName,
            classificationDescription: values.classificationDescription,
            guide: changeNote ? { steps, changeNote } : { steps },
          });
          backToList(`Added the category "${values.displayName}" with its first guide.`);
        }}
        onError={report}
      />
    );
  }

  if (view.kind === "edit") {
    return (
      <CategoryMetadataForm
        category={view.category}
        onCancel={() => setView({ kind: "list" })}
        onSubmit={async (values) => {
          await updateMaintainerCategory(credentials, view.category.name, values);
          backToList(`Updated "${values.displayName ?? view.category.displayName}".`);
        }}
        onError={report}
      />
    );
  }

  if (view.kind === "guide") {
    return (
      <GuideEditor
        heading={`New guide version for ${view.category.displayName}`}
        currentVersion={view.category.activeGuideVersion}
        onCancel={() => setView({ kind: "list" })}
        onPublish={async (steps, changeNote) => {
          const result = await publishMaintainerGuide(
            credentials,
            view.category.name,
            changeNote ? { steps, changeNote } : { steps },
          );
          backToList(
            `Published version ${result.version} of the ${view.category.displayName} guide. It is now the active version.`,
          );
        }}
        onError={report}
      />
    );
  }

  if (view.kind === "versions") {
    return (
      <GuideVersionHistory
        category={view.category}
        credentials={credentials}
        onBack={() => setView({ kind: "list" })}
        onError={report}
      />
    );
  }

  if (view.kind === "retire") {
    return (
      <RetireConfirmation
        category={view.category}
        onCancel={() => setView({ kind: "list" })}
        onConfirm={async () => {
          await retireMaintainerCategory(credentials, view.category.name);
          backToList(`Retired "${view.category.displayName}".`);
        }}
        onError={report}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Categories</h1>
        <button
          type="button"
          onClick={() => {
            setConfirmation(null);
            setView({ kind: "create" });
          }}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
        >
          Add a category
        </button>
      </div>

      {confirmation && (
        <p role="status" className="text-sm text-emerald-700">
          {confirmation}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {categories === null && <p className="text-sm text-gray-600">Loading categories…</p>}

      {categories !== null && categories.length === 0 && (
        <p className="text-sm text-gray-600">
          There are no categories yet. Add one to start classifying reports.
        </p>
      )}

      {categories !== null && categories.length > 0 && (
        <ul className="divide-y divide-gray-200 border-y border-gray-200">
          {categories.map((category) => (
            <CategoryRow
              key={category.name}
              category={category}
              onEdit={() => setView({ kind: "edit", category })}
              onNewGuide={() => setView({ kind: "guide", category })}
              onVersions={() => setView({ kind: "versions", category })}
              onRetire={() => setView({ kind: "retire", category })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RowProps {
  category: MaintainerCategory;
  onEdit: () => void;
  onNewGuide: () => void;
  onVersions: () => void;
  onRetire: () => void;
}

function CategoryRow({ category, onEdit, onNewGuide, onVersions, onRetire }: RowProps) {
  return (
    <li className={`flex flex-col gap-2 py-4 ${category.retired ? "text-gray-500" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-base ${category.retired ? "text-gray-500" : "text-gray-900"}`}>
          {category.displayName}
        </span>
        <span className="font-mono text-xs text-gray-500">{category.name}</span>
        {category.retired && <span className="text-xs text-gray-500">Retired</span>}
      </div>

      <p className="max-w-prose text-sm text-gray-600">{category.classificationDescription}</p>

      <p className="text-sm tabular-nums text-gray-600">
        {category.activeGuideVersion === null
          ? "No guide published yet"
          : `Guide version ${category.activeGuideVersion}`}
      </p>

      {category.mandated && (
        // Stated once, as text. FR-012 requires the retire action not to be offered at
        // all on these six, so there is no control here to explain — a sentence is what
        // replaces it.
        <p className="text-sm text-gray-600">
          One of the six categories the help desk always covers. It cannot be retired.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={onEdit} className="text-blue-600 hover:underline">
          Edit details
        </button>
        <button type="button" onClick={onNewGuide} className="text-blue-600 hover:underline">
          New guide version
        </button>
        <button type="button" onClick={onVersions} className="text-blue-600 hover:underline">
          Version history
        </button>
        {/*
          No retire control on a mandated category, and none on one already retired.
          Absent, not disabled: a greyed control invites a click and then explains
          itself, which is a worse answer than never offering the action.
        */}
        {!category.mandated && !category.retired && (
          <button type="button" onClick={onRetire} className="text-red-600 hover:underline">
            Retire
          </button>
        )}
      </div>
    </li>
  );
}
