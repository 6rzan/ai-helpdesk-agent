import { z } from "zod";
import { approvedServiceNameSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const serviceStatusTool: RegisteredTool = {
  name: "service_status",
  description: "Reports the state of a named approved service on the test endpoint.",
  argumentSchema: z.object({ service: approvedServiceNameSchema }),
  policyEntryId: "service-status",
};
