import { z } from "zod";
import { approvedServiceNameSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const restartServiceTool: RegisteredTool = {
  name: "restart_service",
  description:
    "Restarts a named approved service on the test endpoint. Service name drawn from an enumeration in the policy entry. Verified by service_status.",
  argumentSchema: z.object({ service: approvedServiceNameSchema }),
  policyEntryId: "restart-service",
};
