import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/services/auth/password-service.js";

describe("password-service", () => {
  it("hashes a password with a random per-call salt", async () => {
    const first = await hashPassword("correct-horse-battery");
    const second = await hashPassword("correct-horse-battery");
    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
  });

  it("verifies a correct password", async () => {
    const { passwordHash, passwordSalt } = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("correct-horse-battery", passwordHash, passwordSalt)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const { passwordHash, passwordSalt } = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("wrong-password", passwordHash, passwordSalt)).resolves.toBe(false);
  });
});
