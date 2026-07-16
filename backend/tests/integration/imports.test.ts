import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { UserAccount } from "../../src/models/user-account.js";
import { hashPassword } from "../../src/services/auth/password-service.js";
import { issueSession, sessionCookie } from "../../src/services/auth/session-service.js";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";

describe("profile imports", () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp(); });
  afterEach(async () => { await resetDb(); });
  afterAll(async () => { await stopTestApp(); });
  async function staff() { const h = await hashPassword("staff-password"); const a = await UserAccount.create({ email: `staff-${Date.now()}@example.test`, displayName: "Import Staff", role: "staff", ...h, usingInitialPassword: true }); return { Cookie: `${sessionCookie.name}=${await issueSession(a._id)}` }; }
  async function workbook() { const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Users"); sheet.addRows([["Email", "Name", "Location"], ["new@example.test", "New User", "B1"], ["new@example.test", "Duplicate", "B2"], ["", "Missing", "B3"]]); return Buffer.from(await book.xlsx.writeBuffer()); }
  it("uploads, requires email mapping, previews row outcomes, and applies created accounts", async () => { const auth = await staff(); const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", await workbook(), "users.xlsx"); expect(upload.status).toBe(201); const id = upload.body.importId; const missing = await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Name: "displayName" } }); expect(missing.status).toBe(400); const mapped = await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName", Location: "location" } }); expect(mapped.status).toBe(200); const preview = await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth); expect(preview.status).toBe(200); expect(preview.body.outcomes.map((x: { outcome: string }) => x.outcome)).toEqual(["created", "rejected", "rejected"]); const applied = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(applied.status).toBe(200); expect(await UserAccount.exists({ email: "new@example.test" })).toBeTruthy(); });
  it("rejects unreadable uploads before creating an import", async () => { const response = await request(ctx.app).post("/api/staff/imports").set(await staff()).attach("file", Buffer.from("not xlsx"), "bad.xlsx"); expect(response.status).toBe(400); });
});
