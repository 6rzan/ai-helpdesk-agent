import { z } from "zod";
import type { RegisteredTool } from "./types.js";

export const printQueueStatusTool: RegisteredTool = {
  name: "print_queue_status",
  description: "Lists jobs currently queued on the test endpoint's print service.",
  argumentSchema: z.object({}),
  policyEntryId: "print-queue-status",
};
