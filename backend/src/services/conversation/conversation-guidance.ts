import type { HydratedDocument } from "mongoose";
import { Conversation } from "../../models/conversation.js";
import { Message, type MessageDoc } from "../../models/message.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { clock } from "../../lib/clock.js";
import { publishEvent } from "../../api/sse/event-bus.js";
import { notifyTicketUpdated } from "../ticket/notifications.js";
import { transitionHandlingMode, transitionStatus, type TransitionableTicket } from "../ticket/state-machine.js";
import { advanceStep, decideStepTransition, endSession, formatStepPrompt, getActiveSession, getGuideForSession, interpretReply, recordAttempt, startGuidedSession } from "../guidance/guidance-service.js";
import type { GuidedSessionDoc } from "../../models/guided-session.js";
import type { ConversationTurn } from "../llm/types.js";
import type { ReplyContext } from "./conversation-engine.js";
import { detectCategoryKeyword } from "./conversation-engine.js";

export interface GuidedFlowStart {
  text: string;
  guidance?: { stepIndex: number; stepCount: number };
}

// FR-012: no active guide for the newly-created ticket's category means we
// escalate immediately rather than leaving the reporter stuck with nothing.
// Returns the text/guidance to append to the caller's own reply rather than
// sending a message itself, so ticket-creation + Step 1 land as one reply (SC-001).
export async function startGuidedFlowForTicket(
  ctx: ReplyContext,
  ticket: HydratedDocument<TicketDoc>,
): Promise<GuidedFlowStart> {
  // Spec edge case: reporting a new, different problem mid-guide must not leave the
  // prior session dangling active — the (conversationId, active) unique index only
  // allows one, and an orphaned active session would block this new one from starting.
  const priorActive = await getActiveSession(ctx.conversationId);
  if (priorActive) {
    endSession(priorActive, "abandoned");
    await priorActive.save();
  }

  const started = await startGuidedSession({
    conversationId: ctx.conversationId,
    ticketId: ticket._id,
    categoryName: ticket.category,
  });

  if (!started) {
    await escalateTicketForGuidance(ctx, ticket, "no_guide");
    return { text: "I don't have step-by-step guidance for this yet, so I'm bringing in a person to help." };
  }

  const { guide } = started;
  return {
    text: formatStepPrompt(guide, 0),
    guidance: { stepIndex: 0, stepCount: guide.steps.length },
  };
}

// Routes a reply through the deterministic guided-troubleshooting state machine
// when the conversation has an active GuidedSession. Returns false (does nothing)
// when there is no active session, so the caller falls through to normal handling.
export async function tryHandleGuidedReply(ctx: ReplyContext, resumedTicketIds: Set<string>): Promise<boolean> {
  const session = await getActiveSession(ctx.conversationId);
  if (!session) {
    return false;
  }

  // A ticket that was just resumed from waiting_on_user this turn was awaiting a
  // plain-language reply for staff, not a guided-step answer — leave it alone.
  if (resumedTicketIds.has(session.ticketId.toString())) {
    return true;
  }

  // A message naming any category's keywords reads as a fresh problem description
  // (possibly a duplicate of the just-created ticket) rather than a plain step
  // outcome — let it fall through to normal classification/duplicate-detection
  // instead of being force-fit into a step reply. Genuine step replies ("it
  // worked", "still not working", "already tried that") don't name a device/category.
  const mentionedCategory = detectCategoryKeyword(ctx.text);
  if (mentionedCategory) {
    return false;
  }

  const guide = await getGuideForSession(session);
  const step = guide?.steps[session.currentStepIndex];
  if (!guide || !step) {
    endSession(session, "escalated");
    await session.save();
    await escalateGuidedTicket(ctx, session, "guidance_exhausted");
    await sendAgentReply(ctx, "I'm bringing in a person to help from here.");
    return true;
  }

  const history = await Message.find({ conversationId: ctx.conversationId }).sort({ sentAt: 1 }).lean();
  const interpreted = await interpretReply({
    history: history.map((m): ConversationTurn => ({ author: m.author, text: m.text })),
    latestMessage: ctx.text,
    step,
  });

  if (!interpreted) {
    endSession(session, "escalated");
    await session.save();
    await escalateGuidedTicket(ctx, session, "llm_unavailable");
    await sendAgentReply(ctx, "I'm having trouble understanding right now, so I'm bringing in a person to help.");
    return true;
  }

  const decision = decideStepTransition({
    outcome: interpreted.outcome,
    currentStepIndex: session.currentStepIndex,
    stepCount: guide.steps.length,
  });

  switch (decision.action) {
    case "resolve": {
      endSession(session, "resolved");
      await session.save();
      await resolveGuidedTicket(ctx, session);
      await sendAgentReply(ctx, interpreted.reply);
      return true;
    }
    case "advance": {
      recordAttempt(session, decision.attemptOutcome);
      advanceStep(session, decision.nextStepIndex);
      await session.save();
      const nextPrompt = formatStepPrompt(guide, decision.nextStepIndex);
      await sendAgentReply(ctx, `${interpreted.reply} ${nextPrompt}`, {
        stepIndex: decision.nextStepIndex,
        stepCount: guide.steps.length,
      });
      return true;
    }
    case "escalate": {
      if (decision.attemptOutcome) {
        recordAttempt(session, decision.attemptOutcome);
      }
      endSession(session, "escalated");
      await session.save();
      await escalateGuidedTicket(
        ctx,
        session,
        decision.attemptOutcome ? "guidance_exhausted" : "user_request",
      );
      await sendAgentReply(ctx, `${interpreted.reply} I'm bringing in a person to help from here.`);
      return true;
    }
    case "hold": {
      await sendAgentReply(ctx, interpreted.reply, {
        stepIndex: session.currentStepIndex,
        stepCount: guide.steps.length,
      });
      return true;
    }
  }
}

async function resolveGuidedTicket(ctx: ReplyContext, session: HydratedDocument<GuidedSessionDoc>): Promise<void> {
  const ticket = await Ticket.findById(session.ticketId);
  if (!ticket || ticket.status === "resolved" || ticket.status === "closed") {
    return;
  }
  if (ticket.status === "open") {
    transitionStatus(ticket as unknown as TransitionableTicket, "in_progress", "system");
  }
  transitionStatus(ticket as unknown as TransitionableTicket, "resolved", "system");
  await ticket.save();
  const transition = ticket.history[ticket.history.length - 1];
  if (transition) {
    notifyTicketUpdated(ticket, transition);
  }
}

async function escalateGuidedTicket(
  ctx: ReplyContext,
  session: HydratedDocument<GuidedSessionDoc>,
  reason: "no_guide" | "guidance_exhausted" | "user_request" | "llm_unavailable",
): Promise<void> {
  const ticket = await Ticket.findById(session.ticketId);
  if (!ticket) {
    return;
  }
  await escalateTicketForGuidance(ctx, ticket, reason);
}

async function escalateTicketForGuidance(
  ctx: ReplyContext,
  ticket: HydratedDocument<TicketDoc>,
  reason: "no_guide" | "guidance_exhausted" | "user_request" | "llm_unavailable",
): Promise<void> {
  if (ticket.escalated) {
    return;
  }
  const from = ticket.handlingMode;
  transitionHandlingMode(ticket as unknown as TransitionableTicket, "human_involved", "system");
  ticket.escalated = true;
  ticket.escalationReason = reason;
  await ticket.save();
  publishEvent(ctx.sessionId, "ticket_updated", {
    reference: ticket.reference,
    field: "handlingMode",
    from,
    to: "human_involved",
    at: clock.now(),
    plainText: `Ticket ${ticket.reference} has been escalated to IT staff.`,
  });
}

export async function sendAgentReply(
  ctx: ReplyContext,
  text: string,
  guidance?: { stepIndex: number; stepCount: number },
): Promise<void> {
  const message = await Message.create({
    conversationId: ctx.conversationId,
    author: "agent",
    text,
    inputOrigin: "typed",
    ...(guidance ? { guidance } : {}),
  });

  for (const word of text.split(" ")) {
    publishEvent(ctx.sessionId, "agent_token", {
      conversationId: ctx.conversationId.toString(),
      messageId: message._id.toString(),
      token: `${word} `,
    });
  }

  publishEvent(ctx.sessionId, "agent_message", {
    conversationId: ctx.conversationId.toString(),
    message: toMessageJson(message),
  });

  await Conversation.findByIdAndUpdate(ctx.conversationId, { lastActivityAt: clock.now() });
}

function toMessageJson(message: MessageDoc) {
  return {
    _id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    author: message.author,
    text: message.text,
    inputOrigin: message.inputOrigin,
    sentAt: message.sentAt,
    ...(message.guidance ? { guidance: message.guidance } : {}),
  };
}

export function toTicketSummary(ticket: TicketDoc) {
  return {
    reference: ticket.reference,
    category: ticket.category,
    status: ticket.status,
    handlingMode: ticket.handlingMode,
    escalated: ticket.escalated,
    description: ticket.description,
    createdAt: ticket.createdAt,
  };
}
