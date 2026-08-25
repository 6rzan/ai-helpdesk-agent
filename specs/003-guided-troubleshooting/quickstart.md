# Quickstart Validation: Guided Troubleshooting

**Feature**: 003-guided-troubleshooting
Proves the feature end-to-end on the demo machine. Contracts: [contracts/api.md](contracts/api.md) · Entities: [data-model.md](data-model.md)

## Prerequisites

- MongoDB running locally; LLM provider reachable (LM Studio/Ollama per `.env`)
- `MAINTAINER_KEY` set in `backend/.env` (see `.env.example`) — without it the whole
  `/api/admin` router is *absent*, so Scenario 4 returns 404 rather than 401
- Seeded guides: `npm --prefix backend run seed:guides` (idempotent; six mandated categories)
- **A signed-in account.** Since feature 005 wired consent session auth, `POST /api/sessions`
  returns 401 `UNAUTHENTICATED` without a session cookie, and the chat UI only starts a
  session once an account is present. Register or sign in before Scenarios 1–3, 5.

> There is no root `package.json`; run every npm command with `--prefix`, as the
> feature-005 quickstart does. The `npm run … --workspace <pkg>` form used by earlier
> drafts of this file fails here.

```powershell
npm --prefix backend run dev     # API + SSE
npm --prefix frontend run dev    # chat UI
```

## Scenario 1 — P1: guided flow to resolution (US1)

1. Open the chat UI, start a conversation, send: `I can't log into my account`.
2. **Expect**: category confirmation + ticket creation, then immediately a message marked "Step 1 of n" with a plain-language instruction (SC-001), plus quick-reply chips.
3. Reply `Didn't work` → **expect** Step 2, no repeated or skipped steps.
4. Reply `That worked` → **expect** resolution confirmation; ticket status flips to `resolved` in the UI without refresh (FR-006).
5. `GET /api/tickets/<reference>?sessionId=<sessionId>` → **expect** `guidance.stepAttempts` listing both attempts with outcomes (FR-005). The route keys on the ticket **reference**, not its id, and the `sessionId` query parameter is mandatory — omitting it is a 400, and the ticket must belong to that session's reporter.

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

## Scenario 5 — guidance state survives a restart (FR-011, SC-006)

**What this proves**: guided-session progress lives in MongoDB and is read fresh after a
restart, not held in server memory.

**What it deliberately does not claim**: that a *chat session* survives a restart. Chat
sessions are held in a module-level map in
`backend/src/services/session/session-service.ts`, so restarting the process invalidates
them by design — there is no reopen-this-conversation endpoint, and a new session always
opens a new conversation. Step 4 below asserts that invalidation rather than glossing it.

1. Signed in, start a guided session for a login issue and reply `Didn't work` to step 1
   → **expect** `Step 2 of n`. Keep the `sessionId`, `conversationId`, and ticket reference.
2. `GET /api/tickets/<reference>?sessionId=<sessionId>` → **expect** `guidance.state` is
   `"active"` and `guidance.stepAttempts` holds one entry with `stepIndex: 0`, its outcome,
   and the step-1 `instruction` text.
3. Restart the backend process (`Ctrl-C`, then `npm --prefix backend run dev`).
4. Replay the *old* session: `POST /api/conversations/<conversationId>/messages` with the
   old `sessionId` → **expect** 403 `SESSION_INVALID`. This is the designed behaviour, not
   a defect.
5. Reload the chat UI → **expect** a new session on a new conversation, with the ticket from
   step 1 still listed among the open tickets (the reporter record is keyed to the account,
   so it is stable across sessions).
6. `GET /api/tickets/<reference>?sessionId=<newSessionId>` → **expect** the `guidance` block
   identical to step 2, reconstructed from MongoDB after the restart (SC-006).

Automated counterpart: `tests/integration/guided-session-resume.test.ts` (GR-001), which
asserts `currentStepIndex`, `state`, and `stepAttempts` persist across a database
connection cycle. Note that GR-001 rebuilds the Express app but *not* the module-level
session store, so it does not exercise step 4; that assertion exists only here.

## Automated gates

```powershell
npm --prefix backend run typecheck; npm --prefix backend run lint
npm --prefix backend test        # incl. classification regression set (R2) + guardrail tests
npm --prefix frontend test       # ChatPage + VoiceControl regressions stay green
```

All five scenarios plus the automated gates passing = feature demo-ready (Principle IV release gate).
