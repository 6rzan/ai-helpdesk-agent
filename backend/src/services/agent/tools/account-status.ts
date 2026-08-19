import { z } from "zod";
import { testAccountUsernameSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const accountStatusTool: RegisteredTool = {
  name: "account_status",
  description:
    "Checks whether a named local test account on the test endpoint is locked, and whether its password " +
    "is flagged for a forced change at next sign-in. Acts only on the test endpoint's own local accounts, " +
    "never on the employee's real directory account.",
  argumentSchema: z.object({ username: testAccountUsernameSchema }),
  policyEntryId: "account-status",
};
