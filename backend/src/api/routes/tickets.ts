import { Router } from "express";
import { z } from "zod";
import { ForbiddenError } from "../../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { getSession, touchSession } from "../../services/session/session-service.js";
import { findOwnedTicket, listTicketsForReporter, toTicketDetail } from "../../services/ticket/ticket-service.js";
import { getActionsForTicket, toActionRecordJson } from "../../services/remediation/audit-service.js";
import { recordConsent } from "../../services/remediation/consent-service.js";

const sessionQuerySchema = z.object({ sessionId: z.string().min(1) });
const referenceParamsSchema = z.object({ reference: z.string().min(1) });
const actionConsentBodySchema = z.object({ proposalId: z.string().min(1), granted: z.boolean() });

export const ticketsRouter = Router();

function requireSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    throw new ForbiddenError("Session is invalid or has expired", "SESSION_INVALID");
  }
  touchSession(sessionId);
  return session;
}

ticketsRouter.get("/tickets", validate({ query: sessionQuerySchema }), (req, res, next) => {
  (async () => {
    const { sessionId } = req.query as { sessionId: string };
    const session = requireSession(sessionId);
    const tickets = await listTicketsForReporter(session.reporterId);
    res.status(200).json({ tickets });
  })().catch(next);
});

ticketsRouter.get(
  "/tickets/:reference",
  validate({ params: referenceParamsSchema, query: sessionQuerySchema }),
  (req, res, next) => {
    (async () => {
      const { sessionId } = req.query as { sessionId: string };
      const session = requireSession(sessionId);
      const { reference } = req.params as { reference: string };
      const ticket = await findOwnedTicket(reference, session.reporterId);
      res.status(200).json({ ticket: await toTicketDetail(ticket) });
    })().catch(next);
  },
);

// T044/contracts/api.md: consent is per proposal, never per category, endpoint,
// or session. Granting a read-only proposal executes it immediately through the
// policy engine; declining is refused and recorded — never a hard HTTP error,
// per `ACTION_REFUSED` in the error-code table.
ticketsRouter.post(
  "/tickets/:reference/actions/consent",
  validate({ params: referenceParamsSchema, query: sessionQuerySchema, body: actionConsentBodySchema }),
  (req, res, next) => {
    (async () => {
      const { sessionId } = req.query as { sessionId: string };
      const session = requireSession(sessionId);
      const { reference } = req.params as { reference: string };
      const { proposalId, granted } = req.body as { proposalId: string; granted: boolean };
      const result = await recordConsent({
        sessionId,
        reference,
        reporterId: session.reporterId,
        proposalId,
        granted,
      });
      res.status(200).json({ result });
    })().catch(next);
  },
);

// T045: reporter-facing action history for one ticket (plain-language form,
// US1 AS1/US3 AS6). Staff see the same records with full detail via the
// separate `/staff/actions` surface.
ticketsRouter.get(
  "/tickets/:reference/actions",
  validate({ params: referenceParamsSchema, query: sessionQuerySchema }),
  (req, res, next) => {
    (async () => {
      const { sessionId } = req.query as { sessionId: string };
      const session = requireSession(sessionId);
      const { reference } = req.params as { reference: string };
      const ticket = await findOwnedTicket(reference, session.reporterId);
      const actions = await getActionsForTicket(ticket._id);
      res.status(200).json({ actions: actions.map((record) => toActionRecordJson(record, ticket.reference)) });
    })().catch(next);
  },
);
