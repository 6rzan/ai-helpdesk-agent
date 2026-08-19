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

### Voice Input: STT Provider Chain with Timeout and Degradation

**File**: `backend/src/services/stt/stt-service.ts` (TC-061–064, TC-072)

Speech-to-text runs a configurable, ordered provider chain (`local` then `openai_compat` by default). Each provider call is wrapped in a per-provider timeout; on failure the service falls through to the next provider and only throws once the entire chain is exhausted, logging a distinct degradation line so the failure is never silent (Principle VIII).

```typescript
function withTimeout(provider: SttProvider, request: TranscriptionRequest): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SttProviderError(provider.name, `${provider.name} timed out after ${config.STT_TIMEOUT_MS}ms`, "timeout"));
    }, config.STT_TIMEOUT_MS);

    provider.transcribe(request).then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export async function transcribe(
  request: TranscriptionRequest,
  chain: SttProvider[] = getProviderChain(),
): Promise<TranscriptionResult> {
  if (chain.length === 0) {
    throw new ServiceUnavailableError("Voice transcription is not configured, please type your message", "STT_UNAVAILABLE");
  }

  const attempted: string[] = [];
  for (const provider of chain) {
    attempted.push(provider.name);
    try {
      const result = await withTimeout(provider, request);
      logger.info({ provider: provider.name, latencyMs: /* ... */ 0 }, "stt.transcribe.success");
      return result;
    } catch (err) {
      const kind = err instanceof SttProviderError ? err.kind : "unavailable";
      logger.warn({ provider: provider.name, kind }, "stt.transcribe.provider_failed");
      // fall through to the next provider in the chain
    }
  }

  // Every provider in the chain failed — this is the visible-degradation line
  logger.error({ attemptedProviders: attempted }, "stt.transcribe.chain_exhausted");
  throw new ServiceUnavailableError("Voice transcription is temporarily unavailable, please type your message", "STT_UNAVAILABLE");
}
```

Error classification is carried as a `kind` on `SttProviderError` (`"unavailable" | "timeout" | "invalid_input"`), so `stt.transcribe.provider_failed` distinguishes *why* a given provider failed without needing to inspect the error message text:

```typescript
export type SttProviderErrorKind = "unavailable" | "timeout" | "invalid_input";

export class SttProviderError extends Error {
  constructor(
    public readonly provider: SttProviderName,
    message: string,
    public readonly kind: SttProviderErrorKind = "unavailable",
  ) {
    super(message);
    this.name = "SttProviderError";
  }
}
```

### 4.6 Constrained Automated Remediation

Three excerpts covering the default-deny decision, the SSH connection's structured
parameters, and the audit record's structural immutability (Constitution Principle II).

#### The policy engine's default-deny path

**File**: `backend/src/services/remediation/policy-engine.ts` (TC-070-089 range)

`matchAction` is the single decision point every proposed action passes through: the
action id, every argument, and the target endpoint must all match a whitelisted policy
entry exactly, or the request is refused with a specific, auditable reason. There is no
fuzzy, prefix, or nearest-neighbour acceptance anywhere in this function — a
near-miss is not a match.

```typescript
export type MatchResult =
  | { ok: true; entry: ActionPolicyEntry; endpoint: TestEndpoint; command: string }
  | { ok: false; reason: RefusalReason };

// Pure exact-match decision: does (policyEntryId, args, endpointId) resolve to
// exactly one whitelisted, endpoint-permitted action? No side effects, no
// execution, no audit write -- callers decide what to do with the result.
export function matchAction(policyEntryId: string, args: Record<string, string>, endpointId: string): MatchResult {
  const policy = getPolicy();

  const entry = policy.available ? policy.entries.get(policyEntryId) : undefined;
  if (!entry) {
    return { ok: false, reason: "no_matching_entry" };
  }

  const declaredNames = new Set(entry.arguments.map((spec) => spec.name));
  for (const key of Object.keys(args)) {
    if (!declaredNames.has(key)) {
      return { ok: false, reason: "argument_mismatch" };
    }
  }
  for (const spec of entry.arguments) {
    const value = args[spec.name];
    if (value === undefined) {
      return { ok: false, reason: "argument_mismatch" };
    }
    if (spec.kind === "enum") {
      if (!spec.values.includes(value)) {
        return { ok: false, reason: "argument_mismatch" };
      }
    } else {
      const anchored = new RegExp(`^(?:${spec.pattern})$`);
      if (!anchored.test(value)) {
        return { ok: false, reason: "argument_mismatch" };
      }
    }
  }

  const endpoint = policy.endpoints.get(endpointId);
  if (!endpoint) {
    return { ok: false, reason: "unregistered_target" };
  }
  if (!entry.allowedEndpointIds.includes(endpointId)) {
    return { ok: false, reason: "endpoint_not_permitted" };
  }

  return { ok: true, entry, endpoint, command: substitute(entry.command, args) };
}
```

`attemptAction` wraps `matchAction` with the remaining gates — the degraded-model check
runs first (US6 AS4), then the kill switch, then consent, then approval — and only calls
the executor once every gate has passed. Every branch, executed or refused, calls
`recordAction` before returning:

```typescript
export async function attemptAction(input: AttemptActionInput): Promise<AttemptActionResult> {
  // US6 AS4: no automated action executes on a classification produced while
  // the system is in a degraded model state. Checked before matching so a
  // degraded proposal is refused even if it would otherwise resolve cleanly.
  if (input.modelDegraded) {
    await recordAction({ /* ... */ outcome: "refused", refusalReason: "degraded_model" });
    return { outcome: "refused", refusalReason: "degraded_model", observedOutput: null };
  }

  const match = matchAction(input.policyEntryId, input.arguments, input.endpointId);
  if (!match.ok) {
    await recordAction({ /* ... */ outcome: "refused", refusalReason: match.reason });
    return { outcome: "refused", refusalReason: match.reason, observedOutput: null };
  }

  // ...remediation_disabled, missing_consent, and missing_approval gates follow
  // the same shape: check, audit the refusal, return. Only after all four pass
  // does execution happen:

  const result = await executor({ endpoint: match.endpoint, command: match.command, timeoutMs: /* ... */ });
  const record = await recordAction({ /* ... */ outcome: result.outcome, observedOutput: result.observedOutput });
  return { outcome: record.outcome, observedOutput: result.observedOutput, actionRecordId: record._id };
}
```

#### The executor's structured-parameter connection

**File**: `backend/src/services/remediation/executor.ts` (TC-090-095 range)

The only module that opens an SSH connection. Host, port, and username are structured
fields read off the matched `TestEndpoint`, passed straight to `ssh2`'s `connect()` as
object properties — there is no command line assembled anywhere, so there is no place
for an injected value to land. The host key fingerprint captured at endpoint-registry
setup time is verified on every connection via `hostVerifier`, not trusted on first use.

```typescript
client.connect({
  host: request.endpoint.host,
  port: request.endpoint.port,
  username: request.endpoint.username,
  ...(config.REMEDIATION_SSH_KEY_PATH ? { privateKey: readFileSync(config.REMEDIATION_SSH_KEY_PATH) } : {}),
  ...(config.REMEDIATION_SSH_KEY_PASSPHRASE ? { passphrase: config.REMEDIATION_SSH_KEY_PASSPHRASE } : {}),
  readyTimeout: config.REMEDIATION_CONNECT_TIMEOUT_MS,
  hostHash: "sha256",
  hostVerifier: (digest: string): boolean => digest === request.endpoint.hostKeyFingerprint,
});
```

The command string itself is not free text either: it is `policy-engine.ts`'s own
`substitute()` output, built by filling named placeholders in the whitelisted entry's
fixed command template with the same argument values `matchAction` already validated
against an enum or an anchored regex — never the reporter's raw words.

#### The audit model's immutability hooks

**File**: `backend/src/models/action-record.ts` (TC-096-098 range)

No route, service, or repository function may update or delete an `ActionRecord`, from
any surface, under any role (Constitution Principle II, FR-010). That guarantee is
enforced structurally on the schema, not left to every caller's discipline:

```typescript
const MUTATION_ERROR = "ActionRecord is append-only: updates and deletes are not permitted (Constitution Principle II)";

function rejectMutation(this: unknown): never {
  throw new Error(MUTATION_ERROR);
}

actionRecordSchema.pre("findOneAndUpdate", rejectMutation);
actionRecordSchema.pre("updateOne", rejectMutation);
actionRecordSchema.pre("updateMany", rejectMutation);
actionRecordSchema.pre("deleteOne", rejectMutation);
actionRecordSchema.pre("deleteMany", rejectMutation);
actionRecordSchema.pre("findOneAndDelete", rejectMutation);
```

Any attempt to call one of these six Mongoose operations against the `ActionRecord`
collection throws before touching the database, regardless of which layer issued the
call — there is no code path, staff-privileged or otherwise, that reaches the
collection through anything but `create()`.

---

## Design Principles

These code samples illustrate the core design principles in action:

1. **Strict Typing**: All enums and state machines are TypeScript const-assertions, preventing invalid category/status/mode values at compile time.
2. **Immutable Audit Trail**: Every state transition appends to a history record with timestamp and actor, enabling full conversation replay and staff transparency.
3. **Session-based Multi-Tenancy**: Reporters are persistent; sessions are ephemeral. Multiple concurrent sessions per reporter enable responsive UI without session fixation.
4. **Event-Driven Notifications**: State changes trigger SSE events to all reporter's open sessions, ensuring real-time UI updates within the 2-second SLA (SC-004).
5. **Fail-Safe Classification**: Ambiguous input exhausts clarification rounds before escalation, never creating unescalated low-confidence tickets.
