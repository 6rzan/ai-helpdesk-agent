import { z } from "zod";
import { testAccountUsernameSchema } from "./argument-schemas.js";
import type { RegisteredTool } from "./types.js";

export const expirePasswordTool: RegisteredTool = {
  name: "expire_password",
  description:
    "Forces a password change at next sign-in for a local test account on the test endpoint. Verified by account_status.",
  argumentSchema: z.object({ username: testAccountUsernameSchema }),
  policyEntryId: "expire-password",
};
