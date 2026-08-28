import { Router } from "express";
import { z } from "zod";
import {
  MAX_SEARCH_TERM,
  listAccounts,
} from "../../services/profile/account-directory-service.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { validate } from "../middleware/validate.js";

/**
 * The staff account directory (007 T042, FR-030 to FR-033).
 *
 * Behind `requireAuth` + `requireStaff` like every other staff route, and the refusals
 * were written before this file existed (AC-014 to AC-017): a signed-out caller gets
 * `401`, a signed-in non-staff account gets `403`, and neither body carries account data
 * or an answer to the search term, because reporting "no matches" to someone with no
 * right to ask still answers their question.
 *
 * **No match is a `200` with an empty array, not a `404`.** The directory exists; the
 * search found nothing. A `404` would say the endpoint was missing and would make the
 * client render an error page for a perfectly ordinary result.
 */
export const staffAccountsRouter = Router();
staffAccountsRouter.use("/staff/accounts", requireAuth, requireStaff);

const querySchema = z.object({
  q: z.string().trim().max(MAX_SEARCH_TERM).optional(),
});

staffAccountsRouter.get(
  "/staff/accounts",
  validate({ query: querySchema }),
  (req, res, next) => {
    (async () => {
      const { q } = req.query as z.infer<typeof querySchema>;
      const accounts = await listAccounts(q);
      res.status(200).json({ accounts });
    })().catch(next);
  },
);
