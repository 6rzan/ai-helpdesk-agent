import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  appendStaffProfileEntry,
  getStaffCredentialStatus,
  getStaffUserProfile,
  resetStaffCredentials,
} from "../../services/api";
import type { SupportProfile } from "../../lib/types";
import { CredentialsSection } from "../../components/profile/CredentialsSection";
import { StaffNotesSection } from "../../components/profile/StaffNotesSection";
import { SupportDetailsSection } from "../../components/profile/SupportDetailsSection";

/**
 * A reporter's profile as staff see it.
 *
 * 007 T022 moved the three rendered regions into `components/profile/`; T037 gave the
 * support fields their own state, because per-field drafts, concurrency tokens, outcomes
 * and history belong next to the fields rather than in a page that also resets
 * passwords. What is left here is the load, the note submission, and the reset.
 */

const emptyProfile: SupportProfile = {
  remoteAccessIds: [],
  location: "",
  hardware: "",
  staffEntries: [],
};

export function UserProfilePage() {
  const { accountId = "" } = useParams<{ accountId: string }>();
  const [profile, setProfile] = useState<SupportProfile>(emptyProfile);
  const [usingInitialPassword, setUsingInitialPassword] = useState<boolean>();
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
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unable to load this profile"),
      );
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !value.trim()) return;
    setBusy("entry");
    setError(undefined);
    setNotice(undefined);
    try {
      // Only notes: 007 retired the correction write path, and the server refuses it.
      const result = await appendStaffProfileEntry(accountId, {
        kind: "note",
        value: value.trim(),
        field: null,
      });
      setProfile(result.profile);
      setValue("");
      setNotice("Note added with your attribution.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add note");
    } finally {
      setBusy(undefined);
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !confirmReset || newPassword.length < 8) return;
    setBusy("reset");
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await resetStaffCredentials(accountId, newPassword);
      setUsingInitialPassword(result.usingInitialPassword);
      setNewPassword("");
      setConfirmReset(false);
      setNotice("A new initial password was issued. Existing sessions were invalidated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset credentials");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/staff" className="text-sm text-blue-600 hover:underline">
        Back to dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Reporter profile</h1>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}

      <SupportDetailsSection
        accountId={accountId}
        profile={profile}
        onProfileChange={setProfile}
      />

      <StaffNotesSection
        profile={profile}
        value={value}
        isBusy={busy !== undefined}
        isSubmitting={busy === "entry"}
        onValueChange={setValue}
        onSubmit={submitEntry}
      />

      <CredentialsSection
        usingInitialPassword={usingInitialPassword}
        newPassword={newPassword}
        confirmReset={confirmReset}
        isBusy={busy !== undefined}
        isSubmitting={busy === "reset"}
        onPasswordChange={setNewPassword}
        onConfirmChange={setConfirmReset}
        onSubmit={submitReset}
      />
    </main>
  );
}
