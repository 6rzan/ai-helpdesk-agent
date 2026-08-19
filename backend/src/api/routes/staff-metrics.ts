import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { getMetricsSummary } from "../../services/metrics/metrics-service.js";

// T103/contracts/api.md "Metrics": the metrics summary for a selectable
// period (FR-023). Validation of the `period` preset happens inside the
// service so an out-of-set value gets the specific METRICS_PERIOD_INVALID
// code the contract names, not a generic validation error.
export const staffMetricsRouter = Router();

staffMetricsRouter.use("/staff/metrics", requireAuth, requireStaff);

staffMetricsRouter.get("/staff/metrics", (req, res, next) => {
  const preset = typeof req.query.period === "string" ? req.query.period : "30d";
  getMetricsSummary(preset)
    .then((summary) => res.status(200).json(summary))
    .catch(next);
});
