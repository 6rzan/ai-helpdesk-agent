import type { Types } from "mongoose";
import { logger } from "../../lib/logger.js";

// Per-conversation serialization for the agent's reply processing.
//
// processReply is fire-and-forget per message (the route returns 202 before it
// resolves), and it reads/writes conversation-scoped state (pendingDuplicate,
// guided-session progress, ticket creation) with no transaction spanning the
// whole turn. Two messages arriving close together on the same conversation —
// a fast typist, a double-tap, or a scripted/automated caller — would run two
// overlapping processReply chains with no ordering between them: each reads
// the conversation's state independently, so the second can create its own
// ticket while unaware of the first, or generate a reply text (including a
// freshly-reserved reference) whose underlying write can still lose a race
// against the other chain. Chaining each conversation's turns onto the same
// promise serializes them without blocking the 202 response or other
// conversations. Found via T019's manual quickstart walkthrough (five
// same-session reports back to back reproduced two agent replies quoting
// ticket references — HD-0060, HD-0061 — that GET /api/tickets/:reference
// then reported as TICKET_NOT_FOUND).
//
// Extracted from conversation-engine.ts by T083: adding it inline pushed that
// file to 526 lines, over the Constitution VI 500-line limit.

const conversationQueues = new Map<string, Promise<void>>();

/**
 * Runs `run` after every reply already queued for this conversation has
 * settled. Never rejects: a failing turn is logged and the queue continues, so
 * one bad turn cannot wedge the conversation.
 */
export function enqueueReply(conversationId: Types.ObjectId, run: () => Promise<void>): void {
  const key = conversationId.toString();
  const previous = conversationQueues.get(key) ?? Promise.resolve();
  const next = previous.then(run, run).catch((err: unknown) => {
    logger.error({ err, conversationId: key }, "failed to process agent reply");
  });
  // OBS-15: the slot has to hold the *same* promise the cleanup compares
  // against. Storing `next` while comparing against `next.finally(...)` (or the
  // reverse) makes the identity check always fail, so the entry is never
  // removed and the map grows one permanent entry per conversation for the
  // lifetime of the process.
  const slot: Promise<void> = next.finally(() => {
    // Only clear the slot if nothing queued behind us while we ran.
    if (conversationQueues.get(key) === slot) {
      conversationQueues.delete(key);
    }
  });
  conversationQueues.set(key, slot);
}

/** Test-only: the number of conversations currently holding a queue slot. */
export function pendingConversationCount(): number {
  return conversationQueues.size;
}
