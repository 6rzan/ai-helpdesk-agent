import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";
import { resetSessionStore } from "../../src/services/session/session-service.js";

const MAINTAINER_KEY = "test-maintainer-key"; // matches vitest.config.ts test.env

function adminHeaders(overrides: Partial<{ key: string; name: string }> = {}) {
  const headers: Record<string, string> = {};
  const key = overrides.key ?? MAINTAINER_KEY;
  const name = overrides.name ?? "Jordan Maintainer";
  if (key !== "__omit__") headers["x-maintainer-key"] = key;
  if (name !== "__omit__") headers["x-maintainer-name"] = name;
  return headers;
}

describe("Maintainer admin API (US4)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestApp();
  });

  afterEach(async () => {
    await resetDb();
    resetSessionStore();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  it("AA-000: routes are mounted only when MAINTAINER_KEY is configured (source-level guard, since config is a process-wide singleton)", () => {
    const path = fileURLToPath(new URL("../../src/app.ts", import.meta.url));
    const source = readFileSync(path, "utf-8");
    expect(source).toMatch(/if\s*\(\s*config\.MAINTAINER_KEY\s*\)\s*\{\s*\n\s*app\.use\("\/api\/admin",\s*adminGuidesRouter\)/);
  });

  it("AA-001: 401 when x-maintainer-key is missing", async () => {
    const res = await request(ctx.app)
      .get("/api/admin/categories")
      .set(adminHeaders({ key: "__omit__" }));
    expect(res.status).toBe(401);
  });

  it("AA-002: 401 when x-maintainer-key is wrong", async () => {
    const res = await request(ctx.app)
      .get("/api/admin/categories")
      .set(adminHeaders({ key: "wrong-key" }));
    expect(res.status).toBe(401);
  });

  it("AA-003: 400 when x-maintainer-name is missing", async () => {
    const res = await request(ctx.app)
      .get("/api/admin/categories")
      .set(adminHeaders({ name: "__omit__" }));
    expect(res.status).toBe(400);
  });

  it("AA-004: POST /admin/categories creates a category + guide v1 (201)", async () => {
    const res = await request(ctx.app)
      .post("/api/admin/categories")
      .set(adminHeaders())
      .send({
        name: "email_calendar",
        displayName: "Email & calendar",
        classificationDescription: "Problems sending/receiving email or using calendar invites",
        guide: {
          steps: [{ instruction: "Sign out and back in to the email client.", successHint: "Email sends and receives normally." }],
          changeNote: "initial guide",
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe("email_calendar");
    expect(res.body.guide.version).toBe(1);
    expect(res.body.guide.active).toBe(true);
  });

  it("AA-005: POST /admin/categories 409 on duplicate name", async () => {
    const body = {
      name: "email_calendar",
      displayName: "Email & calendar",
      classificationDescription: "Problems sending/receiving email or using calendar invites",
      guide: { steps: [{ instruction: "Sign out and back in to the email client.", successHint: "Works again." }] },
    };
    await request(ctx.app).post("/api/admin/categories").set(adminHeaders()).send(body);
    const res = await request(ctx.app).post("/api/admin/categories").set(adminHeaders()).send(body);
    expect(res.status).toBe(409);
  });

  it("AA-006: POST /admin/categories 422 on empty steps, previous content untouched", async () => {
    const res = await request(ctx.app)
      .post("/api/admin/categories")
      .set(adminHeaders())
      .send({
        name: "empty_steps_cat",
        displayName: "Empty",
        classificationDescription: "This should not be created because steps is empty",
        guide: { steps: [] },
      });
    expect(res.status).toBe(422);

    const list = await request(ctx.app).get("/api/admin/categories").set(adminHeaders());
    expect(list.body.categories.some((c: { name: string }) => c.name === "empty_steps_cat")).toBe(false);
  });

  it("AA-007: PUT /admin/categories/:name edits metadata only", async () => {
    await request(ctx.app)
      .post("/api/admin/categories")
      .set(adminHeaders())
      .send({
        name: "edit_target",
        displayName: "Original",
        classificationDescription: "Original description for the edit target category",
        guide: { steps: [{ instruction: "Do the original step instruction here.", successHint: "It works." }] },
      });

    const res = await request(ctx.app)
      .put("/api/admin/categories/edit_target")
      .set(adminHeaders())
      .send({ displayName: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.category.displayName).toBe("Renamed");
    expect(res.body.category.name).toBe("edit_target");
  });

  it("AA-008: DELETE /admin/categories/:name 403 MANDATED_CATEGORY_UNDELETABLE for the seeded six", async () => {
    const res = await request(ctx.app).delete("/api/admin/categories/printer").set(adminHeaders());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("MANDATED_CATEGORY_UNDELETABLE");
  });

  it("AA-009: DELETE /admin/categories/:name soft-retires a custom category", async () => {
    await request(ctx.app)
      .post("/api/admin/categories")
      .set(adminHeaders())
      .send({
        name: "retire_target",
        displayName: "Retire me",
        classificationDescription: "A category created only to be retired in this test",
        guide: { steps: [{ instruction: "Do the retire-target step instruction.", successHint: "It works." }] },
      });

    const res = await request(ctx.app).delete("/api/admin/categories/retire_target").set(adminHeaders());
    expect(res.status).toBe(200);
    expect(res.body.category.retired).toBe(true);
  });

  it("AA-010: POST /admin/categories/:name/guide publishes version n+1 (201)", async () => {
    const res = await request(ctx.app)
      .post("/api/admin/categories/printer/guide")
      .set(adminHeaders())
      .send({
        steps: [{ instruction: "Restart the printer using the power button.", successHint: "Printer reconnects." }],
        changeNote: "reworded step",
      });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
    expect(res.body.active).toBe(true);
  });

  it("AA-011: GET /admin/categories/:name/guide/versions returns full history with changedBy/changedAt", async () => {
    await request(ctx.app)
      .post("/api/admin/categories/printer/guide")
      .set(adminHeaders())
      .send({ steps: [{ instruction: "Cancel and resend the print job now.", successHint: "It prints." }] });

    const res = await request(ctx.app)
      .get("/api/admin/categories/printer/guide/versions")
      .set(adminHeaders());
    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBeGreaterThanOrEqual(2);
    for (const version of res.body.versions) {
      expect(version).toHaveProperty("changedBy");
      expect(version).toHaveProperty("changedAt");
    }
    expect(res.body.versions.filter((v: { active: boolean }) => v.active)).toHaveLength(1);
  });
});
