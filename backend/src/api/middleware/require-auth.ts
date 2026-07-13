import type { NextFunction, Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { resolveSession, sessionCookie } from "../../services/auth/session-service.js";
import type { UserAccountDoc } from "../../models/user-account.js";
import { UnauthorizedError } from "../../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: HydratedDocument<UserAccountDoc>;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[sessionCookie.name];
  if (typeof token !== "string" || token.length === 0) {
    next(new UnauthorizedError("Sign in to continue.", "UNAUTHENTICATED"));
    return;
  }

  const resolved = await resolveSession(token);
  if (!resolved) {
    next(new UnauthorizedError("Sign in to continue.", "UNAUTHENTICATED"));
    return;
  }

  req.account = resolved.account as HydratedDocument<UserAccountDoc>;
  next();
}
