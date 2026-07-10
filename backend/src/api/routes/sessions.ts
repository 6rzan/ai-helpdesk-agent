import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createSession } from "../../services/session/session-service.js";

export const sessionsRouter = Router();

const createSessionBodySchema = z.object({
  orgId: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/),
  displayName: z.string().trim().min(1).max(60),
});

sessionsRouter.post("/sessions", validate({ body: createSessionBodySchema }), (req, res, next) => {
  const { orgId, displayName } = req.body as z.infer<typeof createSessionBodySchema>;
  createSession(orgId, displayName)
    .then((result) => res.status(201).json(result))
    .catch(next);
});
