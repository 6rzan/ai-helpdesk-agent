# API Contracts: Guided Troubleshooting

**Feature**: 003-guided-troubleshooting | **Date**: 2026-07-12
Extends the foundation API (`specs/001-conversational-ticketing-foundation/contracts/api.md`). All request bodies zod-validated; errors use the existing error envelope.

## Conversation flow (behavioural contract — no new user-facing endpoints)

Guidance rides the existing endpoints and SSE stream:

### `POST /api/conversations/:conversationId/messages` (existing)

Behavioural additions:

1. **After classification into a supported category** (confidence above the existing threshold): the assistant reply that confirms the category and ticket is followed in the same stream by the first guide step. Assistant guidance messages carry additive metadata:

```jsonc
// message event payload (existing shape + optional field)
{
  "id": "...", "author": "agent", "content": "Step 1 of 4: ...",
  "guidance": { "stepIndex": 0, "stepCount": 4 }   // present only on step messages
}
```

2. **While a guided session is active**, each user message is interpreted against the current step (research R4) and produces exactly one of: next step message, resolution confirmation (ticket → `resolved`), escalation notice (ticket escalates, session `escalated`), an answer to a question about the current step, or a clarifying question. Ticket status changes publish on the existing SSE ticket events unchanged (FR-006).

3. **Low classification confidence / unknown category / missing-invalid guide**: no session starts; existing escalation behaviour applies (FR-012).

### `GET /api/tickets/:id` (existing — response extended)

```jsonc
{
  // ...existing ticket fields...
  "guidance": {                       // present when a guided session exists for this ticket
    "categoryName": "password_login",
    "guideVersion": 3,
    "state": "escalated",             // active | resolved | escalated | abandoned
    "stepAttempts": [
      { "stepIndex": 0, "outcome": "not_worked", "at": "2026-07-12T09:14:03Z",
        "instruction": "..." }        // instruction resolved from the pinned guide version
    ]
  }
}
```

## Maintainer management API (new — credential-guarded, no UI)

All routes require headers `x-maintainer-key: <MAINTAINER_KEY>` (timing-safe compare; 401 on mismatch or when unset) and `x-maintainer-name: <non-empty>` (400 if missing). Mounted under `/api/admin`.

### `GET /api/admin/categories`
List categories (mandated + custom, incl. `retired`), each with its active guide version number.

### `POST /api/admin/categories` — add category + initial guide (FR-014, FR-015)

```jsonc
// request
{
  "name": "email_calendar",                    // unique slug, immutable
  "displayName": "Email & calendar",
  "classificationDescription": "Problems sending/receiving email, ...",
  "guide": { "steps": [ { "instruction": "...", "successHint": "..." } ],
             "changeNote": "initial guide" }
}
// 201 → category + guide v1 (active)
// 409 duplicate name · 422 invalid (empty steps, length bounds) — previous content unaffected
```

### `PUT /api/admin/categories/:name` — edit category metadata
`displayName` / `classificationDescription` only (`name`, `mandated` immutable). 200 with change recorded.

### `DELETE /api/admin/categories/:name`
Soft-retire a **non-mandated** category. `403 MANDATED_CATEGORY_UNDELETABLE` for the seeded six (FR-018).

### `POST /api/admin/categories/:name/guide` — publish new guide version (FR-014, FR-016, FR-017)

```jsonc
// request
{ "steps": [ { "instruction": "...", "successHint": "..." } ], "changeNote": "reworded step 2" }
// 201 → { "version": 4, "active": true }   (previous version deactivated atomically;
//        in-flight sessions keep their pinned version)
// 422 invalid steps — previous version stays active
```

### `GET /api/admin/categories/:name/guide/versions`
Full version history: `version`, `changedBy`, `changedAt`, `changeNote`, `active`, `steps` (FR-016, SC-008).

## Environment

| Variable | Purpose |
|---|---|
| `MAINTAINER_KEY` | Enables + guards `/api/admin/*`; routes return 401/absent when unset. Documented in `.env.example`; never committed. |
