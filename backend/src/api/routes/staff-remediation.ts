import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { getRemediationSummary, toggleRemediation } from "../../services/remediation/availability-service.js";

// T090/contracts/api.md "Remediation availability": the asymmetric kill
// switch -- global or per-endpoint, staff-only, always attributed.
export const staffRemediationRouter = Router();

staffRemediationRouter.use("/staff/remediation", requireAuth, requireStaff);

staffRemediationRouter.get("/staff/remediation", (_req, res, next) => {
  getRemediationSummary()
    .then((summary) => res.status(200).json(summary))
    .catch(next);
});

const toggleBodySchema = z.union([
  z.object({ scope: z.literal("global"), enabled: z.boolean() }),
  z.object({ scope: z.literal("endpoint"), endpointId: z.string().min(1), enabled: z.boolean() }),
]);

staffRemediationRouter.post("/staff/remediation/toggle", validate({ body: toggleBodySchema }), (req, res, next) => {
  (async () => {
    const body = req.body as z.infer<typeof toggleBodySchema>;
    const summary = await toggleRemediation({ ...body, staff: req.account! });
    res.status(200).json(summary);
  })().catch(next);
});
