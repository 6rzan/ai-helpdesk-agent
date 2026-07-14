import type { ProfileStaffEntry, SupportProfileView } from "../lib/types";

const FIELD_LABELS: Record<NonNullable<ProfileStaffEntry["field"]>, string> = {
  remoteAccessIds: "Remote access",
  location: "Location",
  hardware: "Hardware",
};

function StaffEntry({ entry }: { entry: ProfileStaffEntry }) {
  return (
    <li className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
      <p className="text-sm text-gray-700">
        {entry.kind === "correction" && entry.field && (
          <span className="mr-1 rounded bg-gray-200 px-1 text-xs text-gray-600">
            correction · {FIELD_LABELS[entry.field]}
          </span>
        )}
        {entry.value}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">
        {entry.staffName} · {new Date(entry.at).toLocaleDateString()}
      </p>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">{value || <span className="text-gray-400">Not provided</span>}</dd>
    </div>
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
        <Field label="Location" value={profile.location} />
        <Field label="Hardware" value={profile.hardware} />
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
