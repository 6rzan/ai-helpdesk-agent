import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProfileFieldHistoryEntry,
  ProfileFieldName,
  ProfileFieldResults,
  ProfileFieldSubmission,
  RemoteAccessId,
  SupportProfile,
} from "../../lib/types";
import {
  getStaffProfileFieldHistory,
  releaseStaffProfileField,
  saveStaffProfileFields,
} from "../../services/api";
import { ProfileField } from "./ProfileField";
import { FieldHistoryDisclosure } from "./FieldHistoryDisclosure";

/**
 * The three support fields, staff-authoritative (007 T037, FR-016, FR-019, FR-029).
 *
 * Three decisions worth stating, because the obvious implementation gets each wrong:
 *
 *   1. **Every field carries the `setAt` it was loaded with.** That token, not a
 *      page-wide version, is what makes a save refuse to overwrite a change it never
 *      saw. A save of three fields is three independent decisions and can come back
 *      three different ways, which is why the response is a `200` with a map rather
 *      than a status code.
 *   2. **A conflict never clears the box.** The staff member's typed text stays exactly
 *      where it is, the current value is shown next to it, and saving again wins. The
 *      version that reloads the field on conflict destroys work to report a problem.
 *   3. **No optimistic UI.** Nothing here shows a save, a lock, or a release as done
 *      until the server has said so, because every one of the three can be refused.
 */

const FIELD_LABELS: Record<ProfileFieldName, string> = {
  location: "Location",
  hardware: "Device or asset",
  remoteAccessIds: "Remote access IDs",
};

const EMPTY_REMOTE: RemoteAccessId = { tool: "", id: "" };

interface Drafts {
  location: string;
  hardware: string;
  remoteAccessIds: RemoteAccessId[];
}

/** The `setAt` each field held when the page loaded it. `null` says "never set", which
 * is a real token rather than a missing one: it is what stops a save from silently
 * overwriting a field that was empty at load and has been filled since. */
type Tokens = Record<ProfileFieldName, string | null>;

interface Props {
  accountId: string;
  profile: SupportProfile;
  /** Called with whatever the server returned, so the page holds one profile rather
   * than two copies that can disagree. */
  onProfileChange: (profile: SupportProfile) => void;
}

function draftsFrom(profile: SupportProfile): Drafts {
  return {
    location: profile.location,
    hardware: profile.hardware,
    // Always one row to type into, so the field has something to label and staff do not
    // have to find an "add" control before they can enter the first ID.
    remoteAccessIds: profile.remoteAccessIds.length
      ? profile.remoteAccessIds.map((entry) => ({ ...entry }))
      : [{ ...EMPTY_REMOTE }],
  };
}

function tokensFrom(profile: SupportProfile): Tokens {
  const state = profile.fieldState;
  return {
    location: state?.location.setAt ?? null,
    hardware: state?.hardware.setAt ?? null,
    remoteAccessIds: state?.remoteAccessIds.setAt ?? null,
  };
}

export function SupportDetailsSection({ accountId, profile, onProfileChange }: Props) {
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFrom(profile));
  const [tokens, setTokens] = useState<Tokens>(() => tokensFrom(profile));
  const [results, setResults] = useState<ProfileFieldResults>({});
  const [history, setHistory] = useState<Partial<Record<ProfileFieldName, ProfileFieldHistoryEntry[]>>>({});
  const [loadingHistory, setLoadingHistory] = useState<ProfileFieldName>();
  const [isSaving, setIsSaving] = useState(false);
  const [releasing, setReleasing] = useState<ProfileFieldName>();
  const [requestError, setRequestError] = useState<string>();

  // The page loads the profile after mount, so the first render sees an empty one. Seed
  // the drafts and tokens from whatever arrives, and again after a release, which
  // changes control without changing what was typed.
  //
  // The ref exists because a save also delivers a new profile, and reseeding from it
  // would wipe the typed value of any field that came back as a conflict. `save()`
  // claims the profile it is about to hand up, then sets the drafts itself.
  const seededRef = useRef<SupportProfile>();
  useEffect(() => {
    if (seededRef.current === profile) return;
    seededRef.current = profile;
    setDrafts(draftsFrom(profile));
    setTokens(tokensFrom(profile));
  }, [profile]);

  const controlOf = useCallback(
    (field: ProfileFieldName) => profile.fieldState?.[field].controlledBy ?? "owner",
    [profile],
  );

  async function save() {
    setIsSaving(true);
    setRequestError(undefined);
    try {
      const fields: Partial<Record<ProfileFieldName, ProfileFieldSubmission>> = {
        location: { value: drafts.location.trim(), expectedSetAt: tokens.location },
        hardware: { value: drafts.hardware.trim(), expectedSetAt: tokens.hardware },
        remoteAccessIds: {
          value: drafts.remoteAccessIds
            .map((entry) => ({ tool: entry.tool.trim(), id: entry.id.trim() }))
            .filter((entry) => entry.tool || entry.id),
          expectedSetAt: tokens.remoteAccessIds,
        },
      };
      const response = await saveStaffProfileFields(accountId, fields);
      setResults(response.results);

      // An applied field takes the saved value and the new token, so a second save is
      // not a conflict against the write that just succeeded. A conflicted field keeps
      // what was typed and also takes the new token, which is what makes "save again to
      // replace it" true rather than a second refusal.
      const conflicted = (Object.keys(response.results) as ProfileFieldName[]).filter(
        (field) => response.results[field]?.outcome === "conflict",
      );
      seededRef.current = response.profile;
      setTokens(tokensFrom(response.profile));
      setDrafts((current) => {
        const next = draftsFrom(response.profile);
        for (const field of conflicted) {
          if (field === "remoteAccessIds") next.remoteAccessIds = current.remoteAccessIds;
          else next[field] = current[field];
        }
        return next;
      });
      onProfileChange(response.profile);
    } catch (err) {
      // A refused request is not a per-field outcome and is not pretended to be one.
      setRequestError(err instanceof Error ? err.message : "Unable to save these details");
    } finally {
      setIsSaving(false);
    }
  }

  async function release(field: ProfileFieldName) {
    setReleasing(field);
    setRequestError(undefined);
    try {
      const response = await releaseStaffProfileField(accountId, field);
      onProfileChange(response.profile);
      // The field's history now has one more entry in it, so anything cached is stale.
      setHistory((current) => ({ ...current, [field]: undefined }));
      setResults((current) => ({ ...current, [field]: undefined }));
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Unable to return this field");
    } finally {
      setReleasing(undefined);
    }
  }

  async function loadHistory(field: ProfileFieldName) {
    setLoadingHistory(field);
    try {
      const response = await getStaffProfileFieldHistory(accountId, field);
      setHistory((current) => ({ ...current, [field]: response.history }));
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Unable to load this field's history");
    } finally {
      setLoadingHistory(undefined);
    }
  }

  function historyFor(field: ProfileFieldName) {
    return (
      <FieldHistoryDisclosure
        field={field}
        label={FIELD_LABELS[field]}
        entries={history[field] ?? null}
        onOpen={() => void loadHistory(field)}
        isLoading={loadingHistory === field}
      />
    );
  }

  function fieldProps(field: ProfileFieldName) {
    return {
      label: FIELD_LABELS[field],
      state: profile.fieldState?.[field],
      audience: "staff" as const,
      outcome: results[field],
      onRelease: controlOf(field) === "staff" ? () => void release(field) : undefined,
      isReleasing: releasing === field,
      history: historyFor(field),
    };
  }

  return (
    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">Support details</h2>
      <p className="mt-1 text-xs text-gray-600">
        Saving a field here makes your value the one the account owner sees, and stops
        them editing it until you return it.
      </p>

      <div className="mt-4 flex flex-col gap-5">
        <ProfileField
          {...fieldProps("location")}
          id="staff-location"
          readOnlyValue={profile.location || "Not provided"}
        >
          <input
            id="staff-location"
            value={drafts.location}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, location: event.target.value }))
            }
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </ProfileField>

        <ProfileField
          {...fieldProps("hardware")}
          id="staff-hardware"
          readOnlyValue={profile.hardware || "Not provided"}
        >
          <textarea
            id="staff-hardware"
            value={drafts.hardware}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, hardware: event.target.value }))
            }
            className="block min-h-20 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </ProfileField>

        {/* One field, not a field per row: the byline, the lock, and the release all sit
            on the list as a whole, because that is what the server versions. */}
        <ProfileField
          {...fieldProps("remoteAccessIds")}
          id="staff-remote-0-tool"
          readOnlyValue={
            profile.remoteAccessIds.length
              ? profile.remoteAccessIds.map((entry) => `${entry.tool}: ${entry.id}`).join(", ")
              : "Not provided"
          }
          hint="Each row is one tool and the ID it shows on this machine."
        >
          <RemoteAccessRows
            rows={drafts.remoteAccessIds}
            onChange={(rows) => setDrafts((current) => ({ ...current, remoteAccessIds: rows }))}
          />
        </ProfileField>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save support details"}
        </button>
      </div>

      {requestError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {requestError}
        </p>
      )}
    </section>
  );
}

function RemoteAccessRows({
  rows,
  onChange,
}: {
  rows: RemoteAccessId[];
  onChange: (rows: RemoteAccessId[]) => void;
}) {
  function update(index: number, patch: Partial<RemoteAccessId>) {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input
            id={index === 0 ? "staff-remote-0-tool" : undefined}
            value={row.tool}
            onChange={(event) => update(index, { tool: event.target.value })}
            placeholder="Tool"
            aria-label={`Remote access tool ${index + 1}`}
            className="w-40 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={row.id}
            onChange={(event) => update(index, { id: event.target.value })}
            placeholder="ID"
            aria-label={`Remote access ID ${index + 1}`}
            className="w-52 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, position) => position !== index))}
              className="text-xs text-blue-600 hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...EMPTY_REMOTE }])}
        className="w-fit text-xs text-blue-600 hover:underline"
      >
        Add another remote access ID
      </button>
    </div>
  );
}
