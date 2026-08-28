import type { FieldState, ProfileStaffEntry, SupportProfileView } from "../lib/types";
import { provenanceByline } from "../lib/profileCopy";

/**
 * The reporter's profile beside their ticket (007 T039).
 *
 * Every value here now carries the **same byline, in the same words, in the same place**
 * as the two profile pages: one muted line directly under the value. Handling staff read
 * this panel while deciding whether to act on a detail, so "who said this and when" has
 * to mean the same thing in all three places it appears. A second phrasing would read as
 * a second, weaker kind of provenance.
 */

const FIELD_LABELS: Record<NonNullable<ProfileStaffEntry["field"]>, string> = {
  remoteAccessIds: "Remote access",
  location: "Location",
  hardware: "Hardware",
};

function StaffEntry({ entry }: { entry: ProfileStaffEntry }) {
  return (
    <li className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
      <p className="text-sm text-gray-700">{entry.value}</p>
      {entry.kind === "correction" && entry.field && (
        // A pre-007 correction is an earlier note about a field, not a value and not a
        // status, so it reads as a line of text rather than as a badge.
        <p className="mt-0.5 text-xs text-gray-500">
          Earlier note about {FIELD_LABELS[entry.field].toLowerCase()}
        </p>
      )}
      <p className="mt-0.5 text-xs text-gray-400">
        {entry.staffName} · {new Date(entry.at).toLocaleDateString()}
      </p>
    </li>
  );
}

function Field({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: FieldState | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">{value || <span className="text-gray-400">Not provided</span>}</dd>
      <Byline state={state} />
    </div>
  );
}

/** One muted line under the value. Absent only when the response predates the feature and
 * carries no field state at all, which is different from a value nobody is recorded as
 * having set: that case has its own sentence. */
function Byline({ state }: { state: FieldState | undefined }) {
  if (!state) return null;
  return (
    <p className="mt-0.5 text-xs text-gray-500">
      {provenanceByline(state.setByName, state.setAt)}
    </p>
  );
}

export function ProfilePanel({ profile }: { profile: SupportProfileView | null }) {
  if (!profile) {
    return (
      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Reporter profile</h2>
        <p className="mt-1 text-sm text-gray-400">No profile on file.</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700">Reporter profile</h2>
      <dl className="mt-2 flex flex-col gap-3">
        <Field label="Location" value={profile.location} state={profile.fieldState?.location} />
        <Field label="Hardware" value={profile.hardware} state={profile.fieldState?.hardware} />
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Remote access</dt>
          <dd className="text-sm text-gray-800">
            {profile.remoteAccessIds.length === 0 ? (
              <span className="text-gray-400">None on file</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {profile.remoteAccessIds.map((entry, i) => (
                  <li key={`${entry.tool}-${i}`} className="tabular-nums">
                    <span className="text-gray-500">{entry.tool}:</span> {entry.id}
                  </li>
                ))}
              </ul>
            )}
          </dd>
          {/* The list is one field, so it gets one byline rather than one per entry. */}
          <Byline state={profile.fieldState?.remoteAccessIds} />
        </div>
      </dl>
      {profile.staffEntries.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">Staff notes</h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {profile.staffEntries.map((entry, i) => (
              <StaffEntry key={`${entry.at}-${i}`} entry={entry} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
