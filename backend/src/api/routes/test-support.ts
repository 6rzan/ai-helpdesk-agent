import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { applyStateTransition } from "../../services/ticket/ticket-service.js";

const paramsSchema = z.object({ reference: z.string().min(1) });
const bodySchema = z.object({
  field: z.enum(["status", "handlingMode"]),
  to: z.string().min(1),
  actor: z.enum(["staff", "system"]),
});

// Staff-side transitions are out of scope for this feature; this router simulates
// them for demos and tests. It is only mounted when APP_MODE is demo or test.
export const testSupportRouter = Router();

testSupportRouter.patch(
  "/tickets/:reference/state",
  validate({ params: paramsSchema, body: bodySchema }),
  (req, res, next) => {
    (async () => {
      const { field, to, actor } = req.body as z.infer<typeof bodySchema>;
      const { reference } = req.params as { reference: string };
      const ticket = await applyStateTransition({ reference, field, to, actor });
      res.status(200).json({ ticket });
    })().catch(next);
  },
);
