import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../lib/errors.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import { UserAccount } from "../../models/user-account.js";
import { appendStaffEntry, getProfile } from "../../services/profile/profile-service.js";
import { hashPassword } from "../../services/auth/password-service.js";
import { invalidateAllSessionsForAccount } from "../../services/auth/session-service.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { validate } from "../middleware/validate.js";

export const staffUsersRouter = Router();
staffUsersRouter.use("/staff/users", requireAuth, requireStaff);

const paramsSchema = z.object({ id: z.string().min(1) });
const entrySchema = z.object({
  kind: z.enum(["note", "correction"]),
  field: z.enum(["remoteAccessIds", "location", "hardware"]).optional(),
  value: z.string().trim().min(1).max(500),
});
const resetSchema = z.object({ newInitialPassword: z.string().min(8) });

async function accountOrThrow(id: string) {
  const account = await UserAccount.findById(id);
  if (!account) throw new NotFoundError("Unknown user account", "ACCOUNT_NOT_FOUND");
  return account;
}

staffUsersRouter.get("/staff/users/:id/profile", validate({ params: paramsSchema }), (req, res, next) => {
  (async () => res.status(200).json({ profile: await getProfile((await accountOrThrow(req.params.id!))._id) }))().catch(next);
});

staffUsersRouter.post("/staff/users/:id/profile/entries", validate({ params: paramsSchema, body: entrySchema }), (req, res, next) => {
  (async () => {
    const account = await accountOrThrow(req.params.id!);
    const entry = req.body as z.infer<typeof entrySchema>;
    const profile = await appendStaffEntry({ accountId: account._id, staff: req.account!, kind: entry.kind, value: entry.value, ...(entry.field ? { field: entry.field } : {}) });
    await StaffActionRecord.create({ staffId: req.account!._id, staffName: req.account!.displayName, action: "profile_append", targetType: "profile", targetId: account._id, details: { kind: entry.kind, field: entry.field ?? null } });
    res.status(201).json({ profile });
  })().catch(next);
});

staffUsersRouter.get("/staff/users/:id/credentials", validate({ params: paramsSchema }), (req, res, next) => {
  accountOrThrow(req.params.id!).then((account) => res.status(200).json({ usingInitialPassword: account.usingInitialPassword })).catch(next);
});

staffUsersRouter.post("/staff/users/:id/credentials/reset", validate({ params: paramsSchema, body: resetSchema }), (req, res, next) => {
  (async () => {
    const account = await accountOrThrow(req.params.id!);
    const { passwordHash, passwordSalt } = await hashPassword((req.body as z.infer<typeof resetSchema>).newInitialPassword);
    account.passwordHash = passwordHash; account.passwordSalt = passwordSalt; account.usingInitialPassword = true;
    await account.save(); await invalidateAllSessionsForAccount(account._id);
    await StaffActionRecord.create({ staffId: req.account!._id, staffName: req.account!.displayName, action: "credential_reset", targetType: "account", targetId: account._id, details: {} });
    res.status(200).json({ usingInitialPassword: true });
  })().catch(next);
});
