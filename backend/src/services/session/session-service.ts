import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { config } from "../../config/index.js";
import { clock } from "../../lib/clock.js";
import { Conversation } from "../../models/conversation.js";
import type { HandlingMode, IssueCategory, TicketStatus } from "../../models/enums.js";
import { Reporter } from "../../models/reporter.js";
import { Ticket } from "../../models/ticket.js";

interface SessionRecord {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  orgId: string;
  lastActivityAt: Date;
}

const sessions = new Map<string, SessionRecord>();

export interface TicketSummary {
  reference: string;
  category: IssueCategory;
  status: TicketStatus;
  handlingMode: HandlingMode;
  escalated: boolean;
  description: string;
  createdAt: Date;
}

export interface CreateSessionResult {
  sessionId: string;
  reporter: { orgId: string; displayName: string };
  conversationId: string;
  openTickets: TicketSummary[];
}

export async function createSession(orgId: string, displayName: string): Promise<CreateSessionResult> {
  const reporter = await Reporter.findOneAndUpdate(
    { orgId },
    { $set: { displayName } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!reporter) {
    throw new Error("Failed to upsert reporter");
  }

  const conversation = await Conversation.create({ reporterId: reporter._id });

  const sessionId = randomUUID();
  sessions.set(sessionId, {
    reporterId: reporter._id,
    conversationId: conversation._id,
    orgId: reporter.orgId,
    lastActivityAt: clock.now(),
  });

  const openTicketDocs = await Ticket.find({ reporterId: reporter._id, status: { $ne: "closed" } });
  const openTickets: TicketSummary[] = openTicketDocs.map((ticket) => ({
    reference: ticket.reference,
    category: ticket.category,
    status: ticket.status,
    handlingMode: ticket.handlingMode,
    escalated: ticket.escalated,
    description: ticket.description,
    createdAt: ticket.createdAt,
  }));

  return {
    sessionId,
    reporter: { orgId: reporter.orgId, displayName: reporter.displayName },
    conversationId: conversation._id.toString(),
    openTickets,
  };
}

export function getSession(sessionId: string): SessionRecord | undefined {
  const record = sessions.get(sessionId);
  if (!record) {
    return undefined;
  }

  const expiresAt = record.lastActivityAt.getTime() + config.SESSION_INACTIVITY_MINUTES * 60_000;
  if (clock.now().getTime() > expiresAt) {
    sessions.delete(sessionId);
    return undefined;
  }
  return record;
}

export function getSessionIdsForReporter(reporterId: Types.ObjectId): string[] {
  const sessionIds: string[] = [];
  for (const [sessionId, record] of sessions) {
    if (record.reporterId.equals(reporterId)) {
      sessionIds.push(sessionId);
    }
  }
  return sessionIds;
}

export function touchSession(sessionId: string): void {
  const record = sessions.get(sessionId);
  if (record) {
    record.lastActivityAt = clock.now();
  }
}

export function resetSessionStore(): void {
  sessions.clear();
}
