import { z } from "zod";
import { testAccountUsernameSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const unlockAccountTool: RegisteredTool = {
  name: "unlock_account",
  description: "Unlocks a locked local test account on the test endpoint. Verified by account_status.",
  argumentSchema: z.object({ username: testAccountUsernameSchema }),
  policyEntryId: "unlock-account",
};
