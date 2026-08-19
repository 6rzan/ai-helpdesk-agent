import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { ACTION_OUTCOMES } from "../../models/enums.js";
import { listActionsForStaff } from "../../services/remediation/audit-service.js";

// T089/contracts/api.md "Action trail": staff-only, complete audit trail
// across all tickets. There is deliberately no PATCH/PUT/DELETE anywhere on
// this router (FR-010, SC-002) -- see audit-trail-view.test.ts.
export const staffActionsRouter = Router();

staffActionsRouter.use("/staff/actions", requireAuth, requireStaff);

const listQuerySchema = z.object({
  ticketId: z.string().min(1).optional(),
  endpointId: z.string().min(1).optional(),
  outcome: z.enum(ACTION_OUTCOMES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

staffActionsRouter.get("/staff/actions", validate({ query: listQuerySchema }), (req, res, next) => {
  (async () => {
    const filters = req.query as z.infer<typeof listQuerySchema>;
    const result = await listActionsForStaff(filters);
    res.status(200).json(result);
  })().catch(next);
});
