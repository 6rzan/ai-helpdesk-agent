import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../config/index.js";
import { TooManyRequestsError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import {
  clientKeyFor,
  isThrottled,
  recordRefusal,
} from "../../services/maintainer/signin-throttle-service.js";

export interface MaintainerRequest extends Request {
  maintainerName: string;
}

/**
 * The single message returned for every invalid key.
 *
 * FR-004 is a contract obligation rather than a UI one: one string, byte-identical for
 * a key of any length, prefix, or shape, and identical again when the header is absent.
 * A message that varied — "too short", "missing" — would narrow the key, and narrowing
 * it is exactly what the throttle below is trying to make expensive.
 */
const KEY_INVALID_MESSAGE = "Missing or invalid x-maintainer-key";

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

/**
 * Authenticate a maintainer request (007 T013).
 *
 * The order of the three checks is load-bearing and is the reason this middleware is
 * async:
 *
 *   1. **Throttle first, before the key is compared at all.** If a correct key got
 *      through while a client was cooling off, the throttle would answer "that one was
 *      right" — a guessing oracle, and a worse position than having no throttle. A
 *      cooling-off client is refused identically whatever they send.
 *   2. **Key next**, in constant time, with one fixed message.
 *   3. **Name last.** It is attribution, never authentication (FR-003), so it is
 *      checked only once the caller has proved they hold the key. Checking it first
 *      would answer "your key was fine" to anyone who omitted a name.
 *
 * Every refusal — wrong key *and* blank name — appends one record. A blank name with a
 * correct key is still a refused sign-in, and not counting it would leave a channel
 * that never trips the throttle.
 *
 * Mounting is conditional on MAINTAINER_KEY being set (app.ts) — the `!expected`
 * branch here is a defense-in-depth fallback, not the primary "routes absent" guard.
 */
export function maintainerAuth(req: Request, _res: Response, next: NextFunction): void {
  (async () => {
    const clientKey = clientKeyFor(req.ip);

    const verdict = await isThrottled(clientKey);
    if (verdict.throttled) {
      throw new TooManyRequestsError(
        "Too many failed attempts. Sign-in is paused for a short period.",
        "MAINTAINER_SIGNIN_THROTTLED",
        { retryAfterSeconds: verdict.retryAfterSeconds },
      );
    }

    const providedKey = req.header("x-maintainer-key") ?? "";
    const expectedKey = config.MAINTAINER_KEY ?? "";
    if (!expectedKey || !timingSafeCompare(providedKey, expectedKey)) {
      await recordRefusal(clientKey);
      throw new UnauthorizedError(KEY_INVALID_MESSAGE, "MAINTAINER_KEY_INVALID");
    }

    const maintainerName = req.header("x-maintainer-name")?.trim();
    if (!maintainerName) {
      await recordRefusal(clientKey);
      throw new ValidationError("x-maintainer-name header is required", "MAINTAINER_NAME_REQUIRED");
    }

    (req as MaintainerRequest).maintainerName = maintainerName;
  })().then(
    () => next(),
    (err: unknown) => next(err),
  );
}
