import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";

describe("Auth API", () => {
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

  it("registers a new user account and signs them in", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("alex@example.com");
    expect(res.body.role).toBe("user");
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/session_token=/);
  });

  it("rejects duplicate email registration with a plain-language 409", async () => {
    await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    const res = await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Two", password: "another-pass" });

    expect(res.status).toBe(409);
    expect(typeof res.body.error.message).toBe("string");
  });

  it("logs in with correct credentials", async () => {
    await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: "alex@example.com", password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/session_token=/);
  });

  it("rejects wrong password with 401 and no account-existence leak", async () => {
    await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    const wrongPassword = await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: "alex@example.com", password: "wrong-password" });
    const unknownEmail = await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it("GET /auth/me returns the signed-in account", async () => {
    const agent = request.agent(ctx.app);
    await agent
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("alex@example.com");
  });

  it("change-password flips usingInitialPassword and invalidates other sessions", async () => {
    const firstSession = request.agent(ctx.app);
    await firstSession
      .post("/api/auth/register")
      .send({ email: "alex@example.com", displayName: "Alex Chen", password: "correct-horse" });

    const secondSession = request.agent(ctx.app);
    await secondSession
      .post("/api/auth/login")
      .send({ email: "alex@example.com", password: "correct-horse" });

    const changeRes = await firstSession
      .post("/api/auth/change-password")
      .send({ currentPassword: "correct-horse", newPassword: "new-correct-horse" });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.usingInitialPassword).toBe(false);

    const staleMe = await secondSession.get("/api/auth/me");
    expect(staleMe.status).toBe(401);

    const freshMe = await firstSession.get("/api/auth/me");
    expect(freshMe.status).toBe(200);
  });
});
