# Data Model: Guided Troubleshooting

**Feature**: 003-guided-troubleshooting | **Date**: 2026-07-12
Storage: MongoDB via Mongoose. All writes schema-validated (zod at API boundary, Mongoose at persistence). See [research.md](research.md) R1/R3/R7 for rationale.

## SupportCategory (`categories` collection)

| Field | Type | Constraints |
|---|---|---|
| `name` | string | unique, lowercase snake_case slug (e.g. `password_login`); immutable after creation |
| `displayName` | string | required, 1–60 chars |
| `classificationDescription` | string | required, 10–500 chars; fed verbatim into the classification prompt (R2) |
| `mandated` | boolean | `true` for the seeded six; blocks deletion (FR-018) |
| `retired` | boolean | default `false`; soft-delete for non-mandated categories (R7) |
| `createdBy` / `createdAt` | string / Date | maintainer name + timestamp (FR-016) |

**Validation rules**: unique `name` (FR-015); `mandated: true` documents reject `retired: true` and deletion; a category cannot be created without an initial guide version in the same operation (FR-015 "non-empty, well-formed guide").

## TroubleshootingGuide (`guides` collection — immutable version documents)

| Field | Type | Constraints |
|---|---|---|
| `categoryName` | string | ref → `categories.name` |
| `version` | int | monotonic per category, starts at 1; `(categoryName, version)` unique |
| `steps` | GuideStep[] | 1–20 items, ordered |
| `active` | boolean | exactly one active version per category |
| `changedBy` / `changedAt` | string / Date | maintainer name + timestamp (FR-016) |
| `changeNote` | string? | optional, ≤ 300 chars |

**GuideStep (embedded)**

| Field | Type | Constraints |
|---|---|---|
| `instruction` | string | required, 10–800 chars, plain language (NFR-2); canonical text shown to user (R4) |
| `successHint` | string | required, 5–300 chars; what "worked" looks like |

**State transitions**: versions are never edited or deleted. "Edit guide" = insert version n+1 (`active: true`) + atomically set version n `active: false`. History = all documents for a `categoryName` (FR-016, SC-008).

## GuidedSession (`guided_sessions` collection)

| Field | Type | Constraints |
|---|---|---|
| `conversationId` | ObjectId | ref → conversations; at most one session with `state: "active"` per conversation (partial unique index) |
| `ticketId` | ObjectId | ref → tickets |
| `categoryName` | string | category at classification time |
| `guideVersion` | int | pinned at session start (FR-017); with `categoryName` resolves the exact guide document |
| `currentStepIndex` | int | 0-based; ≤ steps.length |
| `stepAttempts` | StepAttempt[] | append-only (FR-005) |
| `state` | enum | `active` → `resolved` \| `escalated` \| `abandoned` (terminal) |
| `createdAt` / `updatedAt` | Date | timestamps |

**StepAttempt (embedded)**

| Field | Type | Constraints |
|---|---|---|
| `stepIndex` | int | index into the pinned guide version's steps |
| `outcome` | enum | `worked` \| `not_worked` \| `already_tried` \| `skipped` |
| `at` | Date | timestamp |

**State transitions (deterministic, in `guidance-service.ts` — R4)**

```
(classification into supported category, ticket created)
        → active [present step 0]
active + reply "worked"        → resolved   [ticket → resolved, FR-006]
active + reply "not_worked"    → advance stepIndex; if exhausted → escalated [FR-007]
active + reply "already_tried" → record attempt(outcome=already_tried), advance same as not_worked
active + reply "wants_human"   → escalated  [partial record attached, FR-008]
active + reply "question"      → stay on current step [answer, no attempt recorded]
active + reply "unclear"/low-confidence → stay [ask clarifying question, FR-013]
active + new different problem → abandoned  [spec edge case; new classification may open a new session]
guide missing/invalid at start → (no session) escalate immediately [FR-012]
```

Terminal states never transition. Resuming a conversation loads the `active` session and continues at `currentStepIndex` (FR-011).

## Modified existing entities

- **Ticket**: no schema change. Ticket detail API responses now embed the related session's `stepAttempts` + `categoryName` + `guideVersion` (join by `ticketId`) so escalated/resolved tickets show the guidance history (FR-005, FR-009, SC-003).
- **Message**: assistant messages gain optional `guidance` metadata `{ stepIndex, stepCount }` for the frontend "Step n of m" marker (R8). Absent on all non-guidance messages — additive, backward compatible.
- **enums.ts**: `IssueCategory` static union replaced by runtime category validation against the `categories` collection; `unclassified` remains a hardcoded fallback (R2).

## Relationships

```
SupportCategory 1 ── * TroubleshootingGuide (versions; exactly 1 active)
Conversation    1 ── 0..* GuidedSession (≤ 1 active)
Ticket          1 ── 0..* GuidedSession (new session per re-report)
GuidedSession   * ── 1 TroubleshootingGuide version (pinned: categoryName + guideVersion)
```
