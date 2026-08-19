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
});
