import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { seedStaff, seedUser } from "../helpers/auth.js";

// US2 AS6 / FR-005 / FR-010: the whitelist, the endpoint registry, and the
// audit trail are versioned data and an append-only log respectively -- there
// is no runtime surface, in any role, that creates, edits, or disables any of
// them. No route exists to attempt this through, under any guessed shape.

// A representative sweep of plausible URLs a client (or a curious/malicious
// caller) might guess for mutating the whitelist, the endpoint registry, or
// the audit trail -- across every HTTP method that would constitute a write.
const MUTATION_ATTEMPTS: { method: "post" | "put" | "patch" | "delete"; path: string }[] = [
  // Policy / whitelist entries.
  { method: "post", path: "/api/policy" },
  { method: "post", path: "/api/policy/entries" },
  { method: "put", path: "/api/policy/unlock-account" },
  { method: "patch", path: "/api/policy/unlock-account" },
  { method: "delete", path: "/api/policy/unlock-account" },
  { method: "post", path: "/api/remediation/policy" },
  { method: "post", path: "/api/action-policy" },
  // Endpoint registry.
  { method: "post", path: "/api/endpoints" },
  { method: "put", path: "/api/endpoints/test-node-a" },
  { method: "patch", path: "/api/endpoints/test-node-a" },
  { method: "delete", path: "/api/endpoints/test-node-a" },
  { method: "post", path: "/api/remediation/endpoints" },
  { method: "post", path: "/api/endpoint-registry" },
  // Audit trail / action records (append-only -- FR-010).
  { method: "post", path: "/api/audit" },
  { method: "put", path: "/api/audit/000000000000000000000000" },
  { method: "patch", path: "/api/audit/000000000000000000000000" },
  { method: "delete", path: "/api/audit/000000000000000000000000" },
  { method: "post", path: "/api/actions" },
  { method: "put", path: "/api/actions/000000000000000000000000" },
  { method: "patch", path: "/api/actions/000000000000000000000000" },
  { method: "delete", path: "/api/actions/000000000000000000000000" },
  { method: "put", path: "/api/tickets/TP000001/actions/000000000000000000000000" },
  { method: "patch", path: "/api/tickets/TP000001/actions/000000000000000000000000" },
  { method: "delete", path: "/api/tickets/TP000001/actions/000000000000000000000000" },
];

describe("There is no route, in any role, that mutates the whitelist, endpoint registry, or audit trail (US2 AS6, FR-005, FR-010)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });
  afterEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("TC: every guessed mutation URL 404s for a plain employee account", async () => {
    const { cookie } = await seedUser();
    for (const attempt of MUTATION_ATTEMPTS) {
      const res = await request(ctx.app)[attempt.method](attempt.path).set("Cookie", cookie).send({});
      expect(res.status, `${attempt.method.toUpperCase()} ${attempt.path} as employee`).toBe(404);
    }
  });

  it("TC: every guessed mutation URL 404s for a staff account too -- no elevated role adds this surface", async () => {
    const { cookie } = await seedStaff();
    for (const attempt of MUTATION_ATTEMPTS) {
      const res = await request(ctx.app)[attempt.method](attempt.path).set("Cookie", cookie).send({});
      expect(res.status, `${attempt.method.toUpperCase()} ${attempt.path} as staff`).toBe(404);
    }
  });

  it("TC: the same URLs 404 even with no session at all -- absence of the surface, not merely an auth gate", async () => {
    for (const attempt of MUTATION_ATTEMPTS) {
      const res = await request(ctx.app)[attempt.method](attempt.path).send({});
      expect(res.status, `${attempt.method.toUpperCase()} ${attempt.path} unauthenticated`).toBe(404);
    }
  });
});
