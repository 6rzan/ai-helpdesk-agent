# Quickstart Validation: Guided Troubleshooting

**Feature**: 003-guided-troubleshooting
Proves the feature end-to-end on the demo machine. Contracts: [contracts/api.md](contracts/api.md) · Entities: [data-model.md](data-model.md)

## Prerequisites

- MongoDB running locally; LLM provider reachable (LM Studio/Ollama per `.env`)
- `MAINTAINER_KEY` set in `backend/.env` (see `.env.example`)
- Seeded guides: `npm run seed:guides --workspace backend` (idempotent; six mandated categories)

```powershell
npm run dev --workspace backend    # API + SSE
npm run dev --workspace frontend   # chat UI
```

## Scenario 1 — P1: guided flow to resolution (US1)

1. Open the chat UI, start a conversation, send: `I can't log into my account`.
2. **Expect**: category confirmation + ticket creation, then immediately a message marked "Step 1 of n" with a plain-language instruction (SC-001), plus quick-reply chips.
3. Reply `Didn't work` → **expect** Step 2, no repeated or skipped steps.
4. Reply `That worked` → **expect** resolution confirmation; ticket status flips to `resolved` in the UI without refresh (FR-006).
5. `GET /api/tickets/:id` → **expect** `guidance.stepAttempts` listing both attempts with outcomes (FR-005).

## Scenario 2 — P2: exhaustion & user-requested escalation (US2)

1. New conversation, report a login issue, reply `didn't work` to every step until the guide is exhausted.
2. **Expect**: plain-language escalation notice; ticket escalated; `guidance.state = "escalated"`; every step present in `stepAttempts` (SC-003).
3. Separately: mid-guide, send `just get me a person` → **expect** immediate escalation with the partial record (FR-008).

## Scenario 3 — P3: all categories + wrong-guide guard (US3)

1. Report one representative issue per remaining category (network, printer, peripherals, performance, service status) → **expect** each gets its own category's steps (SC-004).
2. Send a vague report (`things are weird today`) → **expect** clarifying question / escalation, never steps from an unrelated guide (FR-012).

## Scenario 4 — P3: management API (US4)

```powershell
$h = @{ 'x-maintainer-key' = $env:MAINTAINER_KEY; 'x-maintainer-name' = 'taha' }

# add category + guide (FR-014)
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/admin/categories -Headers $h -ContentType 'application/json' -Body (@{
  name='email_calendar'; displayName='Email & calendar'
  classificationDescription='Email or calendar not sending, receiving, or syncing for this user'
  guide=@{ steps=@(@{instruction='Sign out of the mail app and sign back in.'; successHint='New mail arrives.'}) }
} | ConvertTo-Json -Depth 5)
```

1. New conversation: `my emails are not sending` → **expect** classification into `email_calendar` + its step (US4-1, SC-007).
2. Publish a new guide version for `password_login` (`POST .../guide`), then start a new conversation → **expect** updated wording; a conversation opened *before* the edit continues on its pinned version (FR-017).
3. `POST /api/admin/categories` with empty `steps` → **expect** 422, previous content untouched (FR-015).
4. `DELETE /api/admin/categories/password_login` → **expect** 403 (FR-018).
5. Wrong/missing `x-maintainer-key` → **expect** 401.
6. `GET .../guide/versions` → **expect** history with `changedBy`/`changedAt` (SC-008).

## Scenario 5 — resumption (FR-011, SC-006)

1. Start a guided session, reply to step 1, then restart the backend process.
2. Reopen the conversation and reply → **expect** guidance continues at the correct step (session state from MongoDB, not memory).

## Automated gates

```powershell
npm run typecheck --workspace backend; npm run lint --workspace backend
npm test --workspace backend        # incl. classification regression set (R2) + guardrail tests
npm test --workspace frontend       # ChatPage + VoiceControl regressions stay green
```

All five scenarios plus the automated gates passing = feature demo-ready (Principle IV release gate).
