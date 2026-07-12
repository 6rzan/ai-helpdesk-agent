import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { INPUT_ORIGINS } from "../../models/enums.js";
import { Conversation } from "../../models/conversation.js";
import { validate } from "../middleware/validate.js";
import { handleIncomingMessage } from "../../services/conversation/conversation-service.js";
import { getSession, touchSession } from "../../services/session/session-service.js";

export const conversationsRouter = Router();

const paramsSchema = z.object({ conversationId: z.string().min(1) });
const bodySchema = z.object({
  sessionId: z.string().min(1),
  text: z.string(),
  inputOrigin: z.enum(INPUT_ORIGINS).default("typed"),
});

conversationsRouter.post(
  "/conversations/:conversationId/messages",
  validate({ params: paramsSchema, body: bodySchema }),
  (req, res, next) => {
    const { conversationId } = req.params as z.infer<typeof paramsSchema>;
    const { sessionId, text, inputOrigin } = req.body as z.infer<typeof bodySchema>;

    (async () => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("text must not be empty");
      }
      if (text.length > 4000) {
        throw new ValidationError("text is too long (max 4000 characters)", "MESSAGE_TOO_LONG");
      }

      const session = getSession(sessionId);
      if (!session) {
        throw new ForbiddenError("Session is invalid or has expired", "SESSION_INVALID");
      }

      if (!Types.ObjectId.isValid(conversationId)) {
        throw new NotFoundError("Unknown conversation", "CONVERSATION_NOT_FOUND");
      }
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new NotFoundError("Unknown conversation", "CONVERSATION_NOT_FOUND");
      }

      if (session.conversationId.toString() !== conversationId) {
        throw new ForbiddenError("Session does not own this conversation", "CONVERSATION_MISMATCH");
      }

      touchSession(sessionId);

      const result = await handleIncomingMessage({
        sessionId,
        conversationId: conversation._id,
        reporterId: session.reporterId,
        text,
        inputOrigin,
      });

      res.status(202).json(result);
    })().catch(next);
  },
);
