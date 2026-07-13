import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import type { Response } from "express";
import { config } from "../../config/index.js";
import { clock } from "../../lib/clock.js";
import { AuthSession } from "../../models/auth-session.js";
import { UserAccount, type UserAccountDoc } from "../../models/user-account.js";

const COOKIE_NAME = "session_token";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFromNow(): Date {
  return new Date(clock.now().getTime() + config.AUTH_SESSION_TTL_MINUTES * 60_000);
}

export async function issueSession(accountId: Types.ObjectId): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await AuthSession.create({
    tokenHash: hashToken(token),
    accountId,
    createdAt: clock.now(),
    expiresAt: expiryFromNow(),
  });
  return token;
}

export interface ResolvedSession {
  account: UserAccountDoc & { _id: Types.ObjectId };
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const authSession = await AuthSession.findOne({ tokenHash: hashToken(token) });
  if (!authSession || authSession.expiresAt.getTime() <= clock.now().getTime()) {
    return null;
  }

  const account = await UserAccount.findById(authSession.accountId);
  if (!account) {
    return null;
  }

  authSession.expiresAt = expiryFromNow();
  await authSession.save();

  return { account: account as UserAccountDoc & { _id: Types.ObjectId } };
}

export async function invalidateSession(token: string): Promise<void> {
  await AuthSession.deleteOne({ tokenHash: hashToken(token) });
}

export async function invalidateAllSessionsForAccount(accountId: Types.ObjectId): Promise<void> {
  await AuthSession.deleteMany({ accountId });
}

export const sessionCookie = {
  name: COOKIE_NAME,
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: config.AUTH_SESSION_TTL_MINUTES * 60_000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}
