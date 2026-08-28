import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetDb, startTestApp, stopTestApp } from "../helpers/test-app.js";
import { seedAccount } from "../helpers/auth.js";
import { listAccounts } from "../../src/services/profile/account-directory-service.js";

/**
 * The account directory projection (007 T041, R10, NFR-5).
 *
 * The claim under test is mostly a negative one: the directory carries four attributes
 * and nothing else. A projection is easy to widen by accident and impossible to narrow
 * once something depends on the extra field, so the assertion is on the exact key set
 * rather than on the four keys being present.
 */

describe("account directory service", () => {
  beforeAll(async () => {
    await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  async function seedThree() {
    await seedAccount({ displayName: "Amina Yusuf", email: "amina.yusuf@example.com" });
    await seedAccount({ displayName: "Brian Ochieng", email: "brian@contractor.example" });
    await seedAccount({ displayName: "Chidi Okafor", email: "chidi@example.com", role: "staff" });
  }

  it("AD-001: carries exactly id, displayName, email and role", async () => {
    await seedAccount({ displayName: "Amina Yusuf", email: "amina@example.com" });
    const [entry] = await listAccounts();
    expect(Object.keys(entry!).sort()).toEqual(["displayName", "email", "id", "role"]);
  });

  it("AD-002: never carries a password hash, salt, or availability", async () => {
    await seedAccount({ displayName: "Amina Yusuf", email: "amina@example.com", role: "staff" });
    const serialised = JSON.stringify(await listAccounts());
    expect(serialised).not.toMatch(/passwordHash|passwordSalt|availability|usingInitialPassword/);
  });

  it("AD-003: lists every account when no term is given", async () => {
    await seedThree();
    expect(await listAccounts()).toHaveLength(3);
  });

  it("AD-004: includes staff accounts, because staff have profiles too", async () => {
    await seedThree();
    const roles = (await listAccounts()).map((entry) => entry.role);
    expect(roles).toContain("staff");
    expect(roles).toContain("user");
  });

  it("AD-005: matches a display name case-insensitively", async () => {
    await seedThree();
    const results = await listAccounts("AMINA");
    expect(results.map((entry) => entry.displayName)).toEqual(["Amina Yusuf"]);
  });

  it("AD-006: matches a substring rather than only a prefix", async () => {
    await seedThree();
    // Staff search for the fragment they remember, which is as often a surname as a
    // first name.
    expect((await listAccounts("ochieng")).map((entry) => entry.displayName)).toEqual([
      "Brian Ochieng",
    ]);
  });

  it("AD-007: matches an email as well as a name", async () => {
    await seedThree();
    expect((await listAccounts("contractor.example")).map((entry) => entry.email)).toEqual([
      "brian@contractor.example",
    ]);
  });

  it("AD-008: returns an empty list for no match rather than everything", async () => {
    await seedThree();
    expect(await listAccounts("nobody-by-that-name")).toEqual([]);
  });

  it("AD-009: treats a term as text, not as a pattern", async () => {
    await seedThree();
    // An unescaped `.*` would match every account, turning a search into a full listing.
    expect(await listAccounts(".*")).toEqual([]);
  });

  it("AD-010: ignores surrounding whitespace on a term", async () => {
    await seedThree();
    expect(await listAccounts("  amina  ")).toHaveLength(1);
  });

  it("AD-011: treats a whitespace-only term as no term", async () => {
    await seedThree();
    expect(await listAccounts("   ")).toHaveLength(3);
  });

  it("AD-012: orders results by display name so the list does not reshuffle between searches", async () => {
    await seedThree();
    expect((await listAccounts()).map((entry) => entry.displayName)).toEqual([
      "Amina Yusuf",
      "Brian Ochieng",
      "Chidi Okafor",
    ]);
  });

  it("AD-013: reports the account id as a string the client can use in a URL", async () => {
    const seeded = await seedAccount({ displayName: "Amina Yusuf", email: "amina@example.com" });
    const [entry] = await listAccounts();
    expect(entry!.id).toBe(String(seeded.account._id));
  });
});
