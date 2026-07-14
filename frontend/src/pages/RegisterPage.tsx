import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await register({ email: email.trim(), displayName: displayName.trim(), password });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="rounded border border-gray-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            maxLength={80}
            autoComplete="name"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="rounded border border-gray-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <span className="text-xs text-gray-500">At least 8 characters.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
