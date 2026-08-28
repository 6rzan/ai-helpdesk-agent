import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { config } from "../../src/config/index.js";

// T010 (US1). `GET /api/maintainer/status` is the probe the console reads before it
// decides whether to render a sign-in form at all (FR-005, research.md R2).
//
// The `enabled: false` case is exercised by clearing `config.MAINTAINER_KEY` for the
// duration of one request and restoring it afterwards. Config is parsed once per
// process, so the alternative — a second app built under a different environment —
// would need a second process. Mutating the singleton is the smaller of the two
// distortions, and it exercises the real route rather than a source-level assertion,
// which is what makes it worth doing here.
describe("GET /api/maintainer/status (US1)", () => {
  let ctx: TestContext;

  async function withMaintainerKeyUnset<T>(fn: () => Promise<T>): Promise<T> {
    const original = config.MAINTAINER_KEY;
    (config as { MAINTAINER_KEY?: string | undefined }).MAINTAINER_KEY = undefined;
    try {
      return await fn();
    } finally {
      (config as { MAINTAINER_KEY?: string | undefined }).MAINTAINER_KEY = original;
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

  it("MST-001: returns 200 {\"enabled\":true} with MAINTAINER_KEY set", async () => {
    const res = await request(ctx.app).get("/api/maintainer/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it("MST-002: returns 200 {\"enabled\":false} with MAINTAINER_KEY unset", async () => {
    const res = await withMaintainerKeyUnset(() =>
      request(ctx.app).get("/api/maintainer/status"),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it("MST-003: is mounted with the key unset — 200, never 404", async () => {
    // The whole point of the probe is to answer while administration is switched off.
    // A 404 here would leave the console unable to tell "not enabled" apart from
    // "wrong URL", which is the confusion FR-005 exists to prevent.
    const res = await withMaintainerKeyUnset(() =>
      request(ctx.app).get("/api/maintainer/status"),
    );
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
  });

  it("MST-004: the mount is unconditional in app.ts, not inside the MAINTAINER_KEY guard", async () => {
    // A source-level check alongside the runtime ones above: the runtime tests use one
    // app instance, so they cannot observe a mount decision taken at construction time
    // under a different environment. This can.
    const path = fileURLToPath(new URL("../../src/app.ts", import.meta.url));
    const source = readFileSync(path, "utf-8");

    const guardIndex = source.indexOf("if (config.MAINTAINER_KEY)");
    const statusMountIndex = source.indexOf('app.use("/api", maintainerStatusRouter)');
    expect(statusMountIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(-1);
    // The status mount comes before the conditional block, so it cannot be inside it.
    expect(statusMountIndex).toBeLessThan(guardIndex);
  });

  it("MST-005: requires no authentication", async () => {
    // No session cookie, no maintainer headers, no key.
    const res = await request(ctx.app).get("/api/maintainer/status");
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it("MST-006: a wrong maintainer key does not change the answer", async () => {
    // The probe is not an authentication surface. If a wrong key changed the response
    // it would have become one, and a slow one to compare against at that.
    const res = await request(ctx.app)
      .get("/api/maintainer/status")
      .set("x-maintainer-key", "definitely-wrong");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it("MST-007: discloses nothing beyond the boolean", async () => {
    const res = await request(ctx.app).get("/api/maintainer/status");
    expect(Object.keys(res.body)).toEqual(["enabled"]);

    // Named explicitly rather than trusting the key count: these are the things a
    // reader might reasonably expect a status endpoint to include, and each of them
    // would narrow the key or describe the deployment.
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain("test-maintainer-key");
    expect(serialised).not.toContain("keyLength");
    expect(serialised).not.toContain("version");
    expect(serialised).not.toContain("categories");
  });
});
