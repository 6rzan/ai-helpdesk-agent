import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { MaintainerSignInAttempt } from "../../src/models/maintainer-signin-attempt.js";
import { config } from "../../src/config/index.js";

const MAINTAINER_KEY = "test-maintainer-key"; // matches vitest.config.ts test.env

// T009 (test-first, research.md R13). SC-011 is a claim about how the console refuses,
// so these are written before the middleware that has to satisfy them.
//
// Every request in this file arrives from the same client as far as the throttle is
// concerned: the service derives its client key from `req.ip`, and supertest talks to
// the app over loopback with no trust-proxy hop, so a header cannot make one request
// look like a different caller. That is a property of the deployment (one machine, no
// reverse proxy) rather than a limitation worked around here. The consequence is that
// any test needing a clean count clears the collection first, via `clearAttempts()`,
// and *per-client separation is asserted at the unit level* — see
// `tests/unit/maintainer-signin-throttle.test.ts`, which can call the service directly
// with two different client keys.
describe("Maintainer sign-in refusal (US1)", () => {
  let ctx: TestContext;

  function signIn(overrides: Partial<{ key: string; name: string }> = {}) {
    const headers: Record<string, string> = {};
    const key = overrides.key ?? MAINTAINER_KEY;
    const name = overrides.name ?? "Jordan Maintainer";
    if (key !== "__omit__") headers["x-maintainer-key"] = key;
    if (name !== "__omit__") headers["x-maintainer-name"] = name;
    return request(ctx.app).get("/api/maintainer/categories").set(headers);
  }

  async function clearAttempts(): Promise<void> {
    await MaintainerSignInAttempt.deleteMany({});
  }

  async function exhaustThreshold(): Promise<void> {
    await clearAttempts();
    for (let i = 0; i < config.MAINTAINER_SIGNIN_MAX_FAILURES; i += 1) {
      await signIn({ key: "wrong-key" });
    }
  }

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("MS-001: a correct key and name succeeds", async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
  });

  it("MS-002: a wrong key returns 401 MAINTAINER_KEY_INVALID", async () => {
    const res = await signIn({ key: "not-the-key" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MAINTAINER_KEY_INVALID");
  });

  it("MS-003: the 401 message is byte-identical for keys of different lengths and shapes (FR-004)", async () => {
    // A message that varied with the key would narrow it. Comparing the exact bytes
    // rather than a regex, because "same wording, different length hint" is precisely
    // the failure this guards against. The collection is cleared between candidates so
    // the throttle never converts a later 401 into a 429 and hides a difference.
    const candidates = [
      "a",
      "test-maintainer-ke",
      "test-maintainer-keyy",
      "TEST-MAINTAINER-KEY",
      "x".repeat(512),
      "",
      "{}",
      "../../etc/passwd",
    ];

    const bodies: string[] = [];
    for (const key of candidates) {
      await clearAttempts();
      const res = await signIn({ key });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MAINTAINER_KEY_INVALID");
      bodies.push(JSON.stringify(res.body));
    }
    expect(new Set(bodies).size).toBe(1);

    // An omitted header must be indistinguishable from a wrong one too.
    await clearAttempts();
    const omitted = await signIn({ key: "__omit__" });
    expect(JSON.stringify(omitted.body)).toBe(bodies[0]);
  });

  it("MS-004: a blank name returns 400 MAINTAINER_NAME_REQUIRED", async () => {
    const missing = await signIn({ name: "__omit__" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("MAINTAINER_NAME_REQUIRED");

    await clearAttempts();
    const whitespace = await signIn({ name: "   " });
    expect(whitespace.status).toBe(400);
    expect(whitespace.body.error.code).toBe("MAINTAINER_NAME_REQUIRED");
  });

  it("MS-005: the configured number of refusals then returns 429 with retryAfterSeconds", async () => {
    await clearAttempts();
    for (let i = 0; i < config.MAINTAINER_SIGNIN_MAX_FAILURES; i += 1) {
      const res = await signIn({ key: "wrong-key" });
      expect(res.status).toBe(401);
    }

    const throttled = await signIn({ key: "wrong-key" });
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe("MAINTAINER_SIGNIN_THROTTLED");
    expect(throttled.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(throttled.body.retryAfterSeconds).toBeLessThanOrEqual(
      config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS,
    );
  });

  it("MS-006: the 429 is returned before the key is compared, so it is not an oracle", async () => {
    // Once cooling off, the *correct* key is refused with the same 429 as a wrong one.
    // If the correct key got through, the throttle would tell an attacker exactly when
    // they had guessed right, which is worse than having no throttle at all.
    await exhaustThreshold();

    const withCorrectKey = await signIn();
    expect(withCorrectKey.status).toBe(429);
    expect(withCorrectKey.body.error.code).toBe("MAINTAINER_SIGNIN_THROTTLED");

    const withWrongKey = await signIn({ key: "still-wrong" });
    expect(withWrongKey.status).toBe(429);
    expect(withWrongKey.body.error.code).toBe("MAINTAINER_SIGNIN_THROTTLED");
  });

  it("MS-007: a blank name is also refused with 429 while cooling off, before any name check", async () => {
    await exhaustThreshold();
    const res = await signIn({ name: "__omit__" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("MAINTAINER_SIGNIN_THROTTLED");
  });

  it("MS-008: one MaintainerSignInAttempt exists per refused attempt", async () => {
    await clearAttempts();
    const refusals = 3;
    for (let i = 0; i < refusals; i += 1) {
      await signIn({ key: "wrong-key" });
    }
    expect(await MaintainerSignInAttempt.countDocuments({})).toBe(refusals);
  });

  it("MS-009: a successful sign-in records no attempt", async () => {
    await clearAttempts();
    const res = await signIn();
    expect(res.status).toBe(200);
    expect(await MaintainerSignInAttempt.countDocuments({})).toBe(0);
  });

  it("MS-010: a blank-name refusal is recorded as a refusal too", async () => {
    // A blank name with a correct key is still a refused sign-in attempt. Not counting
    // it would leave a channel that never trips the throttle.
    await clearAttempts();
    await signIn({ name: "__omit__" });
    expect(await MaintainerSignInAttempt.countDocuments({})).toBe(1);
  });

  it("MS-011: no document anywhere contains the submitted key (FR-035)", async () => {
    await clearAttempts();
    const secret = "super-secret-guess-9f2a";
    for (let i = 0; i < config.MAINTAINER_SIGNIN_MAX_FAILURES; i += 1) {
      await signIn({ key: secret });
    }

    const docs = JSON.stringify(await MaintainerSignInAttempt.find({}).lean());
    expect(docs).not.toContain(secret);
    // Also asserted against the real key, so a "we only redact wrong keys"
    // implementation would still fail here.
    expect(docs).not.toContain(MAINTAINER_KEY);
  });

  it("MS-012: no response body or header echoes the submitted key", async () => {
    await clearAttempts();
    const secret = "echo-check-key-71bd";
    const res = await signIn({ key: secret });
    expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(JSON.stringify(res.headers)).not.toContain(secret);
  });

  it("MS-013: the window clears once the oldest refusals age out", async () => {
    await clearAttempts();
    // Written directly at an age past the window rather than waiting it out: the
    // default cooling-off period is five minutes, and a test that sleeps for it is a
    // test nobody runs.
    const stale = new Date(Date.now() - (config.MAINTAINER_SIGNIN_COOLDOWN_SECONDS + 60) * 1000);
    await MaintainerSignInAttempt.insertMany(
      Array.from({ length: config.MAINTAINER_SIGNIN_MAX_FAILURES + 2 }, () => ({
        clientKey: "any-client",
        at: stale,
        outcome: "refused" as const,
      })),
    );

    const res = await signIn();
    expect(res.status).toBe(200);
  });
});
