import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";
import { TICKET_STATUSES } from "../../models/enums.js";
import {
  applyStaffStatusChange,
  getStaffTicketDetail,
  listStaffTickets,
} from "../../services/staff/staff-ticket-service.js";
import { reassignTicket, takeoverTicket } from "../../services/staff/assignment-service.js";

export const staffTicketsRouter = Router();

// Every staff surface is signed-in AND staff-role gated (SC-003).
staffTicketsRouter.use("/staff", requireAuth, requireStaff);

const listQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.string().min(1).optional(),
  escalated: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["newest", "oldest", "updated"]).optional(),
});

staffTicketsRouter.get("/staff/tickets", validate({ query: listQuerySchema }), (req, res, next) => {
  const filters = req.query as z.infer<typeof listQuerySchema>;
  listStaffTickets(filters)
    .then((tickets) => res.status(200).json({ tickets }))
    .catch(next);
});

const referenceParamsSchema = z.object({ reference: z.string().min(1) });

staffTicketsRouter.get(
  "/staff/tickets/:reference",
  validate({ params: referenceParamsSchema }),
  (req, res, next) => {
    const { reference } = req.params as { reference: string };
    getStaffTicketDetail(reference)
      .then((ticket) => res.status(200).json({ ticket }))
      .catch(next);
  },
);

const statusBodySchema = z.object({ status: z.enum(TICKET_STATUSES) });

staffTicketsRouter.post(
  "/staff/tickets/:reference/status",
  validate({ params: referenceParamsSchema, body: statusBodySchema }),
  (req, res, next) => {
    const { reference } = req.params as { reference: string };
    const { status } = req.body as z.infer<typeof statusBodySchema>;
    applyStaffStatusChange({ reference, status, staff: req.account! })
      .then((ticket) => res.status(200).json({ ticket }))
      .catch(next);
  },
);

staffTicketsRouter.post(
  "/staff/tickets/:reference/takeover",
  validate({ params: referenceParamsSchema }),
  (req, res, next) => {
    const { reference } = req.params as { reference: string };
    takeoverTicket(reference, req.account!)
      .then((ticket) => res.status(200).json({ ticket }))
      .catch(next);
  },
);

const assigneeBodySchema = z.object({ toAccountId: z.string().min(1) });

staffTicketsRouter.post(
  "/staff/tickets/:reference/assignee",
  validate({ params: referenceParamsSchema, body: assigneeBodySchema }),
  (req, res, next) => {
    const { reference } = req.params as { reference: string };
    const { toAccountId } = req.body as z.infer<typeof assigneeBodySchema>;
    reassignTicket(reference, toAccountId, req.account!)
      .then((ticket) => res.status(200).json({ ticket }))
      .catch(next);
  },
);
