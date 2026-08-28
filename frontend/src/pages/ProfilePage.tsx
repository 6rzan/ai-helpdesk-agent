import { useEffect, useState, type FormEvent } from "react";
import { getMyProfile, updateMyProfile } from "../services/api";
import type {
  ProfileFieldName,
  ProfileFieldResults,
  ProfileStaffEntry,
  RemoteAccessId,
  SupportProfile,
} from "../lib/types";
import { ProfileField } from "../components/profile/ProfileField";
import { ALL_FIELDS_LOCKED_EXPLANATION } from "../lib/profileCopy";

/**
 * The owner's own support profile (007 T038, FR-018, FR-020 to FR-022).
 *
 * What this page has to get right, and what the obvious version gets wrong:
 *
 *   - **Every field says who set it and when**, including the ones the owner set, so
 *     provenance reads as a property of the record rather than as an accusation that
 *     appears only when staff are involved.
 *   - **A staff-controlled field is read-only text with a neutral explanation**, never a
 *     disabled input and never coloured as a warning. `ProfileField` enforces that; this
 *     page's job is to pass `audience="owner"` and the real control state.
 *   - **No field history anywhere.** Not shown, not collapsed, not disabled. FR-018 makes
 *     history staff-only, and an affordance the owner can see but never open would
 *     promise something the system will not do.
 *   - **A field staff took over mid-session is explained, not silently dropped.** The
 *     save returns a `locked` outcome for it and the field says so.
 */

const empty: SupportProfile = { remoteAccessIds: [], location: "", hardware: "", staffEntries: [] };

const FIELDS: ProfileFieldName[] = ["remoteAccessIds", "location", "hardware"];

export function ProfilePage() {
  const [profile, setProfile] = useState<SupportProfile>(empty);
  const [results, setResults] = useState<ProfileFieldResults>({});
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then(({ profile }) =>
        setProfile({
          ...profile,
          // One empty row so the field is visibly fillable rather than an unexplained
          // "Add" button on a blank page.
          remoteAccessIds: profile.remoteAccessIds.length
            ? profile.remoteAccessIds
            : [{ tool: "Remote access", id: "" }],
        }),
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load profile"),
      );
  }, []);

  const controlOf = (field: ProfileFieldName) =>
    profile.fieldState?.[field].controlledBy ?? "owner";
  const isLocked = (field: ProfileFieldName) => controlOf(field) === "staff";
  const editable = FIELDS.filter((field) => !isLocked(field));
  const allLocked = editable.length === 0 && profile.fieldState !== undefined;

  const changeAccess = (index: number, key: keyof RemoteAccessId, value: string) =>
    setProfile((current) => ({
      ...current,
      remoteAccessIds: current.remoteAccessIds.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry,
      ),
    }));

  const removeAccess = (index: number) =>
    setProfile((current) => ({
      ...current,
      remoteAccessIds: current.remoteAccessIds.filter((_, i) => i !== index),
    }));

  const addAccess = () =>
    setProfile((current) => ({
      ...current,
      remoteAccessIds: [...current.remoteAccessIds, { tool: "", id: "" }],
    }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      // Only the fields the owner still controls. Sending a locked one would be refused
      // every time and would report a standing lock as a new failure.
      const submission: Partial<Pick<SupportProfile, "remoteAccessIds" | "location" | "hardware">> = {};
      if (!isLocked("remoteAccessIds")) {
        // A half-filled row is dropped rather than sent: the server refuses it, and the
        // owner did not mean to add one.
        submission.remoteAccessIds = profile.remoteAccessIds.filter(
          (entry) => entry.tool.trim() && entry.id.trim(),
        );
      }
      if (!isLocked("location")) submission.location = profile.location;
      if (!isLocked("hardware")) submission.hardware = profile.hardware;

      const result = await updateMyProfile(submission);
      setResults(result.results ?? {});
      setProfile({
        ...result.profile,
        remoteAccessIds: result.profile.remoteAccessIds.length
          ? result.profile.remoteAccessIds
          : [{ tool: "Remote access", id: "" }],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Support profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        These details help IT staff assist you when a case needs escalation.
      </p>

      {/* A page where every field is locked is a designed state, not an empty form: it
          still says what the page is for and how to get a value corrected. */}
      {allLocked && (
        <p className="mt-4 text-sm text-gray-600">{ALL_FIELDS_LOCKED_EXPLANATION}</p>
      )}

      <form onSubmit={save} className="mt-5 flex flex-col gap-5">
        <ProfileField
          label="Remote access IDs"
          id="remote-access-0-tool"
          state={profile.fieldState?.remoteAccessIds}
          audience="owner"
          outcome={results.remoteAccessIds}
          readOnlyValue={
            profile.remoteAccessIds.some((entry) => entry.tool && entry.id)
              ? profile.remoteAccessIds.map((entry) => `${entry.tool}: ${entry.id}`).join(", ")
              : "Not provided"
          }
        >
          <RemoteAccessRows
            entries={profile.remoteAccessIds}
            onChange={changeAccess}
            onRemove={removeAccess}
            onAdd={addAccess}
          />
        </ProfileField>

        <ProfileField
          label="Location"
          id="profile-location"
          state={profile.fieldState?.location}
          audience="owner"
          outcome={results.location}
          readOnlyValue={profile.location || "Not provided"}
        >
          <input
            id="profile-location"
            className="rounded border border-gray-300 px-3 py-2"
            value={profile.location}
            onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
          />
        </ProfileField>

        <ProfileField
          label="Device or asset details"
          id="profile-hardware"
          state={profile.fieldState?.hardware}
          audience="owner"
          outcome={results.hardware}
          readOnlyValue={profile.hardware || "Not provided"}
        >
          <textarea
            id="profile-hardware"
            className="rounded border border-gray-300 px-3 py-2"
            value={profile.hardware}
            onChange={(e) => setProfile((p) => ({ ...p, hardware: e.target.value }))}
          />
        </ProfileField>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Nothing to save when nothing is editable, and a button that can only fail is
            worse than no button. */}
        {!allLocked && (
          <button
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        )}
      </form>

      <StaffEntries entries={profile.staffEntries} />
    </main>
  );
}

interface RemoteAccessRowsProps {
  entries: RemoteAccessId[];
  onChange: (index: number, key: keyof RemoteAccessId, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

/** The remote access list is one field, not several: it carries a single byline and a
 * single lock, on the list rather than on each entry. */
function RemoteAccessRows({ entries, onChange, onRemove, onAdd }: RemoteAccessRowsProps) {
  return (
    <div>
      {entries.map((entry, index) => (
        <div key={index} className="mt-2 flex gap-2">
          <input
            id={index === 0 ? "remote-access-0-tool" : undefined}
            aria-label={`Remote access tool ${index + 1}`}
            className="min-w-0 rounded border border-gray-300 px-3 py-2"
            value={entry.tool}
            placeholder="Tool"
            onChange={(e) => onChange(index, "tool", e.target.value)}
          />
          <input
            aria-label={`Remote access ID ${index + 1}`}
            className="min-w-0 rounded border border-gray-300 px-3 py-2"
            value={entry.id}
            placeholder="ID"
            onChange={(e) => onChange(index, "id", e.target.value)}
          />
          <button type="button" className="text-sm text-blue-600" onClick={() => onRemove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="mt-2 text-sm font-medium text-blue-600" onClick={onAdd}>
        Add remote access ID
      </button>
    </div>
  );
}

function StaffEntries({ entries }: { entries: ProfileStaffEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-semibold">Notes from IT staff</h2>
      <ul className="mt-2 divide-y rounded border border-gray-200">
        {entries.map((entry, i) => (
          <li key={`${entry.at}-${i}`} className="p-3 text-sm">
            <p>{entry.value}</p>
            <p className="mt-1 text-xs text-gray-500">
              {entry.staffName} · {new Date(entry.at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
