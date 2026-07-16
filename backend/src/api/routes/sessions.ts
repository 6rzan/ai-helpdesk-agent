import { Router } from "express";
import { createLegacySession, createSession } from "../../services/session/session-service.js";
import { resolveSession, sessionCookie } from "../../services/auth/session-service.js";
import { UnauthorizedError } from "../../lib/errors.js";

export const sessionsRouter = Router();

sessionsRouter.post("/sessions", (req, res, next) => {
  (async () => {
    const token = req.cookies?.[sessionCookie.name];
    const resolved = typeof token === "string" ? await resolveSession(token) : null;
    const legacy = req.app.locals.allowLegacySessions === true &&
      typeof req.body?.orgId === "string" && typeof req.body?.displayName === "string";
    if (resolved) return createSession(resolved.account as Parameters<typeof createSession>[0]);
    if (legacy) return createLegacySession({ orgId: req.body.orgId, displayName: req.body.displayName });
    throw new UnauthorizedError("Sign in to continue.", "UNAUTHENTICATED");
  })()
    .then((result) => res.status(201).json(result))
    .catch(next);
});
