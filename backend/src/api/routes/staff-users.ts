import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../lib/errors.js";
import { StaffActionRecord } from "../../models/staff-action.js";
import { UserAccount } from "../../models/user-account.js";
import { appendStaffEntry, getProfile, toProfileView } from "../../services/profile/profile-service.js";
import {
  getFieldHistory,
  releaseField,
  setFieldsAsStaff,
  type FieldSubmission,
} from "../../services/profile/profile-field-service.js";
import { isProfileField, parseFieldValue } from "../../services/profile/field-validation.js";
import { PROFILE_FIELDS, type ProfileField } from "../../models/enums.js";
import { ValidationError } from "../../lib/errors.js";
import { hashPassword } from "../../services/auth/password-service.js";
import { invalidateAllSessionsForAccount } from "../../services/auth/session-service.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { validate } from "../middleware/validate.js";

export const staffUsersRouter = Router();
staffUsersRouter.use("/staff/users", requireAuth, requireStaff);

const paramsSchema = z.object({ id: z.string().min(1) });
const entrySchema = z.object({
  // 007 T031 retired the `correction` write path: staff now set the value itself, so
  // recording a correction beside an owner value would be writing down a disagreement
  // the system no longer has to have. Existing correction entries keep rendering.
  kind: z.enum(["note"]),
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

// --- 007 US2: staff-authoritative per-field editing ---------------------------

const fieldParamsSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
});

const fieldsBodySchema = z.object({
  fields: z
    .record(
      z.string(),
      z.object({
        value: z.unknown(),
        // The field's own `setAt` as the client loaded it. `null` means "never set when
        // I loaded it", which has to be a real value rather than an omission: a field
        // that was empty on load and has since been filled in is exactly the case that
        // would otherwise be a silent overwrite (FR-029, R7).
        expectedSetAt: z.string().datetime().nullable(),
      }),
    )
    .refine((fields) => Object.keys(fields).length > 0, "At least one field is required"),
});

function parseFieldName(name: string): ProfileField {
  if (!isProfileField(name)) {
    throw new ValidationError(
      `Unknown profile field: ${name}. The profile holds ${PROFILE_FIELDS.join(", ")}.`,
      "VALIDATION_ERROR",
      { field: name },
    );
  }
  return name;
}

/**
 * Set one or more fields authoritatively (FR-016).
 *
 * Always `200` with a per-field outcome map, **including when a field was refused**. A
 * mixed result is not a failure: some fields really were saved, and returning `4xx` would
 * misdescribe what the server did and invite the client to discard everything the staff
 * member typed. A `4xx` here means nothing was applied because the request itself was
 * malformed.
 */
staffUsersRouter.put(
  "/staff/users/:id/profile/fields",
  validate({ params: paramsSchema, body: fieldsBodySchema }),
  (req, res, next) => {
    (async () => {
      const account = await accountOrThrow(req.params.id!);
      const body = req.body as z.infer<typeof fieldsBodySchema>;

      // Validate every field before applying any of them, so a malformed second field
      // cannot leave the first one written.
      const fields: Partial<Record<ProfileField, FieldSubmission>> = {};
      for (const [name, submission] of Object.entries(body.fields)) {
        const field = parseFieldName(name);
        fields[field] = {
          value: parseFieldValue(field, submission.value),
          expectedSetAt: submission.expectedSetAt,
        };
      }

      const { results, profile, applied } = await setFieldsAsStaff({
        accountId: account._id,
        staff: { id: req.account!._id, name: req.account!.displayName, kind: "staff" },
        fields,
      });

      // FR-026: only the fields that were actually written. A record naming a field that
      // was refused would describe a change that never happened, in the one place the
      // audit is meant to be trustworthy.
      if (applied.length > 0) {
        await StaffActionRecord.create({
          staffId: req.account!._id,
          staffName: req.account!.displayName,
          action: "profile_edit",
          targetType: "profile",
          targetId: account._id,
          details: { fields: applied },
        });
      }

      res.status(200).json({ results, profile: toProfileView(profile) });
    })().catch(next);
  },
);

/** Hand a field back to the account owner (FR-023). */
staffUsersRouter.post(
  "/staff/users/:id/profile/fields/:field/release",
  validate({ params: fieldParamsSchema }),
  (req, res, next) => {
    (async () => {
      const account = await accountOrThrow(req.params.id!);
      const field = parseFieldName(req.params.field!);

      const profile = await releaseField({
        accountId: account._id,
        field,
        staff: { id: req.account!._id, name: req.account!.displayName, kind: "staff" },
      });

      await StaffActionRecord.create({
        staffId: req.account!._id,
        staffName: req.account!.displayName,
        action: "profile_release",
        targetType: "profile",
        targetId: account._id,
        details: { field },
      });

      res.status(200).json({ profile: toProfileView(profile) });
    })().catch(next);
  },
);

/**
 * One field's history, newest first.
 *
 * **Staff only, with no owner-facing equivalent** (FR-018). The absence of a route under
 * `/api/my/` is the enforcement, not a filter applied here.
 */
staffUsersRouter.get(
  "/staff/users/:id/profile/fields/:field/history",
  validate({ params: fieldParamsSchema }),
  (req, res, next) => {
    (async () => {
      const account = await accountOrThrow(req.params.id!);
      const field = parseFieldName(req.params.field!);
      res.status(200).json({ history: await getFieldHistory(account._id, field) });
    })().catch(next);
  },
);
