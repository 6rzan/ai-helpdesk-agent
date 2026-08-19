import { z } from "zod";
import { networkProbeTargetSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const networkProbeTool: RegisteredTool = {
  name: "network_probe",
  description:
    "Checks reachability and DNS resolution for a named target, as seen from the test endpoint. This tests " +
    "the endpoint's own network path, not the employee's device or network.",
  argumentSchema: z.object({ target: networkProbeTargetSchema }),
  policyEntryId: "network-probe",
};
