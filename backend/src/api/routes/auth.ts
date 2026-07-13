import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { UserAccount } from "../../models/user-account.js";
import { hashPassword, verifyPassword } from "../../services/auth/password-service.js";
import {
  clearSessionCookie,
  invalidateAllSessionsForAccount,
  invalidateSession,
  issueSession,
  sessionCookie,
  setSessionCookie,
} from "../../services/auth/session-service.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";

export const authRouter = Router();

function accountView(account: {
  _id: unknown;
  email: string;
  displayName: string;
  role: "user" | "staff";
  availability?: "available" | "busy" | "away";
  usingInitialPassword: boolean;
}) {
  return {
    id: String(account._id),
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    availability: account.role === "staff" ? account.availability : undefined,
    usingInitialPassword: account.usingInitialPassword,
  };
}

const registerBodySchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8),
});

authRouter.post("/auth/register", validate({ body: registerBodySchema }), (req, res, next) => {
  const { email, displayName, password } = req.body as z.infer<typeof registerBodySchema>;

  UserAccount.findOne({ email: email.toLowerCase() })
    .then(async (existing) => {
      if (existing) {
        throw new ConflictError("That email is already in use.", "EMAIL_IN_USE");
      }

      const { passwordHash, passwordSalt } = await hashPassword(password);
      const account = await UserAccount.create({
        email,
        displayName,
        role: "user",
        passwordHash,
        passwordSalt,
        usingInitialPassword: false,
      });

      const token = await issueSession(account._id);
      setSessionCookie(res, token);
      res.status(201).json(accountView(account));
    })
    .catch(next);
});

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

authRouter.post("/auth/login", validate({ body: loginBodySchema }), (req, res, next) => {
  const { email, password } = req.body as z.infer<typeof loginBodySchema>;

  UserAccount.findOne({ email: email.toLowerCase() })
    .select("+passwordHash +passwordSalt")
    .then(async (account) => {
      if (!account) {
        throw new UnauthorizedError("Incorrect email or password.", "INVALID_CREDENTIALS");
      }

      const valid = await verifyPassword(password, account.passwordHash, account.passwordSalt);
      if (!valid) {
        throw new UnauthorizedError("Incorrect email or password.", "INVALID_CREDENTIALS");
      }

      const token = await issueSession(account._id);
      setSessionCookie(res, token);
      res.status(200).json(accountView(account));
    })
    .catch(next);
});

authRouter.post("/auth/logout", requireAuth, (req, res, next) => {
  const token: unknown = req.cookies?.[sessionCookie.name];
  const invalidate = typeof token === "string" ? invalidateSession(token) : Promise.resolve();

  invalidate
    .then(() => {
      clearSessionCookie(res);
      res.status(204).send();
    })
    .catch(next);
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.status(200).json(accountView(req.account!));
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post(
  "/auth/change-password",
  requireAuth,
  validate({ body: changePasswordBodySchema }),
  (req, res, next) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordBodySchema>;
    const account = req.account!;

    UserAccount.findById(account._id)
      .select("+passwordHash +passwordSalt")
      .then(async (fullAccount) => {
        if (!fullAccount) {
          throw new UnauthorizedError("Sign in to continue.", "UNAUTHENTICATED");
        }

        const valid = await verifyPassword(currentPassword, fullAccount.passwordHash, fullAccount.passwordSalt);
        if (!valid) {
          throw new UnauthorizedError("Current password is incorrect.", "INVALID_CREDENTIALS");
        }

        const { passwordHash, passwordSalt } = await hashPassword(newPassword);
        fullAccount.passwordHash = passwordHash;
        fullAccount.passwordSalt = passwordSalt;
        fullAccount.usingInitialPassword = false;
        await fullAccount.save();

        await invalidateAllSessionsForAccount(fullAccount._id);
        const token = await issueSession(fullAccount._id);
        setSessionCookie(res, token);

        res.status(200).json(accountView(fullAccount));
      })
      .catch(next);
  },
);
