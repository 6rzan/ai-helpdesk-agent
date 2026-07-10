import { useState, type FormEvent } from "react";

interface SessionFormProps {
  onSubmit: (orgId: string, displayName: string) => void;
  isSubmitting?: boolean;
  error?: string;
}

export function SessionForm({ onSubmit, isSubmitting = false, error }: SessionFormProps) {
  const [orgId, setOrgId] = useState("");
  const [displayName, setDisplayName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(orgId.trim(), displayName.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">IT Help Desk</h1>
      <label className="flex flex-col gap-1 text-sm">
        Organisation ID
        <input
          className="rounded border border-gray-300 px-3 py-2"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          minLength={3}
          maxLength={32}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          className="rounded border border-gray-300 px-3 py-2"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          minLength={1}
          maxLength={60}
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Starting…" : "Start"}
      </button>
    </form>
  );
}
