import { z } from "zod";
import type { RegisteredTool } from "./types.js";

export const peripheralListTool: RegisteredTool = {
  name: "peripheral_list",
  description:
    "Lists devices visible to the test endpoint itself. This is the container's own device view, a " +
    "narrower thing than the employee's physical desk; it never inspects the employee's own hardware.",
  argumentSchema: z.object({}),
  policyEntryId: "peripheral-list",
};
