import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { UserAccount } from "../../src/models/user-account.js";
import { SupportProfile } from "../../src/models/support-profile.js";
import { hashPassword } from "../../src/services/auth/password-service.js";
import { issueSession, sessionCookie } from "../../src/services/auth/session-service.js";
import { resetDb, startTestApp, stopTestApp, type TestContext } from "../helpers/test-app.js";

describe("profile imports", () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ transactions: true }); });
  afterEach(async () => { await resetDb(); });
  afterAll(async () => { await stopTestApp(); });
  async function staff() { const h = await hashPassword("staff-password"); const a = await UserAccount.create({ email: `staff-${Date.now()}@example.test`, displayName: "Import Staff", role: "staff", ...h, usingInitialPassword: true }); return { Cookie: `${sessionCookie.name}=${await issueSession(a._id)}` }; }
  async function workbook() { const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Users"); sheet.addRows([["Email", "Name", "Location"], ["new@example.test", "New User", "B1"], ["new@example.test", "Duplicate", "B2"], ["", "Missing", "B3"]]); return Buffer.from(await book.xlsx.writeBuffer()); }
  it("uploads, requires email mapping, previews row outcomes, and applies only valid accounts", async () => { const auth = await staff(); const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", await workbook(), "users.xlsx"); expect(upload.status).toBe(201); const id = upload.body.importId; const missing = await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Name: "displayName" } }); expect(missing.status).toBe(400); const mapped = await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName", Location: "location" } }); expect(mapped.status).toBe(200); const preview = await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth); expect(preview.status).toBe(200); expect(preview.body.outcomes.map((x: { outcome: string }) => x.outcome)).toEqual(["created", "rejected", "rejected"]); const applied = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(applied.status).toBe(200); expect(applied.body.outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3, outcome: "rejected", reason: "Duplicate email in this file." }), expect.objectContaining({ row: 4, outcome: "rejected", reason: "A valid email is required." })])); expect(await UserAccount.countDocuments({ email: "new@example.test" })).toBe(1); expect(await UserAccount.exists({ displayName: "Missing" })).toBeNull(); });
  it("rejects unreadable uploads before creating an import", async () => { const response = await request(ctx.app).post("/api/staff/imports").set(await staff()).attach("file", Buffer.from("not xlsx"), "bad.xlsx"); expect(response.status).toBe(400); });
  it("returns the API validation contract for missing or invalid upload metadata", async () => {
    const auth = await staff();
    const missing = await request(ctx.app).post("/api/staff/imports").set(auth);
    expect(missing.status).toBe(400); expect(missing.body.error.code).toBe("VALIDATION_ERROR");
    const invalidName = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", Buffer.from("data"), "users.csv");
    expect(invalidName.status).toBe(400); expect(invalidName.body.error.code).toBe("VALIDATION_ERROR");
  });
  it("returns the generated initial password in the applied outcome", async () => { const auth = await staff(); const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", await workbook(), "users.xlsx"); const id = upload.body.importId; await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName" } }); await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth); const applied = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(applied.status).toBe(200); expect(applied.body.outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ email: "new@example.test", outcome: "created", initialPassword: expect.stringMatching(/^Temp-/) })])); });
  it("rolls back a failed apply and permits a clean retry without duplicate accounts", async () => {
    const auth = await staff(); const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", await workbook(), "users.xlsx"); const id = upload.body.importId;
    await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName" } }); await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth);
    vi.spyOn(SupportProfile, "findOneAndUpdate").mockRejectedValueOnce(new Error("injected profile write failure"));
    expect((await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth)).status).toBe(500);
    expect(await UserAccount.countDocuments({ email: "new@example.test" })).toBe(0);
    const retry = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(retry.status).toBe(200); expect(await UserAccount.countDocuments({ email: "new@example.test" })).toBe(1);
  });
  it("imports mapped profile fields, preserves unmapped fields, rejects short passwords, and supports issued credentials", async () => {
    const auth = await staff(); const existingHash = await hashPassword("existing-password"); const existing = await UserAccount.create({ email: "existing@example.test", displayName: "Old name", ...existingHash, usingInitialPassword: false });
    await SupportProfile.create({ accountId: existing._id, location: "Keep me", hardware: "Keep hardware" });
    const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Users"); sheet.addRows([["Email", "Name", "Password", "Remote", "Location"], ["existing@example.test", "New name", "", "TV-42", ""], ["new@example.test", "New user", "Issued-pass", "AD-99", "Lab 2"], ["bad@example.test", "Bad", "short", "", ""]]);
    const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", Buffer.from(await book.xlsx.writeBuffer()), "profiles.xlsx"); const id = upload.body.importId;
    await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName", Password: "initialPassword", Remote: "remoteAccessId", Location: "location" } });
    const preview = await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth); expect(preview.body.outcomes.map((outcome: { outcome: string }) => outcome.outcome)).toEqual(["updated", "created", "rejected"]);
    const applied = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(applied.status).toBe(200); expect(applied.body.outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ email: "bad@example.test", reason: expect.stringMatching(/8 characters/) })]));
    expect(await UserAccount.countDocuments({ email: "bad@example.test" })).toBe(0); const profile = await SupportProfile.findOne({ accountId: existing._id }); expect(profile?.location).toBe("Keep me"); expect(profile?.hardware).toBe("Keep hardware"); expect(profile?.remoteAccessIds.map((entry) => entry.id)).toContain("TV-42");
    const login = await request(ctx.app).post("/api/auth/login").send({ email: "new@example.test", password: "Issued-pass" }); expect(login.status).toBe(200); const cookies = login.headers["set-cookie"]; expect(cookies).toBeDefined(); const changed = await request(ctx.app).post("/api/auth/change-password").set("Cookie", cookies!).send({ currentPassword: "Issued-pass", newPassword: "Changed-pass" }); expect(changed.status).toBe(200);
  });
  it("does not duplicate work when confirmation is submitted concurrently", async () => {
    const auth = await staff(); const upload = await request(ctx.app).post("/api/staff/imports").set(auth).attach("file", await workbook(), "users.xlsx"); const id = upload.body.importId;
    await request(ctx.app).put(`/api/staff/imports/${id}/mapping`).set(auth).send({ mapping: { Email: "email", Name: "displayName" } }); await request(ctx.app).post(`/api/staff/imports/${id}/preview`).set(auth);
    const responses = await Promise.all([request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth), request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth)]); expect(responses.map((response) => response.status).sort()).toEqual([200, 409]); expect(await UserAccount.countDocuments({ email: "new@example.test" })).toBe(1); const retry = await request(ctx.app).post(`/api/staff/imports/${id}/apply`).set(auth); expect(retry.status).toBe(200); expect(retry.body.outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ email: "new@example.test", initialPassword: expect.stringMatching(/^Temp-/) })]));
  });
});
