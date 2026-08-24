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
    TICKET ||--o{ APPROVAL_REQUEST : "may await"
    TICKET ||--o{ ACTION_RECORD : "accumulates (or null, pre-ticket refusal)"
    CONVERSATION ||--o{ APPROVAL_REQUEST : "returns outcome into"
    CONVERSATION ||--o{ ACTION_RECORD : "may attribute"
    APPROVAL_REQUEST ||--o| ACTION_RECORD : "resultingActionRecordId, on approval"
    ACTION_POLICY_ENTRY ||--o{ APPROVAL_REQUEST : "policyEntryId (file, not FK)"
    ACTION_POLICY_ENTRY ||--o{ ACTION_RECORD : "policyEntryId (file, not FK)"
    ACTION_POLICY_ENTRY }o--o{ TEST_ENDPOINT : "allowedEndpointIds (file, not FK)"

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

    %% --- 005-constrained-remediation: three new Mongo collections ---

    REMEDIATION_SETTINGS {
        string _id PK "fixed singleton key"
        boolean globallyEnabled "kill switch, default from REMEDIATION_ENABLED, default false"
        string_array disabledEndpointIds "endpoint ids disabled individually"
        Date updatedAt
    }

    APPROVAL_REQUEST {
        ObjectId _id PK
        ObjectId ticketId FK "indexed"
        ObjectId conversationId FK "for returning the outcome into the chat"
        string policyEntryId "the exact action, file-referenced not FK"
        map arguments "already validated against the entry at creation"
        string endpointId "resolved target, file-referenced not FK"
        ConsentRecord consent "reporter consent, required at creation"
        string status "pending|approved|declined|expired|no_longer_applicable"
        Date raisedAt
        Date expiresAt "raisedAt + REMEDIATION_APPROVAL_TTL_MINUTES"
        object decidedBy "{accountId, displayName} or null"
        Date decidedAt "null until decided"
        string closureReason "set for expired and no_longer_applicable"
        ObjectId resultingActionRecordId FK "null until execution produces a record"
    }

    ACTION_RECORD {
        ObjectId _id PK
        Date at "indexed"
        string actor "agent|user|staff|system, reuses ACTORS enum"
        ObjectId ticketId FK "indexed, null only for pre-ticket refusals"
        ObjectId conversationId FK
        string classifiedIntent "what the agent understood the request to be"
        string policyEntryId "null when nothing in the whitelist matched"
        string tier "read_only|state_changing|null, from the matched entry"
        string requestedAction "exact command, or the unmatched request as classified"
        map arguments
        string endpointId "null for unmatched or unregistered-target refusals"
        AuthorisationRecord authorisation "consent and approval relied upon"
        string outcome "succeeded|failed|timed_out|attempted_unverified|refused"
        string refusalReason "12-value vocabulary, null unless outcome=refused"
        string observedOutput "captured command output, length-bounded, nullable"
        object verification "{entryId, outcome, observedOutput} or null, R10"
        number durationMs "nullable"
    }

    %% --- 005-constrained-remediation: committed policy files, not Mongo (no _id, no FK) ---

    ACTION_POLICY_ENTRY {
        string id PK "kebab-case, stable, never reused"
        string description "shown to the employee, feeds the tool description"
        string category "issue category served, or null for any"
        string guidedStepRef "optional guided step this action can satisfy, nullable"
        string tier "read_only|state_changing"
        string command "fixed template, literals + named placeholders only"
        ArgumentSpec_array arguments
        string_array allowedEndpointIds "non-empty, must exist in TEST_ENDPOINT"
        string verifiedBy "id of a read_only entry that observes success (R10), nullable"
        number timeoutMs "per-entry override of the default, nullable"
    }

    TEST_ENDPOINT {
        string id PK "unique, stable, the only way an action names a target"
        string label "shown to staff"
        string host "container host reachable from the demo machine"
        number port "SSH port"
        string username "account the executor connects as"
        string hostKeyFingerprint "pinned at setup, verified on every connection, R2"
        string description "shown in the audit view"
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

## Embedded Subdocument: ConsentRecord (005-constrained-remediation)

Embedded on both `ApprovalRequest.consent` and `ActionRecord.authorisation.consent`:

| Field | Type | Notes |
|---|---|---|
| `given` | boolean | |
| `byAccountId` | ObjectId → UserAccount | the reporter |
| `at` | Date | |
| `messageId` | ObjectId → Message | the exact message that constituted consent — silence, ambiguity, or earlier general willingness is not consent (FR-004) |

## Embedded Subdocument: AuthorisationRecord (005-constrained-remediation)

Embedded on `ActionRecord.authorisation`:

| Field | Type | Notes |
|---|---|---|
| `consent` | ConsentRecord \| null | |
| `approval` | `{requestId, byAccountId, displayName, at}` \| null | present for every executed state-changing action, without exception (SC-005a) |

## Embedded Subdocument: ArgumentSpec (005-constrained-remediation, policy file only)

Embedded within `ActionPolicyEntry.arguments[]` in `action-policy.json` — not Mongo, not runtime-writable:

| Field | Type | Notes |
|---|---|---|
| `name` | string | matches a placeholder in `command` |
| `kind` | `"enum"` \| `"pattern"` | no free-text argument kind exists |
| `values` | string[] | required when `kind` is `enum` — the complete permitted set |
| `pattern` | string | required when `kind` is `pattern` — anchored regex, no alternation into whitespace or shell metacharacters |

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
| `ActionTier` | `read_only`, `state_changing` |
| `ApprovalStatus` | `pending`, `approved`, `declined`, `expired`, `no_longer_applicable` |
| `ActionOutcome` | `succeeded`, `failed`, `timed_out`, `attempted_unverified`, `refused` — separate from `TicketStatus`; `StatusBadge.tsx` never absorbs these values |
| `RefusalReason` | `no_matching_entry`, `argument_mismatch`, `unregistered_target`, `endpoint_not_permitted`, `missing_consent`, `missing_approval`, `remediation_disabled`, `low_confidence`, `degraded_model`, `not_ticket_owner`, `already_attempted`, `step_cap_reached` |

## Cardinality Notes

- **Reporter → Conversation**: one-to-many. A reporter accumulates a new Conversation each session start (or resumes an existing active one).
- **Reporter → Ticket**: one-to-many, denormalized FK (also reachable via Conversation) to support fast "all my tickets" queries (TC-026) without a join.
- **Conversation → Message**: one-to-many, unbounded growth — kept in a separate collection rather than embedded.
- **Conversation → Ticket**: one-to-many. A single conversation can produce multiple tickets (e.g., duplicate-denied reports open a second ticket per TC-054; two-problems-in-one-message handled sequentially per TC-051).
- **Counter**: singleton-per-sequence collection used only for atomic `HD-NNNN` reference generation — not part of the domain model proper.
- **Category → Guide**: one-to-many. Guide versions are immutable and append-only (R7); publishing an edit inserts version n+1 and flips version n's `active` off in the same operation, so at most one version per category has `active: true`.
- **Conversation → GuidedSession**: one-to-many over time, but a partial unique index on `{conversationId}` filtered to `state: "active"` enforces at most one *active* session per conversation at once (data-model.md). Reporting a new, different problem mid-guide abandons the prior active session first (conversation-service.ts).
- **Guide → GuidedSession**: a session pins `categoryName` + `guideVersion` at creation (FR-017), so later edits to the guide never change which steps an in-flight session presents, even after a service restart.
- **Ticket → ApprovalRequest**: one-to-many over time, but the approval lifecycle (data-model.md §4) means at most one request is ever `pending` for the same proposed action at once — `pending → approved | declined | expired | no_longer_applicable` is a one-way transition on a conditional update, so a concurrent second decision loses cleanly (R6).
- **Ticket → ActionRecord**: one-to-many, and the only Mongo relationship in this feature that tolerates a null FK — a refusal raised before any ticket exists (e.g. `no_matching_entry` off a bare classification) still gets an audited record with `ticketId: null` (FR-009/010).
- **ApprovalRequest → ActionRecord**: zero-or-one, set only on approval (`resultingActionRecordId`). A declined, expired, or no-longer-applicable request never produces an ActionRecord of its own — the case proceeds by guidance or escalation instead (US3 AS3).
- **ActionPolicyEntry / TestEndpoint → everything**: these two are committed JSON files (`backend/src/policy/action-policy.json`, `backend/src/policy/test-endpoints.json`), read once at startup, zod-validated, and frozen — not Mongo documents. `policyEntryId` and `endpointId` on `ApprovalRequest` and `ActionRecord` are therefore string references into a file, never a Mongo `$ref`/populate path, and there is no write path anywhere in the codebase that could add, remove, or mutate an entry at runtime (Principle II, FR-001/FR-003).
