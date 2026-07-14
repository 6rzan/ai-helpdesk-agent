import { Types, type HydratedDocument } from "mongoose";
import { Reporter } from "../../src/models/reporter.js";
import { Conversation } from "../../src/models/conversation.js";
import { Message } from "../../src/models/message.js";
import { Ticket, type TicketDoc } from "../../src/models/ticket.js";
import { nextTicketReference } from "../../src/services/ticket/counter.js";
import type { MessageAuthor } from "../../src/models/enums.js";

let orgCounter = 0;

interface TicketFixtureOptions {
  reporterAccountId?: Types.ObjectId;
  reporterDisplayName?: string;
  category?: string;
  status?: "open" | "in_progress" | "resolved" | "closed";
  handlingMode?: "automated" | "waiting_on_user" | "human_involved";
  escalated?: boolean;
  confidence?: number | null;
  description?: string;
  messages?: { author: MessageAuthor; text: string }[];
}

export interface TicketFixture {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  ticket: HydratedDocument<TicketDoc>;
  reference: string;
}

/**
 * Seed a Reporter + Conversation + optional transcript + Ticket directly, bypassing
 * the chat flow. Used by staff-facing tests that need existing tickets to act on.
 */
export async function createTicketFixture(options: TicketFixtureOptions = {}): Promise<TicketFixture> {
  orgCounter += 1;
  const reporter = await Reporter.create({
    orgId: `ORG-${orgCounter}-${Date.now()}`.slice(0, 32),
    displayName: options.reporterDisplayName ?? "Chat Reporter",
  });
  const conversation = await Conversation.create({ reporterId: reporter._id });

  for (const message of options.messages ?? []) {
    await Message.create({
      conversationId: conversation._id,
      author: message.author,
      text: message.text,
      inputOrigin: "typed",
    });
  }

  const reference = await nextTicketReference();
  const ticket = await Ticket.create({
    reference,
    reporterId: reporter._id,
    conversationId: conversation._id,
    description: options.description ?? "Cannot connect to the office wifi.",
    category: options.category ?? "network",
    classificationConfidence: options.confidence ?? 0.82,
    status: options.status ?? "open",
    handlingMode: options.handlingMode ?? "automated",
    escalated: options.escalated ?? false,
    ...(options.reporterAccountId ? { reporterAccountId: options.reporterAccountId } : {}),
  });

  return {
    reporterId: reporter._id,
    conversationId: conversation._id,
    ticket: ticket as unknown as HydratedDocument<TicketDoc>,
    reference,
  };
}
