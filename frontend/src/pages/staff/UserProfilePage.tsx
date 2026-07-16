import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  appendStaffProfileEntry,
  getStaffCredentialStatus,
  getStaffUserProfile,
  resetStaffCredentials,
} from "../../services/api";
import type { ProfileStaffEntry, SupportProfile } from "../../lib/types";

const emptyProfile: SupportProfile = { remoteAccessIds: [], location: "", hardware: "", staffEntries: [] };
const fields: Array<{ value: NonNullable<ProfileStaffEntry["field"]>; label: string }> = [
  { value: "remoteAccessIds", label: "Remote access ID" },
  { value: "location", label: "Location" },
  { value: "hardware", label: "Device or asset details" },
];

export function UserProfilePage() {
  const { accountId = "" } = useParams<{ accountId: string }>();
  const [profile, setProfile] = useState<SupportProfile>(emptyProfile);
  const [usingInitialPassword, setUsingInitialPassword] = useState<boolean>();
  const [kind, setKind] = useState<ProfileStaffEntry["kind"]>("note");
  const [field, setField] = useState<NonNullable<ProfileStaffEntry["field"]>>("location");
  const [value, setValue] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<"entry" | "reset" | undefined>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(() => {
    if (!accountId) return;
    Promise.all([getStaffUserProfile(accountId), getStaffCredentialStatus(accountId)])
      .then(([profileResult, credentialResult]) => {
        setProfile(profileResult.profile);
        setUsingInitialPassword(credentialResult.usingInitialPassword);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load this profile"));
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !value.trim()) return;
    setBusy("entry"); setError(undefined); setNotice(undefined);
    try {
      const result = await appendStaffProfileEntry(accountId, { kind, value: value.trim(), field: kind === "correction" ? field : null });
      setProfile(result.profile); setValue(""); setNotice("Profile entry added with your attribution.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add profile entry"); }
    finally { setBusy(undefined); }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !confirmReset || newPassword.length < 8) return;
    setBusy("reset"); setError(undefined); setNotice(undefined);
    try {
      const result = await resetStaffCredentials(accountId, newPassword);
      setUsingInitialPassword(result.usingInitialPassword); setNewPassword(""); setConfirmReset(false);
      setNotice("A new initial password was issued. Existing sessions were invalidated.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to reset credentials"); }
    finally { setBusy(undefined); }
  }

  return <main className="mx-auto max-w-3xl p-6">
    <Link to="/staff" className="text-sm text-blue-600 hover:underline">Back to dashboard</Link>
    <h1 className="mt-2 text-xl font-semibold text-gray-900">Reporter profile</h1>
    {error && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">User-provided support details</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Location</dt><dd className="mt-1 text-gray-900">{profile.location || "Not provided"}</dd></div>
        <div><dt className="text-gray-500">Device or asset</dt><dd className="mt-1 text-gray-900">{profile.hardware || "Not provided"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-gray-500">Remote access IDs</dt><dd className="mt-1 text-gray-900">{profile.remoteAccessIds.length ? profile.remoteAccessIds.map((id) => `${id.tool}: ${id.id}`).join(", ") : "Not provided"}</dd></div>
      </dl>
    </section>

    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">Staff notes and corrections</h2>
      <form onSubmit={submitEntry} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Entry type<select value={kind} onChange={(event) => setKind(event.target.value as ProfileStaffEntry["kind"])} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="note">Note</option><option value="correction">Correction</option></select></label>
        {kind === "correction" && <label className="text-sm">Field being corrected<select value={field} onChange={(event) => setField(event.target.value as NonNullable<ProfileStaffEntry["field"]>)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2">{fields.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        <label className="text-sm sm:col-span-2">Entry<textarea required value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block min-h-24 w-full rounded border border-gray-300 px-3 py-2" /></label>
        <button disabled={busy !== undefined} className="w-fit rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy === "entry" ? "Adding…" : "Add attributed entry"}</button>
      </form>
      {profile.staffEntries.length > 0 && <ul className="mt-5 divide-y border-t border-gray-100">{profile.staffEntries.map((entry, index) => <li key={`${entry.at}-${index}`} className="py-3 text-sm"><p className="text-gray-800">{entry.value}</p><p className="mt-1 text-xs text-gray-500">{entry.kind}{entry.field ? ` for ${entry.field}` : ""} · {entry.staffName} · {new Date(entry.at).toLocaleString()}</p></li>)}</ul>}
    </section>

    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">Credentials</h2>
      <p className="mt-1 text-sm text-gray-600">Password status: {usingInitialPassword === undefined ? "Loading…" : usingInitialPassword ? "Initial password has not been changed" : "Password has been changed"}</p>
      <form onSubmit={submitReset} className="mt-4 space-y-3">
        <label className="block text-sm">New initial password<input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={confirmReset} onChange={(event) => setConfirmReset(event.target.checked)} className="mt-1" />I confirm this will invalidate the user’s current sessions.</label>
        <button disabled={busy !== undefined || !confirmReset || newPassword.length < 8} className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">{busy === "reset" ? "Re-issuing…" : "Re-issue initial password"}</button>
      </form>
    </section>
  </main>;
}
