import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStaffAccounts } from "../../services/api";
import type { AccountDirectoryEntry } from "../../lib/types";

/**
 * Finding the account behind a ticket (007 T044, FR-030 to FR-032).
 *
 * Four decisions, each of them a way this page could have gone wrong:
 *
 *   1. **Three attributes and nothing else.** Display name, email, role. The server
 *      projects exactly those, and adding a fourth column here would be the first step
 *      to asking for a fifth from the server. This is a lookup, not a people-search.
 *   2. **No bulk selection, not even disabled.** There is no bulk operation and there is
 *      not going to be one; a checkbox column would offer an action that does not exist.
 *   3. **A no-match state that names the term.** "No accounts match dupont" tells the
 *      staff member their search ran and what it ran on. An empty frame leaves them
 *      wondering whether the page is broken.
 *   4. **The whole row opens the profile.** The account is what staff came for, so
 *      finding it and opening it is one movement rather than a find and then a hunt for
 *      a small link.
 */

/** Long enough that a typed word issues one request rather than six, short enough that
 * the list has caught up by the time the eye reaches it. */
const DEBOUNCE_MS = 250;

export function AccountDirectoryPage() {
  const [term, setTerm] = useState("");
  const [accounts, setAccounts] = useState<AccountDirectoryEntry[]>([]);
  const [searchedTerm, setSearchedTerm] = useState("");
  // Whether a result has ever landed, rather than whether one is in flight: the list and
  // its no-match line keep showing the last answer while the next search runs, so typing
  // one more letter does not blank the page under the reader.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      listStaffAccounts(term)
        .then((response) => {
          if (cancelled) return;
          setAccounts(response.accounts);
          // Recorded with the results, so the no-match line names the term that was
          // actually searched rather than whatever has been typed since.
          setSearchedTerm(term.trim());
          setError(undefined);
          setHasLoaded(true);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Unable to load accounts");
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
      <p className="mt-1 text-sm text-gray-600">
        Find the account behind a ticket, then open its profile.
      </p>

      <label htmlFor="account-search" className="mt-5 block text-sm text-gray-700">
        Search by name or email
      </label>
      <input
        id="account-search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Start typing a name or email"
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {!error && hasLoaded && accounts.length === 0 && (
        <p className="mt-6 text-sm text-gray-600">
          {searchedTerm
            ? `No accounts match ${searchedTerm}. Check the spelling, or try part of an email address.`
            : "There are no accounts yet."}
        </p>
      )}

      {accounts.length > 0 && (
        <ul className="mt-5 divide-y divide-gray-100 border-t border-gray-200">
          {accounts.map((account) => (
            <li key={account.id}>
              {/* The whole row is the link: the account is what staff came here for. */}
              <Link
                to={`/staff/users/${account.id}/profile`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{account.displayName}</span>
                <span className="text-sm text-gray-600">{account.email}</span>
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  {account.role === "staff" ? "Staff" : "Reporter"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
