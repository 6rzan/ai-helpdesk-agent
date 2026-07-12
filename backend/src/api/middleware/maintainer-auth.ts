import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../config/index.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

export interface MaintainerRequest extends Request {
  maintainerName: string;
}

// Constant-time compare that never short-circuits on length so a mismatched
// key length doesn't leak timing information about the real key's length.
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Mounting is conditional on MAINTAINER_KEY being set (app.ts) — the `!expected`
// branch here is a defense-in-depth fallback, not the primary "routes absent" guard.
export function maintainerAuth(req: Request, _res: Response, next: NextFunction): void {
  const providedKey = req.header("x-maintainer-key") ?? "";
  const expectedKey = config.MAINTAINER_KEY ?? "";
  if (!expectedKey || !timingSafeCompare(providedKey, expectedKey)) {
    next(new UnauthorizedError("Missing or invalid x-maintainer-key", "MAINTAINER_KEY_INVALID"));
    return;
  }

  const maintainerName = req.header("x-maintainer-name")?.trim();
  if (!maintainerName) {
    next(new ValidationError("x-maintainer-name header is required", "MAINTAINER_NAME_REQUIRED"));
    return;
  }

  (req as MaintainerRequest).maintainerName = maintainerName;
  next();
}
