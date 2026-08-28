import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { hashPassword } from "../../src/services/auth/password-service.js";
import { UserAccount } from "../../src/models/user-account.js";
import { issueSession, sessionCookie } from "../../src/services/auth/session-service.js";
import { requireAuth } from "../../src/api/middleware/require-auth.js";
import { requireStaff } from "../../src/api/middleware/require-staff.js";
import { errorHandler, notFoundHandler } from "../../src/api/middleware/error-handler.js";
import { seedStaff, seedUser } from "../helpers/auth.js";

function buildProbeApp(): Express {
  const app = express();
  app.use(cookieParser());
  app.get("/api/probe/auth", requireAuth, (req, res) => {
    res.status(200).json({ accountId: req.account!._id.toString() });
  });
  app.get("/api/probe/staff", requireAuth, requireStaff, (req, res) => {
    res.status(200).json({ accountId: req.account!._id.toString() });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("access control (requireAuth / requireStaff)", () => {
  let probeApp: Express;
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
    probeApp = buildProbeApp();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  async function createAccount(role: "user" | "staff") {
    const { passwordHash, passwordSalt } = await hashPassword("correct-horse-battery");
    const account = await UserAccount.create({
      email: `${role}-${Date.now()}-${Math.random()}@example.com`,
      displayName: `${role} person`,
      role,
      passwordHash,
      passwordSalt,
    });
    const token = await issueSession(account._id);
    return { account, token };
  }

  it("AC-001: signed-out request to an authenticated route gets 401 with no data", async () => {
    const res = await request(probeApp).get("/api/probe/auth");
    expect(res.status).toBe(401);
    expect(res.body.accountId).toBeUndefined();
  });

  it("AC-002: regular user hitting a staff-only route gets 403 with no data", async () => {
    const { token } = await createAccount("user");
    const res = await request(probeApp)
      .get("/api/probe/staff")
      .set("Cookie", `${sessionCookie.name}=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.accountId).toBeUndefined();
  });

  it("AC-003: staff account passes both requireAuth and requireStaff", async () => {
    const { token } = await createAccount("staff");
    const res = await request(probeApp)
      .get("/api/probe/staff")
      .set("Cookie", `${sessionCookie.name}=${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.accountId).toBe("string");
  });

  it("AC-004: role revoked mid-session is refused on the very next request (per-request re-read)", async () => {
    const { account, token } = await createAccount("staff");
    const first = await request(probeApp)
      .get("/api/probe/staff")
      .set("Cookie", `${sessionCookie.name}=${token}`);
    expect(first.status).toBe(200);

    await UserAccount.updateOne({ _id: account._id }, { $set: { role: "user" } });

    const second = await request(probeApp)
      .get("/api/probe/staff")
      .set("Cookie", `${sessionCookie.name}=${token}`);
    expect(second.status).toBe(403);
  });

  // T086/US4 AS6: the real 005 staff surfaces, not the synthetic probe app —
  // a non-staff account gets 403 with no action/approval/remediation data in
  // the body from any of them.
  describe("005 remediation surfaces", () => {
    it("refuses a non-staff account on /staff/actions with 403 and no data", async () => {
      const user = await seedUser();
      const res = await request(ctx.app).get("/api/staff/actions").set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.actions).toBeUndefined();
    });

    it("refuses a non-staff account on /staff/approvals with 403 and no data", async () => {
      const user = await seedUser();
      const res = await request(ctx.app).get("/api/staff/approvals").set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.approvals).toBeUndefined();
    });

    it("refuses a non-staff account on /staff/remediation with 403 and no data", async () => {
      const user = await seedUser();
      const res = await request(ctx.app).get("/api/staff/remediation").set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.globallyEnabled).toBeUndefined();
      expect(res.body.endpoints).toBeUndefined();
    });

    it("a staff account reaches all three", async () => {
      const staff = await seedStaff();
      const actions = await request(ctx.app).get("/api/staff/actions").set("Cookie", staff.cookie);
      const approvals = await request(ctx.app).get("/api/staff/approvals").set("Cookie", staff.cookie);
      const remediation = await request(ctx.app).get("/api/staff/remediation").set("Cookie", staff.cookie);
      expect(actions.status).toBe(200);
      expect(approvals.status).toBe(200);
      expect(remediation.status).toBe(200);
    });
  });

  // --- 007 T025: the profile-field surfaces (FR-015, FR-027, SC-006) ----------
  //
  // TEST-FIRST (research.md R13). SC-006 claims 100% of role-restricted operations are
  // refused for the wrong role, and a claim of 100% is only worth as much as the cases
  // that would fail if a guard were dropped. Written before T032 and T033.
  //
  // Every case asserts on the *body* as well as the status, because a route that refuses
  // with 403 and still serialises the profile has leaked exactly what the guard exists
  // to protect.
  describe("007 profile field surfaces", () => {
    async function targetAccountId(): Promise<string> {
      const target = await seedUser({ displayName: "Target Person" });
      return (target.account._id as { toString(): string }).toString();
    }

    it("AC-005: a non-staff account is refused the staff profile read with no profile in the body", async () => {
      const user = await seedUser();
      const id = await targetAccountId();
      const res = await request(ctx.app)
        .get(`/api/staff/users/${id}/profile`)
        .set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.profile).toBeUndefined();
    });

    it("AC-006: a non-staff account is refused the per-field save with no profile in the body", async () => {
      const user = await seedUser();
      const id = await targetAccountId();
      const res = await request(ctx.app)
        .put(`/api/staff/users/${id}/profile/fields`)
        .set("Cookie", user.cookie)
        .send({ fields: { location: { value: "Lab 3", expectedSetAt: null } } });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.profile).toBeUndefined();
      expect(res.body.results).toBeUndefined();
    });

    it("AC-007: a non-staff account is refused the release with no profile in the body", async () => {
      const user = await seedUser();
      const id = await targetAccountId();
      const res = await request(ctx.app)
        .post(`/api/staff/users/${id}/profile/fields/location/release`)
        .set("Cookie", user.cookie)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.profile).toBeUndefined();
    });

    it("AC-008: a non-staff account is refused the field history with no history in the body", async () => {
      // FR-018 makes history staff-only, and this is the route that would leak a value
      // an account owner is no longer allowed to see attributed.
      const user = await seedUser();
      const id = await targetAccountId();
      const res = await request(ctx.app)
        .get(`/api/staff/users/${id}/profile/fields/location/history`)
        .set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.history).toBeUndefined();
    });

    it("AC-009: an account owner is refused the history for their own profile", async () => {
      // Owning the profile is not a route to the history. The record exists for staff.
      const owner = await seedUser();
      const id = (owner.account._id as { toString(): string }).toString();
      const res = await request(ctx.app)
        .get(`/api/staff/users/${id}/profile/fields/location/history`)
        .set("Cookie", owner.cookie);
      expect(res.status).toBe(403);
      expect(res.body.history).toBeUndefined();
    });

    it("AC-010: every one of the four is 401 when signed out", async () => {
      const id = await targetAccountId();
      const responses = await Promise.all([
        request(ctx.app).get(`/api/staff/users/${id}/profile`),
        request(ctx.app)
          .put(`/api/staff/users/${id}/profile/fields`)
          .send({ fields: { location: { value: "Lab 3", expectedSetAt: null } } }),
        request(ctx.app).post(`/api/staff/users/${id}/profile/fields/location/release`).send({}),
        request(ctx.app).get(`/api/staff/users/${id}/profile/fields/location/history`),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body.profile).toBeUndefined();
        expect(res.body.history).toBeUndefined();
      }
    });
  });

  // --- 007 T025: the two axes never meet (FR-015, contracts/api.md) -----------
  //
  // The maintainer is a shared-secret header, not an account (Principle III). A valid
  // key must therefore be worth nothing on the account axis: it is not a super-role, and
  // the failure this guards against is someone later "helpfully" teaching requireAuth to
  // accept it.
  describe("007 account directory access", () => {
    // Test-first (research.md R13): SC-006 claims every staff-only route refuses a
    // non-staff caller, and a claim of 100% is only worth anything if the refusal was
    // written before the route that has to satisfy it.

    it("AC-014: refuses a signed-out caller on /staff/accounts with 401 and no data", async () => {
      const res = await request(ctx.app).get("/api/staff/accounts");
      expect(res.status).toBe(401);
      expect(res.body.accounts).toBeUndefined();
    });

    it("AC-015: refuses a signed-in non-staff account with 403 and no data", async () => {
      const user = await seedUser();
      const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.accounts).toBeUndefined();
    });

    it("AC-016: refuses a non-staff account carrying a search term, without answering it", async () => {
      // A refusal that still reports "no matches" would confirm or deny the existence of
      // an account to someone with no right to ask.
      const user = await seedUser();
      const res = await request(ctx.app)
        .get("/api/staff/accounts")
        .query({ q: "amina" })
        .set("Cookie", user.cookie);
      expect(res.status).toBe(403);
      expect(res.body.accounts).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("amina");
    });

    it("AC-017: a staff account reaches the directory", async () => {
      const staff = await seedStaff();
      const res = await request(ctx.app).get("/api/staff/accounts").set("Cookie", staff.cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.accounts)).toBe(true);
    });
  });

  describe("007 maintainer key on account routes", () => {
    const MAINTAINER_KEY = "test-maintainer-key"; // matches vitest.config.ts test.env

    const maintainerHeaders = {
      "x-maintainer-key": MAINTAINER_KEY,
      "x-maintainer-name": "Jordan Maintainer",
    };

    it("AC-011: a valid maintainer key reaches no /api/staff/* route", async () => {
      const target = await seedUser();
      const id = (target.account._id as { toString(): string }).toString();
      const responses = await Promise.all([
        request(ctx.app).get("/api/staff/actions").set(maintainerHeaders),
        request(ctx.app).get("/api/staff/approvals").set(maintainerHeaders),
        request(ctx.app).get(`/api/staff/users/${id}/profile`).set(maintainerHeaders),
        request(ctx.app)
          .put(`/api/staff/users/${id}/profile/fields`)
          .set(maintainerHeaders)
          .send({ fields: { location: { value: "Lab 3", expectedSetAt: null } } }),
        request(ctx.app)
          .get(`/api/staff/users/${id}/profile/fields/location/history`)
          .set(maintainerHeaders),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body.profile).toBeUndefined();
        expect(res.body.actions).toBeUndefined();
        expect(res.body.history).toBeUndefined();
      }
    });

    it("AC-012: a valid maintainer key reaches no /api/my/* route", async () => {
      const responses = await Promise.all([
        request(ctx.app).get("/api/my/profile").set(maintainerHeaders),
        request(ctx.app)
          .put("/api/my/profile")
          .set(maintainerHeaders)
          .send({ location: "Lab 3", hardware: "", remoteAccessIds: [] }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body.profile).toBeUndefined();
      }
    });

    it("AC-013: a signed-in account gets nothing extra from also sending a maintainer key", async () => {
      // Belt and braces: the key must not be an escalation path for someone who already
      // has an ordinary session.
      const user = await seedUser();
      const target = await seedUser();
      const id = (target.account._id as { toString(): string }).toString();
      const res = await request(ctx.app)
        .get(`/api/staff/users/${id}/profile`)
        .set("Cookie", user.cookie)
        .set(maintainerHeaders);
      expect(res.status).toBe(403);
      expect(res.body.profile).toBeUndefined();
    });
  });
});
