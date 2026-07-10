import { Router } from "express";
import { z } from "zod";
import { ForbiddenError } from "../../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { getSession, touchSession } from "../../services/session/session-service.js";
import { findOwnedTicket, listTicketsForReporter, toTicketDetail } from "../../services/ticket/ticket-service.js";

const sessionQuerySchema = z.object({ sessionId: z.string().min(1) });
const referenceParamsSchema = z.object({ reference: z.string().min(1) });

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
