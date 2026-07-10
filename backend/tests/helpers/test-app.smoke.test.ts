import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { startTestApp, stopTestApp, type TestContext } from "./test-app.js";

describe("test harness", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("TC-000: boots the app against an in-memory Mongo and reports healthy", async () => {
    const res = await request(ctx.app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("TC-001: wires the mock LLM provider into the factory", async () => {
    const healthy = await ctx.llm.health();
    expect(healthy).toBe(true);
  });
});
