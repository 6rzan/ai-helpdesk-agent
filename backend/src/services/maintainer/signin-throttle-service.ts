import { createHash } from "node:crypto";
import { config } from "../../config/index.js";
import { MaintainerSignInAttempt } from "../../models/maintainer-signin-attempt.js";

/**
 * The maintainer sign-in throttle (FR-034, FR-035, research.md R13).
 *
 * The console authenticates on a shared secret with no account behind it, so there is
 * no account to lock and no owner to notify. A per-client refusal count over a time
 * window is the only brake available, and it is derived from the collection on every
 * check rather than held in memory — an in-memory counter would reset with the process,
 * which turns the control into an inconvenience.
 *
 * There is deliberately no `recordSuccess`. A successful sign-in writes nothing, so the
 * collection is a record of refusals rather than a sign-in log.
 */

export interface ThrottleVerdict {
  throttled: boolean;
  /** Seconds until the oldest in-window refusal ages out. `0` when not throttled. */
  retryAfterSeconds: number;
}

/**
 * Hash a client address into the identity the throttle counts against.
 *
 * Hashed rather than stored plainly because the value is only ever compared for
 * equality: nothing in this feature reads an address back, so keeping one would be
 * storing a caller's network location for no purpose. Unsalted on purpose — a salt per
 * call would make two attempts from the same client uncountable, which is the entire
 * job of this function.
 */
export function clientKeyFor(address: string | undefined): string {
  return createHash("sha256").update(address ?? "unknown").digest("hex");
}

function windowStart(): Date {
  return new Date(Date.now() - config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS * 1000);
}

/**
 * Is this client currently cooling off, and for how much longer?
 *
 * The remaining time is measured from the **oldest** in-window refusal, because that is
 * the one that expires first and therefore the one that decides when the count drops
 * back below the threshold. Measuring from the newest would extend the lock-out on
 * every further attempt — a harsher control than FR-034 describes, and one that would
 * let an attacker keep the real maintainer locked out indefinitely.
 */
export async function isThrottled(clientKey: string): Promise<ThrottleVerdict> {
  const since = windowStart();
  const inWindow = await MaintainerSignInAttempt.find({ clientKey, at: { $gte: since } })
    .sort({ at: 1 })
    .lean();

  if (inWindow.length < config.MAINTAINER_SIGNIN_MAX_FAILURES) {
    return { throttled: false, retryAfterSeconds: 0 };
  }

  const oldest = inWindow[0];
  const expiresAtMs =
    new Date(oldest!.at).getTime() + config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
  return { throttled: true, retryAfterSeconds };
}

/**
 * Append one refusal for this client.
 *
 * Takes the client key and nothing else. There is no parameter for the attempted
 * secret, so no caller can leak one into the record by accident (FR-035).
 */
export async function recordRefusal(clientKey: string): Promise<void> {
  await MaintainerSignInAttempt.create({ clientKey, at: new Date(), outcome: "refused" });
}
