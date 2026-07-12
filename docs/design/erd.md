# Entity-Relationship Diagram: Conversational & Ticketing Foundation

## ERD

```mermaid
erDiagram
    REPORTER ||--o{ CONVERSATION : "has many"
    REPORTER ||--o{ TICKET : "has many"
    CONVERSATION ||--o{ MESSAGE : "contains"
    CONVERSATION ||--o{ TICKET : "may produce"
    CONVERSATION ||--o{ GUIDED_SESSION : "may run"
    TICKET ||--o{ GUIDED_SESSION : "drives"
    CATEGORY ||--o{ GUIDE : "has versions"
    GUIDE ||--o{ GUIDED_SESSION : "pinned by (categoryName+guideVersion)"

    REPORTER {
        ObjectId _id PK
        string orgId UK "3-32 chars, unique index"
        string displayName "1-60 chars"
    }

    CONVERSATION {
        ObjectId _id PK
        ObjectId reporterId FK
        string state "active | ended"
        number clarificationRounds "0-2, resets on ticket creation"
        Date lastActivityAt
    }

    MESSAGE {
        ObjectId _id PK
        ObjectId conversationId FK
        string author "user | agent | system"
        string text "1-4000 chars, immutable"
        Date sentAt
    }

    TICKET {
        ObjectId _id PK
        string reference UK "format HD-NNNN, atomic counter"
        ObjectId reporterId FK
        ObjectId conversationId FK "transcript link, FR-007"
        string description "reporter's own words"
        string category "6 fixed categories | unclassified"
        number classificationConfidence "0-1 or null"
        string status "open|in_progress|resolved|closed"
        string handlingMode "automated|waiting_on_user|human_involved"
        boolean escalated
        string escalationReason "user_request|low_confidence|out_of_scope|llm_unavailable|null"
        TransitionRecord[] history "embedded, append-only"
    }

    COUNTER {
        string _id PK "sequence name, e.g. 'ticket'"
        number seq "atomic increment source for HD-NNNN"
    }

    CATEGORY {
        ObjectId _id PK
        string name UK "lowercase snake_case slug, immutable"
        string displayName "1-60 chars"
        string classificationDescription "10-500 chars, used by classifier prompt"
        boolean mandated "true for the 6 seeded categories, undeletable"
        boolean retired
        string createdBy "maintainer name"
        Date createdAt
    }

    GUIDE {
        ObjectId _id PK
        string categoryName FK
        number version "monotonic per category, starts at 1, immutable once created"
        GuideStep[] steps "embedded, 1-20 items"
        boolean active "exactly one active version per categoryName"
        string changedBy "maintainer name"
        Date changedAt
        string changeNote "optional, max 300 chars"
    }

    GUIDED_SESSION {
        ObjectId _id PK
        ObjectId conversationId FK
        ObjectId ticketId FK
        string categoryName "pinned at session start, FR-017"
        number guideVersion "pinned at session start, FR-017"
        number currentStepIndex "0-based"
        StepAttempt[] stepAttempts "embedded, append-only"
        string state "active|resolved|escalated|abandoned"
        Date createdAt
        Date updatedAt
    }
```

## Embedded Subdocument: TransitionRecord

Not a separate collection — embedded within `Ticket.history[]`, append-only (no update/delete path):

| Field | Type | Notes |
|---|---|---|
| `at` | Date | timestamp of transition |
| `field` | `"status"` \| `"handlingMode"` | which axis changed |
| `from` | string | prior value |
| `to` | string | new value |
| `actor` | `"agent"` \| `"user"` \| `"system"` \| `"staff"` | who triggered it |

## Embedded Subdocument: GuideStep

Embedded within `Guide.steps[]`, ordered array — position in the array *is* the step index:

| Field | Type | Notes |
|---|---|---|
| `instruction` | string | 10-800 chars, canonical plain-language text; LLM may rephrase but never replaces it |
| `successHint` | string | 5-300 chars, what "worked" looks like for this step |

## Embedded Subdocument: StepAttempt

Embedded within `GuidedSession.stepAttempts[]`, append-only — one record per interpreted user reply:

| Field | Type | Notes |
|---|---|---|
| `stepIndex` | number | which step this attempt was against |
| `outcome` | `"worked"` \| `"not_worked"` \| `"already_tried"` \| `"skipped"` | LLM-interpreted reply classification |
| `at` | Date | timestamp of the attempt |

## Enumerations Reference

| Enum | Values |
|---|---|
| `IssueCategory` | `password_login`, `network`, `printer`, `peripherals`, `performance`, `service_status`, `unclassified` \| any active `Category.name` (FR-014, no longer a fixed literal union) |
| `TicketStatus` | `open`, `in_progress`, `resolved`, `closed` |
| `HandlingMode` | `automated`, `waiting_on_user`, `human_involved` |
| `MessageAuthor` | `user`, `agent`, `system` |
| `Actor` | `agent`, `user`, `system`, `staff` |
| `EscalationReason` | `user_request`, `low_confidence`, `out_of_scope`, `llm_unavailable`, `no_guide`, `guidance_exhausted` |
| `GuidedSessionState` | `active`, `resolved`, `escalated`, `abandoned` |
| `StepAttemptOutcome` | `worked`, `not_worked`, `already_tried`, `skipped` |

## Cardinality Notes

- **Reporter → Conversation**: one-to-many. A reporter accumulates a new Conversation each session start (or resumes an existing active one).
- **Reporter → Ticket**: one-to-many, denormalized FK (also reachable via Conversation) to support fast "all my tickets" queries (TC-026) without a join.
- **Conversation → Message**: one-to-many, unbounded growth — kept in a separate collection rather than embedded.
- **Conversation → Ticket**: one-to-many. A single conversation can produce multiple tickets (e.g., duplicate-denied reports open a second ticket per TC-054; two-problems-in-one-message handled sequentially per TC-051).
- **Counter**: singleton-per-sequence collection used only for atomic `HD-NNNN` reference generation — not part of the domain model proper.
- **Category → Guide**: one-to-many. Guide versions are immutable and append-only (R7); publishing an edit inserts version n+1 and flips version n's `active` off in the same operation, so at most one version per category has `active: true`.
- **Conversation → GuidedSession**: one-to-many over time, but a partial unique index on `{conversationId}` filtered to `state: "active"` enforces at most one *active* session per conversation at once (data-model.md). Reporting a new, different problem mid-guide abandons the prior active session first (conversation-service.ts).
- **Guide → GuidedSession**: a session pins `categoryName` + `guideVersion` at creation (FR-017), so later edits to the guide never change which steps an in-flight session presents, even after a service restart.
