# API Contract: Conversational & Ticketing Foundation

**Date**: 2026-07-08 | **Data model**: [../data-model.md](../data-model.md)

REST + SSE over Express, all JSON, all request bodies zod-validated. Base path `/api`. Errors use a single envelope: `{ error: { code: string, message: string } }` with appropriate HTTP status (400 validation, 404 not found, 409 invalid transition, 503 degraded).

## Sessions

### POST /api/sessions

Start (or resume) a reporter session. Upserts the Reporter by `orgId` (research R8).

- **Request**: `{ orgId: string, displayName: string }`
- **201**: `{ sessionId: string, reporter: { orgId, displayName }, conversationId: string, openTickets: TicketSummary[] }`
  - `openTickets` (status ≠ closed, same orgId) powers cross-session status lookup (FR-008) and the duplicate-report prompt (edge case).
- **400**: invalid orgId/displayName.

## Conversation

### POST /api/conversations/:conversationId/messages

Send a user message. The agent's reply streams over the session's SSE channel; this endpoint returns immediately after persisting the user message.

- **Request**: `{ sessionId: string, text: string (1–4000 chars) }`
- **202**: `{ messageId: string }` — reply arrives as `agent_token`/`agent_message` SSE events.
- **400** overlong/empty text (agent-side "please summarise" behaviour is triggered by a 400 with code `MESSAGE_TOO_LONG` which the frontend renders as an agent bubble).
- **404** unknown conversation; **403** session/conversation mismatch.

Side effects, depending on conversation state (spec US1/US3, research R2):

- classification success (confidence ≥ 0.7) → Ticket created → `ticket_created` event
- low confidence, rounds < 2 → clarifying question in the reply, `clarificationRounds`+1
- low confidence, rounds = 2 → unclassified escalated Ticket → `ticket_created` + `ticket_updated`
- explicit human request detected → escalation on the relevant/new ticket
- LLM unavailable → unclassified Ticket (reason `llm_unavailable`) → `ticket_created`

## Events (SSE)

### GET /api/events?sessionId=...

`text/event-stream`; one stream per session; `EventSource`-compatible with auto-reconnect (`Last-Event-ID` honoured best-effort).

| Event | Data payload | Purpose |
|---|---|---|
| `agent_token` | `{ conversationId, messageId, token }` | streaming reply text (SC-008: first token ≤ 3 s) |
| `agent_message` | `{ conversationId, message: Message }` | reply finalised (complete text, ≤ 10 s) |
| `ticket_created` | `{ ticket: TicketSummary }` | confirmation with quotable reference (US1) |
| `ticket_updated` | `{ reference, field, from, to, at, plainText }` | status/mode change, pushed ≤ 2 s (SC-004); `plainText` is the ready-to-render plain-language sentence (FR-010) |

## Tickets

### GET /api/tickets?sessionId=...

All tickets for the session's reporter (any status), newest first. **200**: `{ tickets: TicketSummary[] }`.

### GET /api/tickets/:reference?sessionId=...

Full ticket detail including `history[]` and linked conversation transcript (FR-007 handover payload). **200**: `{ ticket: TicketDetail }`; **404** unknown reference; **403** not this reporter's ticket.

## Test-Support (NOT part of the product surface)

### PATCH /api/tickets/:reference/state

Drives status/handling-mode transitions so integration tests and the scripted demo can exercise US2 without the (deferred) staff dashboard — per clarification "no staff UI this feature".

- **Request**: `{ field: 'status' | 'handlingMode', to: string, actor: 'staff' | 'system' }`
- **200**: updated `TicketDetail` (and a `ticket_updated` SSE event fires — this is how the ≤ 2 s test measures push latency).
- **409**: transition rejected by the state machine.
- **Guard**: enabled only when `APP_MODE=demo|test`; returns **404** in any other mode. Registered in a separate router file so its absence in normal mode is structural.

## Health

### GET /api/health

**200**: `{ status: 'ok' | 'degraded', llm: { reachable: boolean, model: string }, db: { reachable: boolean } }` — `degraded` means intake continues with the FR-013 unclassified fallback (research R7). Used by SC-006's 24-hour availability probe.

## Shared Types

```ts
TicketSummary = { reference, category, status, handlingMode, escalated, description, createdAt }
TicketDetail  = TicketSummary & { escalationReason, classificationConfidence, history: TransitionRecord[], transcript: Message[] }
```

Frontend mirrors these types in `frontend/src/lib/` (single source: generated from backend zod schemas via `z.infer` re-export).
