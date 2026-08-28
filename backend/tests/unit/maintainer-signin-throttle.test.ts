import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { startTestApp, stopTestApp, resetDb } from "../helpers/test-app.js";
import { MaintainerSignInAttempt } from "../../src/models/maintainer-signin-attempt.js";
import {
  clientKeyFor,
  isThrottled,
  recordRefusal,
} from "../../src/services/maintainer/signin-throttle-service.js";
import { config } from "../../src/config/index.js";

// T008 (test-first, research.md R13). The throttle is an authentication control on a
// shared secret with no account behind it, so it is written before the middleware that
// uses it. Two properties are load-bearing and are asserted directly rather than
// inferred from HTTP behaviour:
//
//   1. The count is derived from the collection, not from an in-memory counter. An
//      in-memory counter resets when the process restarts, which turns the throttle
//      into an inconvenience rather than a control.
//   2. The record has no field capable of holding the supplied key (FR-035). This is
//      asserted against the schema rather than against one written document, because a
//      document that happens not to carry a key is not evidence that none can.
describe("maintainer sign-in throttle", () => {
  const clientKey = clientKeyFor("203.0.113.9");

  beforeAll(async () => {
    await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("hashes the client identity rather than storing the address itself", () => {
    const key = clientKeyFor("203.0.113.9");
    expect(key).not.toContain("203.0.113.9");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    // Same input, same key: the throttle has to be able to count a client's
    // refusals, which a salted-per-call hash would make impossible.
    expect(clientKeyFor("203.0.113.9")).toBe(key);
    expect(clientKeyFor("203.0.113.10")).not.toBe(key);
  });

  it("is not throttled with no refusals recorded", async () => {
    const verdict = await isThrottled(clientKey);
    expect(verdict.throttled).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(0);
  });

  it("derives the count from the collection rather than an in-memory counter", async () => {
    // Written straight to the collection, bypassing recordRefusal entirely. A service
    // counting in memory would still report zero here.
    const now = Date.now();
    await MaintainerSignInAttempt.insertMany(
      Array.from({ length: config.MAINTAINER_SIGNIN_MAX_FAILURES }, (_, i) => ({
        clientKey,
        at: new Date(now - i * 1000),
        outcome: "refused" as const,
      })),
    );

    const verdict = await isThrottled(clientKey);
    expect(verdict.throttled).toBe(true);
  });

  it("throttles at the configured threshold, not before it", async () => {
    for (let i = 0; i < config.MAINTAINER_SIGNIN_MAX_FAILURES - 1; i += 1) {
      await recordRefusal(clientKey);
    }
    expect((await isThrottled(clientKey)).throttled).toBe(false);

    await recordRefusal(clientKey);
    expect((await isThrottled(clientKey)).throttled).toBe(true);
  });

  it("counts only refusals inside the cooling-off window", async () => {
    const outsideWindow = new Date(
      Date.now() - (config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS + 60) * 1000,
    );
    await MaintainerSignInAttempt.insertMany(
      Array.from({ length: config.MAINTAINER_SIGNIN_MAX_FAILURES + 3 }, () => ({
        clientKey,
        at: outsideWindow,
        outcome: "refused" as const,
      })),
    );

    const verdict = await isThrottled(clientKey);
    expect(verdict.throttled).toBe(false);
  });

  it("computes the remaining seconds from the oldest in-window refusal", async () => {
    // The oldest in-window refusal is what expires first, so it is what decides when
    // the window clears. Measuring from the newest would extend the lock-out every
    // time an attempt is made, which is a different (and harsher) control than FR-034
    // describes.
    const cooldown = config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS;
    const oldestAgeSeconds = Math.floor(cooldown / 2);
    const now = Date.now();

    await MaintainerSignInAttempt.insertMany([
      { clientKey, at: new Date(now - oldestAgeSeconds * 1000), outcome: "refused" as const },
      ...Array.from({ length: config.MAINTAINER_SIGNIN_MAX_FAILURES - 1 }, () => ({
        clientKey,
        at: new Date(now),
        outcome: "refused" as const,
      })),
    ]);

    const verdict = await isThrottled(clientKey);
    expect(verdict.throttled).toBe(true);
    // cooldown - oldestAge, allowing a second either way for clock movement between
    // the insert and the read.
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(cooldown - oldestAgeSeconds - 1);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(cooldown - oldestAgeSeconds + 1);
  });

  it("counts each client separately", async () => {
    const other = clientKeyFor("198.51.100.4");
    for (let i = 0; i < config.MAINTAINER_SIGNIN_MAX_FAILURES; i += 1) {
      await recordRefusal(clientKey);
    }
    expect((await isThrottled(clientKey)).throttled).toBe(true);
    expect((await isThrottled(other)).throttled).toBe(false);
  });

  it("writes nothing on a successful sign-in — there is no success path to call", async () => {
    // The service exposes no `recordSuccess`. A successful sign-in leaves the
    // collection untouched, so the collection is a refusal record and not a sign-in
    // log that happens to include failures.
    const serviceModule = await import(
      "../../src/services/maintainer/signin-throttle-service.js"
    );
    const exported = Object.keys(serviceModule);
    expect(exported).not.toContain("recordSuccess");
    expect(exported).not.toContain("recordAttempt");
    expect(await MaintainerSignInAttempt.countDocuments({})).toBe(0);
  });

  it("records one document per refusal, with outcome refused", async () => {
    await recordRefusal(clientKey);
    await recordRefusal(clientKey);
    const docs = await MaintainerSignInAttempt.find({ clientKey }).lean();
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      expect(doc.outcome).toBe("refused");
      expect(doc.at).toBeInstanceOf(Date);
    }
  });

  it("has no schema path capable of holding the supplied key (FR-035)", async () => {
    const paths = Object.keys(MaintainerSignInAttempt.schema.paths);
    // `__v` is mongoose's own document version key, not a field this schema declares.
    // Listed here rather than filtered out, so the assertion stays an exact match: a
    // filter would be a place a future field could hide.
    expect(paths.sort()).toEqual(["__v", "_id", "at", "clientKey", "outcome"].sort());
    // `clientKey` is the hashed client identity, not the submitted secret. Named
    // explicitly so a future reader does not mistake it for one.
    expect(paths).not.toContain("key");
    expect(paths).not.toContain("maintainerKey");
    expect(paths).not.toContain("providedKey");
    expect(paths).not.toContain("suppliedKey");
  });

  it("stores a refusal's own supplied key nowhere, even when one is passed alongside", async () => {
    // recordRefusal takes only the client key. There is no second parameter for the
    // attempted secret, so there is nothing for a caller to leak by accident.
    expect(recordRefusal.length).toBe(1);
    await recordRefusal(clientKey);
    const raw = JSON.stringify(await MaintainerSignInAttempt.find({}).lean());
    expect(raw).not.toContain("test-maintainer-key");
  });
});
