// T080/FR-019, US3 AS7: every report on the password path must state plainly,
// in the same message, that the action ran against a local test account on
// the test system and never against any organisational account or directory
// -- regardless of outcome, and with no em-dash (plain, unambiguous prose).
const PASSWORD_PATH_POLICY_ENTRY_IDS: ReadonlySet<string> = new Set(["unlock-account", "expire-password"]);

export function isPasswordPathEntry(policyEntryId: string): boolean {
  return PASSWORD_PATH_POLICY_ENTRY_IDS.has(policyEntryId);
}

export const TEST_ACCOUNT_DISCLOSURE =
  "This applied to a local test account on the test system, not your organisational account or directory.";
