import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { AVAILABILITY_STATUSES } from "../../models/enums.js";
import { getRoster, updateAvailability } from "../../services/staff/assignment-service.js";

export const staffRosterRouter = Router();

// Both surfaces are signed-in AND staff-role gated (SC-003).
staffRosterRouter.use("/staff", requireAuth, requireStaff);

staffRosterRouter.get("/staff/roster", (_req, res, next) => {
  getRoster()
    .then((roster) => res.status(200).json(roster))
    .catch(next);
});

const availabilityBodySchema = z.object({ availability: z.enum(AVAILABILITY_STATUSES) });

staffRosterRouter.put("/staff/availability", validate({ body: availabilityBodySchema }), (req, res, next) => {
  const { availability } = req.body as z.infer<typeof availabilityBodySchema>;
  updateAvailability(req.account!, availability)
    .then(() => res.status(200).json({ availability }))
    .catch(next);
});
