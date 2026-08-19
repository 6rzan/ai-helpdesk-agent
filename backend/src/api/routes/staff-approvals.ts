import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { APPROVAL_STATUSES } from "../../models/enums.js";
import { decideApproval, listApprovalRequests, toApprovalRequestJson } from "../../services/remediation/approval-service.js";

// T076/contracts/api.md "Staff surfaces / Approval queue": every route here is
// signed-in AND staff-role gated (SC-003), same as staff-tickets.ts.
export const staffApprovalsRouter = Router();

staffApprovalsRouter.use("/staff/approvals", requireAuth, requireStaff);

const listQuerySchema = z.object({ status: z.enum(APPROVAL_STATUSES).optional() });

// GET /staff/approvals: pending by default (or `?status=` filtered history),
// with any past-due `pending` rows lazily transitioned to `expired` first (R6).
staffApprovalsRouter.get("/staff/approvals", validate({ query: listQuerySchema }), (req, res, next) => {
  (async () => {
    const { status } = req.query as z.infer<typeof listQuerySchema>;
    const requests = await listApprovalRequests(status);
    res.status(200).json({ approvals: await Promise.all(requests.map(toApprovalRequestJson)) });
  })().catch(next);
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const declineBodySchema = z.object({ reason: z.string().min(1).optional() });

// POST /staff/approvals/:id/approve — conditional on `status: "pending"`;
// never a plain save (R6). Executes only on success.
staffApprovalsRouter.post("/staff/approvals/:id/approve", validate({ params: idParamsSchema }), (req, res, next) => {
  (async () => {
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const result = await decideApproval({ approvalId: id, staff: req.account!, granted: true });
    res.status(200).json({ result });
  })().catch(next);
});

// POST /staff/approvals/:id/decline — never executes.
staffApprovalsRouter.post(
  "/staff/approvals/:id/decline",
  validate({ params: idParamsSchema, body: declineBodySchema }),
  (req, res, next) => {
    (async () => {
      const { id } = req.params as z.infer<typeof idParamsSchema>;
      const { reason } = req.body as z.infer<typeof declineBodySchema>;
      const result = await decideApproval({ approvalId: id, staff: req.account!, granted: false, ...(reason ? { reason } : {}) });
      res.status(200).json({ result });
    })().catch(next);
  },
);
