# Sample Code Excerpts

## Named Code Sections

This document contains representative code excerpts from the implementation, organized by feature area.

### Issue Categories and Enums

**File**: `backend/src/models/enums.ts`

```typescript
// IssueCategory: seven distinct IT help categories plus unclassified fallback
export const ISSUE_CATEGORIES = [
  "password_login",
  "network",
  "printer",
  "peripherals",
  "performance",
  "service_status",
  "unclassified",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

// TicketStatus: four-state lifecycle (open → in_progress → resolved → closed)
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// HandlingMode: three levels of staff involvement (automated → waiting_on_user → human_involved)
export const HANDLING_MODES = ["automated", "waiting_on_user", "human_involved"] as const;
export type HandlingMode = (typeof HANDLING_MODES)[number];

// EscalationReason: tracks why a ticket was escalated to human staff
export const ESCALATION_REASONS = [
  "user_request",      // explicit "I want to talk to IT staff"
  "low_confidence",    // classifier unsure after clarification rounds exhausted
  "out_of_scope",      // request detected as off-topic/non-IT
  "llm_unavailable",   // LLM provider failure forces escalation
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];
```

### Ticket State Machine

**File**: `backend/src/services/ticket/state-machine.ts`

The state machine enforces valid ticket lifecycle transitions. Status progresses `open` → `in_progress` → `resolved` → `closed`. Handling mode evolves `automated` → `waiting_on_user` or `human_involved` (terminal).

```typescript
// Valid transitions: status can move forward, or resolved can revert to in_progress
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "closed"],           // skip in_progress if immediately resolved
  in_progress: ["resolved"],                 // must resolve before closing
  resolved: ["closed", "in_progress"],       // revert if problem persists
  closed: [],                                // terminal
};

// Handling mode is one-way escalation: once human_involved, stays terminal
const HANDLING_MODE_TRANSITIONS: Record<HandlingMode, HandlingMode[]> = {
  automated: ["waiting_on_user", "human_involved"],
  waiting_on_user: ["automated", "human_involved"],
  human_involved: [],  // no outgoing transitions
};

// Enforce transition rules, reject invalid moves with ConflictError
export function transitionStatus(ticket: TransitionableTicket, to: TicketStatus, actor: Actor): void {
  const from = ticket.status;
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition ticket status from "${from}" to "${to}"`, "INVALID_TRANSITION");
  }
  ticket.status = to;
  ticket.history.push({ at: clock.now(), field: "status", from, to, actor });
}

export function transitionHandlingMode(ticket: TransitionableTicket, to: HandlingMode, actor: Actor): void {
  const from = ticket.handlingMode;
  if (!HANDLING_MODE_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition ticket handling mode from "${from}" to "${to}"`, "INVALID_TRANSITION");
  }
  ticket.handlingMode = to;
  ticket.history.push({ at: clock.now(), field: "handlingMode", from, to, actor });
}
```

### Escalation and Clarification Test Pattern

**File**: `backend/tests/integration/escalation-flow.test.ts` (TC-044/045/046)

This test pattern demonstrates the full US3 clarification-and-escalation flow: ambiguous reports receive clarification rounds, and after 2 rounds exhaust, the next vague message triggers auto-escalation of an unclassified ticket to IT staff.

```typescript
const VAGUE_TEXT = "something is wrong with my thing, it just is not right";

async function startSession(ctx: TestContext, orgId: string) {
  const res = await request(ctx.app)
    .post("/api/sessions")
    .send({ orgId, displayName: "Alex Chen" });
  expect(res.status).toBe(201);
  return { sessionId: res.body.sessionId as string, conversationId: res.body.conversationId as string };
}

async function postMessage(ctx: TestContext, session: { sessionId: string; conversationId: string }, text: string) {
  const res = await request(ctx.app)
    .post(`/api/conversations/${session.conversationId}/messages`)
    .send({ sessionId: session.sessionId, text });
  expect(res.status).toBe(202);
}

// TC-044: ambiguous report → clarifying question, no ticket
await postMessage(ctx, session, VAGUE_TEXT);
// agent replies: "Could you share a bit more detail about the issue you're facing?"

// TC-045: still vague after 2 rounds → auto-escalated unclassified ticket created
await postMessage(ctx, session, "it really just does something odd sometimes");
await postMessage(ctx, session, "honestly hard to describe, everything feels weird");
const ticket = await waitForTicket(session.conversationId);
expect(ticket.category).toBe("unclassified");
expect(ticket.escalated).toBe(true);
expect(ticket.handlingMode).toBe("human_involved");
expect(ticket.escalationReason).toBe("low_confidence");

// TC-046: explicit human request → immediate escalation
await postMessage(ctx, session, "can I just talk to IT staff about this?");
const escalatedTicket = await waitForTicket(session.conversationId);
expect(escalatedTicket.escalated).toBe(true);
expect(escalatedTicket.escalationReason).toBe("user_request");
```

### Ticket Notifications and SSE Events

**File**: `backend/src/services/ticket/notifications.ts`

Ticket updates (status/handling-mode changes) trigger plain-text notifications pushed to all reporter's open sessions via Server-Sent Events (SSE). The example shows the notification pattern and the resolution-confirmation prompt flow.

```typescript
// Plain-language translation of status/handling-mode changes
const STATUS_LABELS: Record<string, string> = {
  open: "open",
  in_progress: "being worked on",
  resolved: "resolved",
  closed: "closed",
};

const HANDLING_MODE_LABELS: Record<string, string> = {
  automated: "being handled automatically",
  waiting_on_user: "waiting on a reply from you",
  human_involved: "with IT staff",
};

// Notify all sessions of a ticket transition
export function notifyTicketUpdated(
  ticket: { reporterId: Types.ObjectId; reference: string },
  transition: TicketTransition,
): void {
  const payload = {
    reference: ticket.reference,
    field: transition.field,
    from: transition.from,
    to: transition.to,
    at: transition.at,
    plainText: plainTextForTransition(ticket.reference, transition),
    // e.g., plainText: "Ticket HD-0001 is now with IT staff."
  };
  // Push to every session the reporter has open
  for (const sessionId of getSessionIdsForReporter(ticket.reporterId)) {
    publishEvent(sessionId, "ticket_updated", payload);
  }
}

// When staff mark a ticket resolved, ask user to confirm the fix
export async function askResolutionConfirmation(ticket: {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  reference: string;
}): Promise<void> {
  const text = `Ticket ${ticket.reference} has been marked resolved — is everything working now? Reply "yes" to close it, or tell me if it's still not working.`;
  const message = await Message.create({ conversationId: ticket.conversationId, author: "agent", text });
  const payload = {
    conversationId: ticket.conversationId.toString(),
    message: {
      _id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      author: message.author,
      text: message.text,
      sentAt: message.sentAt,
    },
  };
  for (const sessionId of getSessionIdsForReporter(ticket.reporterId)) {
    publishEvent(sessionId, "agent_message", payload);
  }
}
```

### Session and Reporter Management

**File**: `backend/src/services/session/session-service.ts`

Sessions are ephemeral client-side identities; reporters are persistent server-side records keyed by `orgId`. A reporter can have multiple concurrent sessions, and resuming with the same `orgId` surfaces all open tickets from previous sessions (FR-008).

```typescript
interface SessionRecord {
  reporterId: Types.ObjectId;
  conversationId: Types.ObjectId;
  orgId: string;
  lastActivityAt: Date;
}

const sessions = new Map<string, SessionRecord>();

export interface CreateSessionResult {
  sessionId: string;
  reporter: { orgId: string; displayName: string };
  conversationId: string;
  openTickets: TicketSummary[];
}

// Create or resume a session for an orgId; return all open tickets
export async function createSession(orgId: string, displayName: string): Promise<CreateSessionResult> {
  const reporter = await Reporter.findOneAndUpdate(
    { orgId },
    { $set: { displayName } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const conversation = await Conversation.create({ reporterId: reporter._id });
  const sessionId = randomUUID();
  
  sessions.set(sessionId, {
    reporterId: reporter._id,
    conversationId: conversation._id,
    orgId,
    lastActivityAt: clock.now(),
  });

  // Fetch all open tickets for this reporter (cross-session visibility)
  const openTickets = await Ticket.find({ reporterId: reporter._id, status: { $in: ["open", "in_progress"] } });
  
  return {
    sessionId,
    reporter: { orgId, displayName: reporter.displayName },
    conversationId: conversation._id.toString(),
    openTickets: openTickets.map(toTicketSummary),
  };
}

// Every session is tied to a reporter; look up reporter by sessionId for authorization
export function getReporterIdFromSession(sessionId: string): Types.ObjectId {
  const record = sessions.get(sessionId);
  if (!record) throw new ForbiddenError("Session not found");
  return record.reporterId;
}
```

---

## Design Principles

These code samples illustrate the core design principles in action:

1. **Strict Typing**: All enums and state machines are TypeScript const-assertions, preventing invalid category/status/mode values at compile time.
2. **Immutable Audit Trail**: Every state transition appends to a history record with timestamp and actor, enabling full conversation replay and staff transparency.
3. **Session-based Multi-Tenancy**: Reporters are persistent; sessions are ephemeral. Multiple concurrent sessions per reporter enable responsive UI without session fixation.
4. **Event-Driven Notifications**: State changes trigger SSE events to all reporter's open sessions, ensuring real-time UI updates within the 2-second SLA (SC-004).
5. **Fail-Safe Classification**: Ambiguous input exhausts clarification rounds before escalation, never creating unescalated low-confidence tickets.
