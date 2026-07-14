import type { Types } from "mongoose";
import { UserAccount, type UserAccountDoc } from "../../src/models/user-account.js";
import { hashPassword } from "../../src/services/auth/password-service.js";
import { issueSession, sessionCookie } from "../../src/services/auth/session-service.js";
import type { HydratedDocument } from "mongoose";

export interface SeededAccount {
  account: HydratedDocument<UserAccountDoc>;
  /** Cookie header value to pass to supertest `.set("Cookie", cookie)`. */
  cookie: string;
  token: string;
}

interface SeedOptions {
  email?: string;
  displayName?: string;
  role?: "user" | "staff";
  password?: string;
  availability?: "available" | "busy" | "away";
  usingInitialPassword?: boolean;
}

let counter = 0;

/**
 * Create a UserAccount and an active auth session for it, returning a ready-to-use
 * Cookie header. Mirrors the real registration/login path (scrypt hash + opaque
 * session token) so integration tests exercise middleware end-to-end.
 */
export async function seedAccount(options: SeedOptions = {}): Promise<SeededAccount> {
  counter += 1;
  const role = options.role ?? "user";
  const email = options.email ?? `account-${counter}@example.com`;
  const { passwordHash, passwordSalt } = await hashPassword(options.password ?? "initial-password-1");

  const account = await UserAccount.create({
    email,
    displayName: options.displayName ?? `Account ${counter}`,
    role,
    passwordHash,
    passwordSalt,
    usingInitialPassword: options.usingInitialPassword ?? false,
    ...(role === "staff" ? { availability: options.availability ?? "available" } : {}),
  });

  const token = await issueSession(account._id as Types.ObjectId);
  return { account, cookie: `${sessionCookie.name}=${token}`, token };
}

export function seedStaff(options: Omit<SeedOptions, "role"> = {}): Promise<SeededAccount> {
  return seedAccount({ ...options, role: "staff" });
}

export function seedUser(options: Omit<SeedOptions, "role"> = {}): Promise<SeededAccount> {
  return seedAccount({ ...options, role: "user" });
}
