import type { FormEvent } from "react";

/**
 * Credential status and re-issue (007 T022).
 *
 * Extracted from `UserProfilePage` with **no behaviour change**: the same inline
 * confirmation still gates the destructive action, and the button stays unavailable
 * until both the confirmation and a long enough password are present.
 */

interface Props {
  usingInitialPassword: boolean | undefined;
  newPassword: string;
  confirmReset: boolean;
  isBusy: boolean;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (confirmed: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}

export function CredentialsSection({
  usingInitialPassword,
  newPassword,
  confirmReset,
  isBusy,
  isSubmitting,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}: Props) {
  return (
    <section className="mt-6 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800">Credentials</h2>
      <p className="mt-1 text-sm text-gray-600">
        Password status:{" "}
        {usingInitialPassword === undefined
          ? "Loading…"
          : usingInitialPassword
            ? "Initial password has not been changed"
            : "Password has been changed"}
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          New initial password
          <input
            required
            minLength={8}
            type="password"
            value={newPassword}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={confirmReset}
            onChange={(event) => onConfirmChange(event.target.checked)}
            className="mt-1"
          />
          I confirm this will invalidate the user’s current sessions.
        </label>
        <button
          disabled={isBusy || !confirmReset || newPassword.length < 8}
          className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isSubmitting ? "Re-issuing…" : "Re-issue initial password"}
        </button>
      </form>
    </section>
  );
}
