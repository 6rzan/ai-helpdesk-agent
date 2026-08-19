import { z } from "zod";
import type { RegisteredTool } from "./types.js";

export const clearPrintQueueTool: RegisteredTool = {
  name: "clear_print_queue",
  description: "Clears the test endpoint's print queue. Verified by print_queue_status.",
  argumentSchema: z.object({}),
  policyEntryId: "clear-print-queue",
};
