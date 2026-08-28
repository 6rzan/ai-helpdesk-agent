import { UserAccount } from "../../models/user-account.js";
import type { AccountRole } from "../../models/enums.js";

/**
 * The staff account directory (007 T041, FR-030 to FR-032, NFR-5).
 *
 * **Exactly four attributes, and the narrowness is the requirement.** The directory
 * exists so staff can find the account behind a ticket; it is not a people-search, and
 * it is deliberately not a superset of the staff roster, which answers a different
 * question for a different audience (research.md R10). Adding availability, last sign-in,
 * or ticket counts here would quietly turn a lookup into a surveillance surface, so the
 * projection is stated once, in one place, and nothing else is selected from the
 * database at all.
 *
 * **Filtering happens in the database, not in the caller.** A client that fetched every
 * account and filtered in the browser would have shipped every account to every staff
 * member's machine to answer a question about one of them.
 */

export interface DirectoryEntry {
  id: string;
  displayName: string;
  email: string;
  role: AccountRole;
}

/** Longest search term the route accepts. Mirrored by the zod schema on the route, which
 * is what enforces it: this constant is the reason for the number, not the check. */
export const MAX_SEARCH_TERM = 120;

/** Escape a user-supplied term so it is matched as text rather than as a pattern. A term
 * containing `.*` must find an account whose name contains those characters, not every
 * account in the system. */
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every account, or those whose display name or email contains `term`.
 *
 * Case-insensitive substring, not prefix: staff search for the fragment they remember,
 * which is as often a surname or a domain as the start of a name.
 */
export async function listAccounts(term?: string): Promise<DirectoryEntry[]> {
  const trimmed = term?.trim();
  const filter = trimmed
    ? {
        $or: [
          { displayName: { $regex: escapeRegex(trimmed), $options: "i" } },
          { email: { $regex: escapeRegex(trimmed), $options: "i" } },
        ],
      }
    : {};

  const accounts = await UserAccount.find(filter)
    .select({ displayName: 1, email: 1, role: 1 })
    .sort({ displayName: 1 })
    .lean();

  return accounts.map((account) => ({
    id: String(account._id),
    displayName: account.displayName,
    email: account.email,
    role: account.role as AccountRole,
  }));
}
