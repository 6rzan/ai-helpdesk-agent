import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  MaintainerApiError,
  getMaintainerStatus,
  listMaintainerCategories,
  type MaintainerCredentials,
} from "../../services/maintainerApi";
import { CategoryListPage } from "./CategoryListPage";

/**
 * The maintainer console shell (007 T018, US1).
 *
 * Structure carries the requirement here. The console lives at its own top-level route
 * outside `AppLayout`, so `AppNav` never renders inside it and it is not wired through
 * the auth context. That is the structural expression of FR-015: the console cannot
 * show tickets, accounts, or staff surfaces because it does not render the
 * application's navigation at all, and there is nothing to switch it to.
 *
 * The key is held in React state and nowhere else (FR-014). Closing the tab loses it,
 * which is correct: it is a shared secret handed to one person, not a session.
 */

/** Every refusal the console can be in, kept as one union so no two can be rendered at
 * once. Conflating any two of them is the specific design failure FR-005 and FR-034
 * exist to prevent, and a union makes conflating them impossible rather than merely
 * discouraged. */
type ConsoleState =
  | { kind: "checking" }
  /** Administration is switched off. No sign-in form is rendered at all. */
  | { kind: "disabled" }
  | { kind: "signedOut"; refusal: SignInRefusal | null }
  | { kind: "signedIn"; credentials: MaintainerCredentials; notice: string | null };

type SignInRefusal =
  | { kind: "invalidKey" }
  | { kind: "throttled"; retryAfterSeconds: number | null }
  | { kind: "unavailable"; message: string };

/**
 * The one message shown for any wrong key.
 *
 * Deliberately says nothing about the key itself. No length hint, no format hint, no
 * "that looks too short": the server returns one fixed message for every invalid key
 * (FR-004), and a console that added its own client-side narrowing would undo that in
 * the one place a person is actually looking.
 */
const INVALID_KEY_MESSAGE =
  "That key was not accepted. Check the key you were given and try again.";

const SESSION_ENDED_MESSAGE =
  "Your key is no longer accepted. It may have been changed. Sign in again with the current key.";

function coolingOffMessage(retryAfterSeconds: number | null): string {
  // The duration comes from the server or is omitted entirely. Hardcoding a number here
  // would put copy and behaviour into disagreement the moment the setting changes.
  if (retryAfterSeconds === null) {
    return "Too many failed attempts. Sign-in is paused for a short period. Try again shortly.";
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const unit = minutes === 1 ? "minute" : "minutes";
  return `Too many failed attempts. Sign-in is paused for about ${minutes} ${unit}.`;
}

function refusalFrom(error: unknown): SignInRefusal {
  if (error instanceof MaintainerApiError) {
    if (error.status === 401) return { kind: "invalidKey" };
    if (error.status === 429) {
      return { kind: "throttled", retryAfterSeconds: error.retryAfterSeconds };
    }
  }
  return {
    kind: "unavailable",
    message: "Could not reach maintainer administration. Try again in a moment.",
  };
}

export function MaintainerConsolePage() {
  const [state, setState] = useState<ConsoleState>({ kind: "checking" });
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Read the probe before rendering anything. Presenting a sign-in form that can never
    // succeed is exactly what FR-005 exists to prevent, and the probe is the only way to
    // tell "switched off" from "wrong URL" before a key has been typed.
    getMaintainerStatus()
      .then((status) => {
        if (cancelled) return;
        setState(status.enabled ? { kind: "signedOut", refusal: null } : { kind: "disabled" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          kind: "signedOut",
          refusal: {
            kind: "unavailable",
            message: "Could not reach maintainer administration. Try again in a moment.",
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * How the console reacts when an action fails *after* sign-in.
   *
   * Two cases the spec's Edge Cases name, and both are handled here rather than left to
   * each child screen, so a change is never silently lost:
   *
   *   - **401**: the key was rotated mid-session. Discard it and return to the sign-in
   *     form *with an explanation* rather than a dead screen. Without the explanation
   *     the maintainer sees a sign-in form appear for no reason and assumes they were
   *     signed out by inactivity.
   *   - **404**: administration was switched off while they were working. Render the
   *     switched-off state rather than a generic error, because "not found" describes
   *     the route and not what happened.
   *
   * Returns `true` when it consumed the error, so callers know whether to show their own
   * message.
   */
  const handleActionError = useCallback((error: unknown): boolean => {
    if (!(error instanceof MaintainerApiError)) return false;
    if (error.status === 401) {
      setKey("");
      setState({ kind: "signedOut", refusal: { kind: "unavailable", message: SESSION_ENDED_MESSAGE } });
      return true;
    }
    if (error.status === 404) {
      setState({ kind: "disabled" });
      return true;
    }
    if (error.status === 429) {
      setKey("");
      setState({
        kind: "signedOut",
        refusal: { kind: "throttled", retryAfterSeconds: error.retryAfterSeconds },
      });
      return true;
    }
    return false;
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials: MaintainerCredentials = { key, name: name.trim() };
    setIsSubmitting(true);
    try {
      // Sign-in is a real request rather than a local check: there is no session to
      // create, so "signed in" means only that the key was accepted once. Listing
      // categories is the cheapest call that proves it.
      await listMaintainerCategories(credentials);
      setState({ kind: "signedIn", credentials, notice: null });
    } catch (error) {
      if (error instanceof MaintainerApiError && error.status === 404) {
        setState({ kind: "disabled" });
        return;
      }
      setState({ kind: "signedOut", refusal: refusalFrom(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignOut() {
    setKey("");
    setState({ kind: "signedOut", refusal: null });
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-base font-semibold">IT Help Desk</p>
            <p className="text-sm text-gray-600">Maintainer administration</p>
          </div>
          {state.kind === "signedIn" && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                Signed in as <span className="text-gray-900">{state.credentials.name}</span>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {state.kind === "checking" && (
          <p className="text-sm text-gray-600">Checking whether administration is enabled…</p>
        )}

        {state.kind === "disabled" && <AdministrationDisabled />}

        {state.kind === "signedOut" && (
          <SignInForm
            keyValue={key}
            nameValue={name}
            onKeyChange={setKey}
            onNameChange={setName}
            onSubmit={handleSignIn}
            isSubmitting={isSubmitting}
            refusal={state.refusal}
          />
        )}

        {state.kind === "signedIn" && (
          <CategoryListPage
            credentials={state.credentials}
            onActionError={handleActionError}
          />
        )}
      </main>
    </div>
  );
}

/**
 * The switched-off state. **No sign-in form is rendered here at all**, which is the
 * whole requirement (FR-005): a form that cannot succeed invites someone to conclude
 * their key is wrong when the feature is simply off.
 */
function AdministrationDisabled() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Maintainer administration is not enabled</h1>
      <p className="max-w-prose text-sm text-gray-600">
        This system is running without maintainer administration switched on, so there is nothing
        to sign in to. Someone with access to the server configuration can enable it.
      </p>
    </section>
  );
}

interface SignInFormProps {
  keyValue: string;
  nameValue: string;
  onKeyChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  refusal: SignInRefusal | null;
}

function SignInForm({
  keyValue,
  nameValue,
  onKeyChange,
  onNameChange,
  onSubmit,
  isSubmitting,
  refusal,
}: SignInFormProps) {
  const isCoolingOff = refusal?.kind === "throttled";

  return (
    <section className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Sign in to maintainer administration</h1>
        <p className="text-sm text-gray-600">
          This is a separate key, not an account. It does not sign you in to the help desk.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Maintainer key
          <input
            type="password"
            className="rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            value={keyValue}
            onChange={(e) => onKeyChange(e.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            type="text"
            className="rounded border border-gray-300 px-3 py-2"
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            autoComplete="off"
            required
          />
          <span className="text-xs text-gray-600">
            Recorded against every change you make, so others can see who edited a category or
            published a guide. It is not part of signing in.
          </span>
        </label>

        {refusal && <SignInRefusalNotice refusal={refusal} />}

        <button
          type="submit"
          disabled={isSubmitting || isCoolingOff}
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

/**
 * The three refusals, rendered distinctly.
 *
 * A cooling-off notice must not read as another wrong-key message: a maintainer who
 * sees "that key was not accepted" while the throttle is holding will retype a correct
 * key, be refused again, and conclude the key itself is wrong.
 */
function SignInRefusalNotice({ refusal }: { refusal: SignInRefusal }) {
  if (refusal.kind === "invalidKey") {
    return (
      <p role="alert" className="text-sm text-red-600">
        {INVALID_KEY_MESSAGE}
      </p>
    );
  }

  if (refusal.kind === "throttled") {
    return (
      <div role="alert" className="flex flex-col gap-1 rounded border border-gray-300 bg-gray-50 p-3">
        <p className="text-sm text-gray-900">{coolingOffMessage(refusal.retryAfterSeconds)}</p>
        <p className="text-xs text-gray-600">
          This is temporary. Signing in will work again once the pause ends.
        </p>
      </div>
    );
  }

  return (
    <p role="alert" className="text-sm text-gray-900">
      {refusal.message}
    </p>
  );
}
