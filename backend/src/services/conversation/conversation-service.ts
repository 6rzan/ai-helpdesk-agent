import type { Types } from "mongoose";
import { config } from "../../config/index.js";
import { clock } from "../../lib/clock.js";
import { logger } from "../../lib/logger.js";
import { Conversation, type ConversationDoc } from "../../models/conversation.js";
import type { IssueCategory } from "../../models/enums.js";
import { Message, type MessageDoc } from "../../models/message.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { classify } from "../classification/classifier.js";
import { decideEscalation } from "../escalation/escalation-service.js";
import { publishEvent } from "../../api/sse/event-bus.js";
import type { ConversationTurn } from "../llm/types.js";
import { handlingModeLabel, notifyTicketUpdated, statusLabel } from "../ticket/notifications.js";
import { transitionHandlingMode, transitionStatus, type TransitionableTicket } from "../ticket/state-machine.js";
import { createTicket } from "../ticket/ticket-service.js";

const GREETING_PATTERN =
  /^(hi+|hello|hey+|hiya|yo|greetings|good\s?(morning|afternoon|evening))[\s!.,]*$/i;
const ESCALATION_PATTERN =
  /\b(talk|speak|chat)\b[^.!?]{0,25}\b(human|person|staff|someone|agent|representative)\b|\b(real|actual)\s+(human|person)\b|\bescalate\b/i;
const OFF_TOPIC_PATTERN =
  /\b(essay|homework|assignment|recipe|weather|joke|story|poem|movie|song|lyrics|translate|math problem)\b/i;
const REMEDIATION_PATTERN =
  /\b(can|could|will|would)\s+you\b[^.!?]{0,50}\b(reset|unlock|reinstall|install|uninstall|restart|reboot|delete|remove|wipe|format|change)\b/i;
const RESOLUTION_CONFIRM_PATTERN =
  /\b(yes|yeah|yep|working now|works now|it works|all good|fixed|sorted|that did it|problem solved)\b/i;
const STILL_BROKEN_PATTERN =
  /\b(still|not working|isn'?t working|doesn'?t work|didn'?t work|broken|same (problem|issue)|no luck|nope)\b/i;
const STATUS_QUESTION_PATTERN =
  /\b(status|updates?|progress)\b[^.!?]*\b(tickets?|issues?|reports?|requests?)\b|\b(tickets?|issues?|reports?)\b[^.!?]*\b(status|updates?|progress)\b|\bhow('s| is| are)\s+my\s+(tickets?|issues?|reports?)\b/i;
const DUPLICATE_SAME_PATTERN =
  /\b(yes|yeah|yep|correct|that'?s (it|right|the one)|same (problem|issue|thing)|it is)\b/i;

// FR-012: the agent reports and escalates — it never executes remediation, and it
// stays inside IT-support scope. Pure so the refusal rules are unit-testable.
export type ScopeCheck = "in_scope" | "off_topic" | "remediation";

export function detectScope(text: string): ScopeCheck {
  if (REMEDIATION_PATTERN.test(text)) {
    return "remediation";
  }
  if (OFF_TOPIC_PATTERN.test(text)) {
    return "off_topic";
  }
  return "in_scope";
}

// Edge case: empty/gibberish input never creates a ticket. True-empty text is
// already rejected at the HTTP boundary (routes/conversations.ts), so this only
// needs to catch punctuation-only or vowel-less keysmash content.
export function isContentFree(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return true;
  }
  return /^[a-zA-Z]{4,}$/.test(trimmed) && !/[aeiouAEIOU]/.test(trimmed);
}

// Edge case: two problems in one message are handled one at a time rather than
// silently classified into a single category. Keyword-based (not LLM-based) so
// it stays deterministic and testable without a scripted mock response.
const CATEGORY_KEYWORDS: Record<Exclude<IssueCategory, "unclassified">, { label: string; pattern: RegExp }> = {
  password_login: {
    label: "the password/login trouble",
    pattern: /\b(password|log[\s-]?in|sign[\s-]?in|locked out|credentials)\b/i,
  },
  network: {
    label: "the internet/network trouble",
    pattern: /\b(internet|network|wi-?fi|vpn|connectivity|connection)\b/i,
  },
  printer: {
    label: "the printer issue",
    pattern: /\b(printer|printing|paper jam|jammed)\b/i,
  },
  peripherals: {
    label: "the peripheral device issue",
    pattern: /\b(mouse|keyboard|monitor|webcam|headset|dock(ing)?)\b/i,
  },
  performance: {
    label: "the slow-device issue",
    pattern: /\b(slow|sluggish|freez(e|ing)|lag(gy)?|hang(s|ing)?|crash(ing|es)?)\b/i,
  },
  service_status: {
    label: "the service outage",
    pattern: /\b(service (is )?(down|unavailable)|outage|system status)\b/i,
  },
};

export interface MultiProblemHit {
  category: IssueCategory;
  label: string;
}

export function detectMultiProblem(text: string): MultiProblemHit[] | null {
  const hits: MultiProblemHit[] = [];
  for (const [category, { label, pattern }] of Object.entries(CATEGORY_KEYWORDS)) {
    if (pattern.test(text)) {
      hits.push({ category: category as IssueCategory, label });
    }
  }
  return hits.length >= 2 ? hits : null;
}

export interface HandleIncomingMessageInput {
  sessionId: string;
  conversationId: Types.ObjectId;
  reporterId: Types.ObjectId;
  text: string;
}

export interface HandleIncomingMessageResult {
  messageId: string;
}

interface ReplyContext {
  sessionId: string;
  conversationId: Types.ObjectId;
  reporterId: Types.ObjectId;
  text: string;
}

export async function handleIncomingMessage(
  input: HandleIncomingMessageInput,
): Promise<HandleIncomingMessageResult> {
  const { sessionId, conversationId, reporterId, text } = input;

  const userMessage = await Message.create({ conversationId, author: "user", text });
  await Conversation.findByIdAndUpdate(conversationId, { lastActivityAt: clock.now() });

  void processReply({ sessionId, conversationId, reporterId, text }).catch((err: unknown) => {
    logger.error({ err, conversationId: conversationId.toString() }, "failed to process agent reply");
  });

  return { messageId: userMessage._id.toString() };
}

async function processReply(ctx: ReplyContext): Promise<void> {
  const conversation = await Conversation.findById(ctx.conversationId);
  if (!conversation) {
    return;
  }

  await resumeWaitingTickets(ctx);

  if (conversation.pendingDuplicate) {
    await handlePendingDuplicateReply(ctx, conversation);
    return;
  }

  if (await handleResolutionReply(ctx)) {
    return;
  }

  if (isContentFree(ctx.text)) {
    await sendAgentReply(ctx, "I didn't quite catch a problem there — could you describe what's going wrong?");
    return;
  }

  if (GREETING_PATTERN.test(ctx.text.trim())) {
    await sendAgentReply(ctx, "Hi there! I'm here to help with IT issues — what's going on?");
    return;
  }

  if (STATUS_QUESTION_PATTERN.test(ctx.text) && !ESCALATION_PATTERN.test(ctx.text)) {
    await sendStatusSummary(ctx);
    return;
  }

  if (ESCALATION_PATTERN.test(ctx.text)) {
    await sendAgentReply(
      ctx,
      "Understood — I'm escalating this to our IT staff now. Someone will take it from here.",
    );
    await escalateForUserRequest(ctx);
    return;
  }

  const scope = detectScope(ctx.text);
  if (scope === "off_topic") {
    await sendAgentReply(
      ctx,
      "I can only help with IT issues — things like passwords, network, printers, peripherals, or slow machines. Is there an IT problem I can help you report?",
    );
    return;
  }
  if (scope === "remediation") {
    await sendAgentReply(
      ctx,
      "I can't make changes to systems or accounts myself, but I can report this and bring in IT staff who can — just ask me to escalate it and I will.",
    );
    return;
  }

  const multiProblem = detectMultiProblem(ctx.text);
  if (multiProblem && multiProblem[0] && multiProblem[1]) {
    const [first, second] = multiProblem;
    await sendAgentReply(
      ctx,
      `Sounds like two separate things — ${first.label} and ${second.label}. Let's handle one at a time: which would you like to start with? I can open a second ticket for the other one once we're done.`,
    );
    return;
  }

  const history = await Message.find({ conversationId: ctx.conversationId }).sort({ sentAt: 1 }).lean();
  const outcome = await classify({
    history: history.map((m): ConversationTurn => ({ author: m.author, text: m.text })),
    latestMessage: ctx.text,
  });

  const decision = decideEscalation({
    userRequestedHuman: false, // handled above via ESCALATION_PATTERN
    outcome: outcome.outcome,
    outOfScope: false, // handled above via detectScope
    clarificationRoundsUsed: conversation.clarificationRounds,
    maxClarificationRounds: config.MAX_CLARIFICATION_ROUNDS,
  });

  if (decision.action === "proceed" && outcome.outcome === "classified") {
    const existingDuplicate = await Ticket.findOne({
      reporterId: ctx.reporterId,
      category: outcome.category,
      status: { $ne: "closed" },
    }).sort({ createdAt: -1 });

    if (existingDuplicate) {
      await Conversation.findByIdAndUpdate(ctx.conversationId, {
        pendingDuplicate: {
          category: outcome.category,
          confidence: outcome.confidence,
          description: ctx.text,
          reply: outcome.reply,
          existingReference: existingDuplicate.reference,
        },
      });
      await sendAgentReply(
        ctx,
        `This sounds like it might be the same issue as ticket ${existingDuplicate.reference}, which is still open. Is this the same problem, or something new?`,
      );
      return;
    }

    const ticket = await createTicket({
      reporterId: ctx.reporterId,
      conversationId: ctx.conversationId,
      description: ctx.text,
      category: outcome.category,
      confidence: outcome.confidence,
      handlingMode: "automated",
      escalated: false,
    });
    await sendAgentReply(ctx, `${outcome.reply} Your ticket reference is ${ticket.reference} — you can quote this any time.`);
    await Conversation.findByIdAndUpdate(ctx.conversationId, { clarificationRounds: 0 });
    publishEvent(ctx.sessionId, "ticket_created", { ticket: toTicketSummary(ticket) });
    return;
  }

  if (decision.action === "clarify" && outcome.outcome === "needs_clarification") {
    await sendAgentReply(ctx, outcome.reply);
    await Conversation.findByIdAndUpdate(ctx.conversationId, { $inc: { clarificationRounds: 1 } });
    return;
  }

  if (decision.action === "escalate") {
    const ticket = await createTicket({
      reporterId: ctx.reporterId,
      conversationId: ctx.conversationId,
      description: ctx.text,
      category: "unclassified",
      confidence: null,
      handlingMode: decision.handlingMode,
      escalated: decision.escalated,
      escalationReason: decision.reason,
    });
    const replyText =
      decision.reason === "llm_unavailable"
        ? `I'm having trouble reaching the assistant right now, so I've saved your report and flagged it for a person to review. Your ticket reference is ${ticket.reference} — you can quote this any time.`
        : `I still can't quite classify this, so I'm flagging it for a person to take a look. Your ticket reference is ${ticket.reference} — you can quote this any time.`;
    await sendAgentReply(ctx, replyText);
    await Conversation.findByIdAndUpdate(ctx.conversationId, { clarificationRounds: 0 });
    publishEvent(ctx.sessionId, "ticket_created", { ticket: toTicketSummary(ticket) });
    if (decision.reason === "low_confidence") {
      publishEvent(ctx.sessionId, "ticket_updated", {
        reference: ticket.reference,
        field: "handlingMode",
        from: "automated",
        to: "human_involved",
        at: ticket.createdAt,
        plainText: `Ticket ${ticket.reference} has been escalated to IT staff for a closer look.`,
      });
    }
  }
}

async function resumeWaitingTickets(ctx: ReplyContext): Promise<void> {
  const waiting = await Ticket.find({ conversationId: ctx.conversationId, handlingMode: "waiting_on_user" });
  for (const ticket of waiting) {
    transitionHandlingMode(ticket as unknown as TransitionableTicket, "automated", "user");
    await ticket.save();
    const transition = ticket.history[ticket.history.length - 1];
    if (transition) {
      notifyTicketUpdated(ticket, transition);
    }
  }
}

// Edge case: a report matching an already-open ticket's category parks here
// (Conversation.pendingDuplicate) until the reporter says whether it's the same
// problem. "Same" leaves the existing ticket alone; anything else opens a new one.
async function handlePendingDuplicateReply(ctx: ReplyContext, conversation: ConversationDoc): Promise<void> {
  const pending = conversation.pendingDuplicate;
  if (!pending) {
    return;
  }

  if (DUPLICATE_SAME_PATTERN.test(ctx.text)) {
    await sendAgentReply(ctx, `Got it — I'll leave this with ticket ${pending.existingReference}, no need to open a new one.`);
    await Conversation.findByIdAndUpdate(ctx.conversationId, { pendingDuplicate: null, clarificationRounds: 0 });
    return;
  }

  const ticket = await createTicket({
    reporterId: ctx.reporterId,
    conversationId: ctx.conversationId,
    description: pending.description,
    category: pending.category as IssueCategory,
    confidence: pending.confidence,
    handlingMode: "automated",
    escalated: false,
  });
  await sendAgentReply(ctx, `${pending.reply} Your ticket reference is ${ticket.reference} — you can quote this any time.`);
  await Conversation.findByIdAndUpdate(ctx.conversationId, { pendingDuplicate: null, clarificationRounds: 0 });
  publishEvent(ctx.sessionId, "ticket_created", { ticket: toTicketSummary(ticket) });
}

// US2-AS4/FR-004: after staff mark a ticket resolved, the reporter's next reply
// decides its fate — confirmation closes it, "still broken" reopens it, silence
// leaves it resolved. Checked before intent handling; a reply that matches
// neither pattern falls through to normal processing.
async function handleResolutionReply(ctx: ReplyContext): Promise<boolean> {
  const resolved = await Ticket.find({ conversationId: ctx.conversationId, status: "resolved" });
  if (resolved.length === 0) {
    return false;
  }

  const stillBroken = STILL_BROKEN_PATTERN.test(ctx.text);
  if (!stillBroken && !RESOLUTION_CONFIRM_PATTERN.test(ctx.text)) {
    return false;
  }

  const to = stillBroken ? "in_progress" : "closed";
  for (const ticket of resolved) {
    transitionStatus(ticket as unknown as TransitionableTicket, to, "user");
    await ticket.save();
    const transition = ticket.history[ticket.history.length - 1];
    if (transition) {
      notifyTicketUpdated(ticket, transition);
    }
  }

  const references = resolved.map((ticket) => ticket.reference).join(", ");
  if (stillBroken) {
    await sendAgentReply(
      ctx,
      `Sorry to hear it's still not right — I've reopened ticket ${references} and work on it will continue.`,
    );
  } else {
    await sendAgentReply(
      ctx,
      `Great to hear! I've closed ticket ${references}. If anything else comes up, just tell me here.`,
    );
  }
  return true;
}

async function sendStatusSummary(ctx: ReplyContext): Promise<void> {
  const tickets = await Ticket.find({ reporterId: ctx.reporterId }).sort({ createdAt: -1 });
  if (tickets.length === 0) {
    await sendAgentReply(
      ctx,
      "You don't have any tickets on file yet — tell me what's going wrong and I'll get one opened for you.",
    );
    return;
  }

  const lines = tickets.map(
    (ticket) =>
      `Ticket ${ticket.reference} (${ticket.category.replace(/_/g, " ")}) is ${statusLabel(ticket.status)} and ${handlingModeLabel(ticket.handlingMode)}.`,
  );
  await sendAgentReply(ctx, `Here's where things stand. ${lines.join(" ")}`);
}

async function escalateForUserRequest(ctx: ReplyContext): Promise<void> {
  const existing = await Ticket.findOne({ conversationId: ctx.conversationId }).sort({ createdAt: -1 });

  if (existing) {
    if (existing.escalated) {
      return;
    }
    const from = existing.handlingMode;
    existing.handlingMode = "human_involved";
    existing.escalated = true;
    existing.escalationReason = "user_request";
    existing.history.push({
      at: clock.now(),
      field: "handlingMode",
      from,
      to: "human_involved",
      actor: "system",
    });
    await existing.save();
    publishEvent(ctx.sessionId, "ticket_updated", {
      reference: existing.reference,
      field: "handlingMode",
      from,
      to: "human_involved",
      at: clock.now(),
      plainText: `Ticket ${existing.reference} has been escalated to IT staff at your request.`,
    });
    return;
  }

  const ticket = await createTicket({
    reporterId: ctx.reporterId,
    conversationId: ctx.conversationId,
    description: ctx.text,
    category: "unclassified",
    confidence: null,
    handlingMode: "human_involved",
    escalated: true,
    escalationReason: "user_request",
  });
  publishEvent(ctx.sessionId, "ticket_created", { ticket: toTicketSummary(ticket) });
}

async function sendAgentReply(ctx: ReplyContext, text: string): Promise<void> {
  const message = await Message.create({ conversationId: ctx.conversationId, author: "agent", text });

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
    sentAt: message.sentAt,
  };
}

function toTicketSummary(ticket: TicketDoc) {
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
