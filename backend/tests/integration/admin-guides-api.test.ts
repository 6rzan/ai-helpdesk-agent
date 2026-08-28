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
    // 007 T015: the namespace moved from /api/admin to /api/maintainer. Principle III
    // states there is no admin role and no third role, and a path called /admin invites
    // exactly that reading (research.md R1). The conditional mount itself is unchanged.
    expect(source).toMatch(/if\s*\(\s*config\.MAINTAINER_KEY\s*\)\s*\{\s*\n\s*app\.use\("\/api\/maintainer",\s*adminGuidesRouter\)/);
    expect(source).not.toContain('app.use("/api/admin"');
  });

  it("AA-001: 401 when x-maintainer-key is missing", async () => {
    const res = await request(ctx.app)
      .get("/api/maintainer/categories")
      .set(adminHeaders({ key: "__omit__" }));
    expect(res.status).toBe(401);
  });

  it("AA-002: 401 when x-maintainer-key is wrong", async () => {
    const res = await request(ctx.app)
      .get("/api/maintainer/categories")
      .set(adminHeaders({ key: "wrong-key" }));
    expect(res.status).toBe(401);
  });

  it("AA-003: 400 when x-maintainer-name is missing", async () => {
    const res = await request(ctx.app)
      .get("/api/maintainer/categories")
      .set(adminHeaders({ name: "__omit__" }));
    expect(res.status).toBe(400);
  });

  it("AA-004: POST /admin/categories creates a category + guide v1 (201)", async () => {
    const res = await request(ctx.app)
      .post("/api/maintainer/categories")
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
    await request(ctx.app).post("/api/maintainer/categories").set(adminHeaders()).send(body);
    const res = await request(ctx.app).post("/api/maintainer/categories").set(adminHeaders()).send(body);
    expect(res.status).toBe(409);
  });

  it("AA-006: POST /admin/categories 422 on empty steps, previous content untouched", async () => {
    const res = await request(ctx.app)
      .post("/api/maintainer/categories")
      .set(adminHeaders())
      .send({
        name: "empty_steps_cat",
        displayName: "Empty",
        classificationDescription: "This should not be created because steps is empty",
        guide: { steps: [] },
      });
    expect(res.status).toBe(422);

    const list = await request(ctx.app).get("/api/maintainer/categories").set(adminHeaders());
    expect(list.body.categories.some((c: { name: string }) => c.name === "empty_steps_cat")).toBe(false);
  });

  it("AA-007: PUT /admin/categories/:name edits metadata only", async () => {
    await request(ctx.app)
      .post("/api/maintainer/categories")
      .set(adminHeaders())
      .send({
        name: "edit_target",
        displayName: "Original",
        classificationDescription: "Original description for the edit target category",
        guide: { steps: [{ instruction: "Do the original step instruction here.", successHint: "It works." }] },
      });

    const res = await request(ctx.app)
      .put("/api/maintainer/categories/edit_target")
      .set(adminHeaders())
      .send({ displayName: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.category.displayName).toBe("Renamed");
    expect(res.body.category.name).toBe("edit_target");
  });

  it("AA-008: DELETE /admin/categories/:name 403 MANDATED_CATEGORY_UNDELETABLE for the seeded six", async () => {
    const res = await request(ctx.app).delete("/api/maintainer/categories/printer").set(adminHeaders());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("MANDATED_CATEGORY_UNDELETABLE");
  });

  it("AA-009: DELETE /admin/categories/:name soft-retires a custom category", async () => {
    await request(ctx.app)
      .post("/api/maintainer/categories")
      .set(adminHeaders())
      .send({
        name: "retire_target",
        displayName: "Retire me",
        classificationDescription: "A category created only to be retired in this test",
        guide: { steps: [{ instruction: "Do the retire-target step instruction.", successHint: "It works." }] },
      });

    const res = await request(ctx.app).delete("/api/maintainer/categories/retire_target").set(adminHeaders());
    expect(res.status).toBe(200);
    expect(res.body.category.retired).toBe(true);
  });

  it("AA-010: POST /admin/categories/:name/guide publishes version n+1 (201)", async () => {
    const res = await request(ctx.app)
      .post("/api/maintainer/categories/printer/guide")
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
      .post("/api/maintainer/categories/printer/guide")
      .set(adminHeaders())
      .send({ steps: [{ instruction: "Cancel and resend the print job now.", successHint: "It prints." }] });

    const res = await request(ctx.app)
      .get("/api/maintainer/categories/printer/guide/versions")
      .set(adminHeaders());
    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBeGreaterThanOrEqual(2);
    for (const version of res.body.versions) {
      expect(version).toHaveProperty("changedBy");
      expect(version).toHaveProperty("changedAt");
    }
    expect(res.body.versions.filter((v: { active: boolean }) => v.active)).toHaveLength(1);
  });

  // --- 007 T016: step-level guide validation (FR-013, research.md R12) --------
  //
  // FR-013 asks a rejected guide to identify the offending **step and field**, not just
  // report that the guide is invalid, so the editor can put the message on the step the
  // maintainer is looking at instead of above a list of twenty.
  //
  // Two kinds of failure are kept apart on purpose:
  //   - count-level (no steps at all, or more than the maximum) keeps the
  //     `422 INVALID_GUIDE_STEPS` that 003 shipped and that 003's quickstart evidence
  //     records. A guide with zero steps has no offending step to point at, so FR-013
  //     has nothing to add and changing the status would invalidate that evidence.
  //   - step-level returns the new `400 GUIDE_STEP_INVALID` with `stepIndex` and
  //     `field`.
  describe("guide step validation (007 FR-013)", () => {
    function goodStep(n = 1) {
      return {
        instruction: `Perform validation step ${n} exactly as written in this instruction.`,
        successHint: "The step completes without error.",
      };
    }

    function publish(steps: unknown[]) {
      return request(ctx.app)
        .post("/api/maintainer/categories/printer/guide")
        .set(adminHeaders())
        .send({ steps });
    }

    it("AA-012: a zero-step guide is a count-level 422, not a step-level error", async () => {
      const res = await publish([]);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("INVALID_GUIDE_STEPS");
      // No stepIndex, because there is no step to index.
      expect(res.body.stepIndex).toBeUndefined();
    });

    it("AA-013: an over-maximum guide is a count-level 422", async () => {
      const res = await publish(Array.from({ length: 21 }, (_, i) => goodStep(i + 1)));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("INVALID_GUIDE_STEPS");
      expect(res.body.stepIndex).toBeUndefined();
    });

    it("AA-014: a step missing its instruction names that step and field", async () => {
      const res = await publish([
        goodStep(1),
        { successHint: "The step completes without error." },
        goodStep(3),
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(1);
      expect(res.body.field).toBe("instruction");
      // The message counts steps the way a person does, from 1.
      expect(res.body.error.message).toContain("Step 2");
    });

    it("AA-015: a step missing its success hint names that step and field", async () => {
      const res = await publish([
        goodStep(1),
        goodStep(2),
        { instruction: "Perform the third step exactly as written in this instruction." },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(2);
      expect(res.body.field).toBe("successHint");
      expect(res.body.error.message).toContain("Step 3");
    });

    it("AA-016: a blank-string field is treated as missing, not as a short value", async () => {
      const res = await publish([{ instruction: "   ", successHint: "It works fine." }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(0);
      expect(res.body.field).toBe("instruction");
    });

    it("AA-017: a too-short instruction is reported on its own step", async () => {
      const res = await publish([{ instruction: "Reboot", successHint: "It works fine." }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(0);
      expect(res.body.field).toBe("instruction");
    });

    it("AA-018: an over-long success hint is reported on its own step", async () => {
      const res = await publish([{ instruction: goodStep().instruction, successHint: "x".repeat(301) }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(0);
      expect(res.body.field).toBe("successHint");
    });

    it("AA-019: the first offending step is the one reported", async () => {
      // Two broken steps. The editor puts the message on one step, so reporting the
      // earlier one keeps the maintainer moving forward through the list rather than
      // back and forth.
      const res = await publish([
        goodStep(1),
        { successHint: "The step completes without error." },
        { instruction: "Perform the third step exactly as written in this instruction." },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.stepIndex).toBe(1);
      expect(res.body.field).toBe("instruction");
    });

    it("AA-020: a rejected guide publishes nothing", async () => {
      const before = await request(ctx.app)
        .get("/api/maintainer/categories/printer/guide/versions")
        .set(adminHeaders());
      const versionsBefore = before.body.versions.length;

      await publish([{ successHint: "The step completes without error." }]);

      const after = await request(ctx.app)
        .get("/api/maintainer/categories/printer/guide/versions")
        .set(adminHeaders());
      expect(after.body.versions).toHaveLength(versionsBefore);
      expect(after.body.versions.filter((v: { active: boolean }) => v.active)).toHaveLength(1);
    });

    it("AA-021: category creation reports step-level errors the same way", async () => {
      // Same validation, reached through the other route that takes a guide. A guide
      // rejected here must also leave no category behind.
      const res = await request(ctx.app)
        .post("/api/maintainer/categories")
        .set(adminHeaders())
        .send({
          name: "step_error_target",
          displayName: "Step error target",
          classificationDescription: "A category whose creation should fail on its guide steps",
          guide: { steps: [goodStep(1), { successHint: "The step completes without error." }] },
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GUIDE_STEP_INVALID");
      expect(res.body.stepIndex).toBe(1);
      expect(res.body.field).toBe("instruction");

      const list = await request(ctx.app).get("/api/maintainer/categories").set(adminHeaders());
      expect(
        list.body.categories.some((c: { name: string }) => c.name === "step_error_target"),
      ).toBe(false);
    });
  });
});
