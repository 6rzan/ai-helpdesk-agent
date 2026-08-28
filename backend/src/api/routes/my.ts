import { Router } from "express";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { toTicketDetail } from "../../services/ticket/ticket-service.js";
import { getOwnProfile, toProfileView } from "../../services/profile/profile-service.js";
import { setFieldsAsOwner } from "../../services/profile/profile-field-service.js";
import { parseFieldValue } from "../../services/profile/field-validation.js";
import type { ProfileField } from "../../models/enums.js";
import type { ProfileFieldValue } from "../../services/profile/profile-field-service.js";

export const myRouter = Router();
myRouter.use("/my", requireAuth);

const referenceSchema = z.object({ reference: z.string().min(1) });
// Body unchanged from before 007: any of the three fields, no concurrency token. The
// owner is not racing a colleague for their own profile; what they can hit is a field
// staff took over while the page was open, and that is a control check rather than a
// timestamp comparison.
const profileSchema = z
  .object({
    remoteAccessIds: z
      .array(z.object({ tool: z.string().trim().max(80), id: z.string().trim().max(160) }))
      .max(10)
      .optional(),
    location: z.string().trim().max(160).optional(),
    hardware: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

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

/**
 * The owner edits their own profile.
 *
 * 007 T033: a **per-field control check**, not an all-or-nothing one. A field staff
 * control is refused with who set it and when, so the page can say what happened; the
 * fields the owner still controls in the same request are applied. This is the "locked
 * after the page opened" case, and the two wrong answers are applying the change
 * silently and dropping it without a word (FR-020, FR-021, FR-024).
 *
 * An owner write never moves control and never writes a `StaffActionRecord`. It does
 * append a history entry, because FR-018 retains every field's previous value regardless
 * of who wrote it — the owner simply has no route that reads it back.
 */
myRouter.put("/my/profile", validate({ body: profileSchema }), (req, res, next) => {
  (async () => {
    const body = req.body as z.infer<typeof profileSchema>;
    const fields: Partial<Record<ProfileField, ProfileFieldValue>> = {};
    for (const field of ["location", "hardware", "remoteAccessIds"] as const) {
      if (body[field] !== undefined) {
        fields[field] = parseFieldValue(field, body[field]);
      }
    }

    const { results, profile } = await setFieldsAsOwner({
      accountId: req.account!._id,
      owner: { id: req.account!._id, name: req.account!.displayName, kind: "owner" },
      fields,
    });

    res.status(200).json({ results, profile: toProfileView(profile) });
  })().catch(next);
});
