import { Router } from "express";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { toTicketDetail } from "../../services/ticket/ticket-service.js";
import { getOwnProfile, updateOwnProfile } from "../../services/profile/profile-service.js";

export const myRouter = Router();
myRouter.use("/my", requireAuth);

const referenceSchema = z.object({ reference: z.string().min(1) });
const profileSchema = z.object({
  remoteAccessIds: z.array(z.object({ tool: z.string().trim().min(1).max(80), id: z.string().trim().min(1).max(160) })).max(10).optional(),
  location: z.string().trim().max(160).optional(),
  hardware: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

function toMyTicket(ticket: TicketDoc) {
  return {
    reference: ticket.reference,
    category: ticket.category,
    status: ticket.status,
    handlingMode: ticket.handlingMode,
    escalated: ticket.escalated,
    description: ticket.description,
    assigneeName: ticket.assignee?.displayName ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

myRouter.get("/my/tickets", (req, res, next) => {
  Ticket.find({ reporterAccountId: req.account!._id }).sort({ createdAt: -1 })
    .then((tickets) => res.status(200).json({ tickets: tickets.map((ticket) => toMyTicket(ticket as TicketDoc)) }))
    .catch(next);
});

myRouter.get("/my/tickets/:reference", validate({ params: referenceSchema }), (req, res, next) => {
  (async () => {
    const { reference } = req.params as z.infer<typeof referenceSchema>;
    const ticket = await Ticket.findOne({ reference });
    if (!ticket) {
      throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
    }
    if (!ticket.reporterAccountId || !ticket.reporterAccountId.equals(req.account!._id)) {
      throw new ForbiddenError("This ticket belongs to another account", "TICKET_FORBIDDEN");
    }
    const detail = await toTicketDetail(ticket as TicketDoc);
    res.status(200).json({ ticket: { ...detail, assigneeName: ticket.assignee?.displayName ?? null } });
  })().catch(next);
});

myRouter.get("/my/profile", (req, res, next) => {
  getOwnProfile(req.account!._id).then((profile) => res.status(200).json({ profile })).catch(next);
});

myRouter.put("/my/profile", validate({ body: profileSchema }), (req, res, next) => {
  updateOwnProfile(req.account!._id, req.body as z.infer<typeof profileSchema>)
    .then((profile) => res.status(200).json({ profile }))
    .catch(next);
});
