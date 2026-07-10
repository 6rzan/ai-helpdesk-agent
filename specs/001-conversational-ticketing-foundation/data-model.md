# Data Model: Conversational & Ticketing Foundation

**Date**: 2026-07-08 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

All collections are MongoDB via Mongoose; every schema has `createdAt`/`updatedAt` timestamps. Enum values are the closed sets below — nothing user-extensible.

## Enumerations

| Enum | Values | Source |
|---|---|---|
| `IssueCategory` | `password_login`, `network`, `printer`, `peripherals`, `performance`, `service_status`, `unclassified` | IR FR-2 (six fixed) + unclassified flag (spec FR-002) |
| `TicketStatus` | `open`, `in_progress`, `resolved`, `closed` | Clarification 2026-07-08 |
| `HandlingMode` | `automated`, `waiting_on_user`, `human_involved` | IR FR-6 |
| `MessageAuthor` | `user`, `agent`, `system` | spec Key Entities |
| `Actor` (history) | `agent`, `user`, `system`, `staff` | spec FR-004 history |

## Entities

### Reporter

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `orgId` | string | **unique index**; required; trimmed; 3–32 chars, `[A-Za-z0-9._-]+` (zod + schema) |
| `displayName` | string | required; 1–60 chars |

- Upserted by `orgId` at session start (research R8). One Reporter → many Conversations, many Tickets.
- Data minimisation (IR NFR-5): no email, phone, or any other personal field.

### Conversation

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `reporterId` | ObjectId → Reporter | required, indexed |
| `state` | `active` \| `ended` | default `active` |
| `clarificationRounds` | number | 0–2; counts clarifying questions for the problem report currently being classified; resets when a ticket is created or escalated (spec FR-005, research R2) |
| `lastActivityAt` | Date | for inactivity expiry |

- One Conversation → many Messages (separate collection — unbounded growth), 0..n Tickets.

### Message

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `conversationId` | ObjectId → Conversation | required, indexed |
| `author` | `MessageAuthor` | required |
| `text` | string | required; 1–4000 chars (spec edge case: overlong input asked to summarise, enforced at API boundary) |
| `sentAt` | Date | required |

- Immutable once written (no update path exposed).

### Ticket

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `reference` | string | **unique index**; format `HD-NNNN` from atomic counter (research R5) |
| `reporterId` | ObjectId → Reporter | required, indexed |
| `conversationId` | ObjectId → Conversation | required — the transcript link (FR-007) |
| `description` | string | required; reporter's own words at creation |
| `category` | `IssueCategory` | required; `unclassified` ⇒ `escalated: true` |
| `classificationConfidence` | number \| null | 0–1; null when unclassified/LLM-unavailable |
| `status` | `TicketStatus` | default `open` |
| `handlingMode` | `HandlingMode` | default `automated` |
| `escalated` | boolean | default false |
| `escalationReason` | `user_request` \| `low_confidence` \| `out_of_scope` \| `llm_unavailable` \| null | required when `escalated` |
| `history` | `TransitionRecord[]` | embedded, **append-only** (Principle II audit spirit) |

**TransitionRecord** (embedded subdocument): `{ at: Date, field: 'status' | 'handlingMode', from: string, to: string, actor: Actor }`. Creation writes the first record. No update or delete path exists for history entries.

## State Machines

### Ticket status (clarified 4-state)

```text
open ──▶ in_progress ──▶ resolved ──▶ closed
              ▲              │
              └──────────────┘   (user reports problem persists)
```

Allowed transitions (everything else rejected by the state machine — unit-tested exhaustively):
`open→in_progress`, `in_progress→resolved`, `resolved→closed`, `resolved→in_progress`, `open→closed` (withdrawn/duplicate).

### Handling mode (orthogonal to status)

- `automated ⇄ waiting_on_user` (agent asks / user answers — spec US2 scenario 3)
- `automated → human_involved`, `waiting_on_user → human_involved` (escalation — one-way in this feature; hand-back arrives with the dashboard feature)

### Escalation triggers (spec FR-005/FR-006, research R2/R7)

| Trigger | Effect |
|---|---|
| Explicit user request (any time) | `escalated=true`, reason `user_request`, mode → `human_involved`, immediately |
| Confidence < 0.7 after 2 clarification rounds | `escalated=true`, reason `low_confidence`, category `unclassified` |
| Report outside six categories | `escalated=true`, reason `out_of_scope` |
| LLM unreachable/timeout/malformed output | ticket created with category `unclassified`, reason `llm_unavailable` |

Every escalation preserves the linked conversation — staff handover context is the Conversation + Message records already attached (FR-007).

## Validation Rules (zod at boundaries — Principle VI)

- **HTTP requests**: every route body/params/query has a zod schema (orgId pattern, message length, enum membership).
- **LLM output** (untrusted input — Principle II): `{ category: enum(six categories) | 'unclassified', confidence: number 0–1, reply: string }`; parse failure ⇒ treated as `llm_unavailable` path, never partially trusted.
- **State transitions**: validated by the ticket state machine before persistence; invalid transition ⇒ typed error, no write, logged.
