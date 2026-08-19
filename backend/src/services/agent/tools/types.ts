import type { z } from "zod";

// contracts/tools.md "Registration shape". Tool descriptions are load-bearing
// interface text (Principle VIII) — the model selects a tool by reading its
// description, so a description may never imply reach the policy does not grant.
export interface RegisteredTool {
  /** Matches ActionPolicyEntry.id for every side-effecting tool (contracts/tools.md). */
  name: string;
  description: string;
  argumentSchema: z.ZodSchema;
  policyEntryId: string;
}
