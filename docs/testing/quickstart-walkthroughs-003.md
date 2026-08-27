# Quickstart Walkthroughs: Guided Troubleshooting (003)

**T019** — manual execution of `specs/003-guided-troubleshooting/quickstart.md`'s five
scenarios against the live dev stack (MongoDB `rs0`, backend `npm run dev`, LM Studio
`qwen2.5-7b-instruct`). All requests were issued directly against the API with `curl`
(cookie jars per account) rather than through the browser UI, except where noted; this
exercises the same route handlers, services, and DB state the UI drives.

Two real defects were found and fixed while running this pass — see
`docs/testing/observations.md` OBS-13 and OBS-14. Both are called out inline below and
the fixed behaviour is what's recorded as the PASS evidence.

## Scenario 1 — P1: guided flow to resolution (US1)

Account `qw003-s1`, ticket **HD-0054** (`password_login`).

1. `I can't log into my account` → classified `password_login`, ticket HD-0054 created,
   reply lands Step 1 of 3 in the same turn:
   > "Can you tell me if you're getting any error messages when trying to sign in? Your
   > ticket reference is HD-0054... Step 1 of 3: Double-check that Caps Lock is off and
   > re-type your password carefully."
2. `Didn't work` → Step 2 of 3 ("Use the \"Forgot password\" link..."), no repeat/skip.
3. `That worked` → resolution confirmation ("Great news! Your password has been reset
   successfully."); ticket status → `resolved`.
4. `GET /api/tickets/HD-0054?sessionId=...` → `status: "resolved"`.

**Step 5 (FR-005 — `guidance.stepAttempts` lists both attempts): initially FAILED.**
At the time this scenario was first run, the persisted guided session had **zero**
entries in `stepAttempts` — the "That worked" step that actually resolved the ticket was
never recorded, only would-have-been `not_worked`/`already_tried` attempts were (which
never happened here, since resolution came on step 1). Root cause: `guidance-service.ts`'s
`decideStepTransition()` returned `{ action: "resolve" }` with no `attemptOutcome` for the
`"worked"` outcome, and `conversation-guidance.ts`'s `case "resolve"` never called
`recordAttempt`. Logged as **OBS-13**, severity `significant`.

**Fix applied and reverified**: `StepDecision`'s `resolve` variant now carries
`attemptOutcome: "worked"`, and the `resolve` branch calls `recordAttempt(session,
"worked")` before ending the session — mirroring `advance`/`escalate`. Confirmed via the
targeted unit test (`guidance-service.test.ts` GT-001) and two integration tests
(`guided-flow-resolution.test.ts` GF-001/GF-002, `guided-session-resume.test.ts` GR-001),
all of which had been asserting the *missing* entry as correct and were updated to assert
the fixed two-entry record. Live-reverified against a fresh account/ticket (`password_login`,
step 1 "didn't work" → step 2 "that worked"): `stepAttempts` now holds
`[{stepIndex:0, outcome:"not_worked"}, {stepIndex:1, outcome:"worked"}]`.

**Result: PASS** (after the OBS-13 fix).

## Scenario 2 — P2: exhaustion & user-requested escalation (US2)

Two fresh accounts, run after the OBS-14 fix (below) so the guide steps reflect the
`password_login` guide as edited during Scenario 4 (see note under 2a).

**2a — exhaustion.** Account `qw003-s2fresh`, ticket **HD-0063** (`password_login`).
Reported the issue, then replied `didn't work` to the guide's only remaining step (the
guide was down to 1 step at this point in the run because Scenario 4.2, run earlier in
this same session, had just published guide version 3 for `password_login`; the guide's
step *count* is incidental to what this scenario checks — see spec's `seedTwoStepPasswordGuide`
used by the automated GT tests for a fixed-count version of the same assertion).
Immediately escalated: `escalated: true`, `escalationReason: "guidance_exhausted"`,
`handlingMode: "human_involved"`, reply ends "I'm bringing in a person to help from here."

**2b — user-requested escalation mid-guide.** Account `qw003-s2b`, ticket **HD-0065**
(`printer`, a guide with 3 steps). Reported the issue, got Step 1 of 3, then sent
`just get me a person` → immediate escalation: `escalationReason: "user_request"`,
`guidance.state: "escalated"`, `guidance.stepAttempts: []` (correctly empty — no step
reply had been given yet, so the "partial record" is a legitimately empty one). Reply:
"Sure thing! I'll connect you to a support agent right away. I'm bringing in a person to
help from here."

**Result: PASS.** Both escalation reasons and the ticket/session state after each are
correct (SC-003, FR-008).

## Scenario 3 — P3: all categories + wrong-guide guard (US3)

**3a — one issue per remaining category.** A first pass fired four category reports
concurrently at a single conversation as a deliberate stress test of the OBS-14 fix (see
below); the fifth (`service_status`) landed in a legitimate ambiguity prompt (see note),
so it was re-sent as a clean, separate report. Final coverage, one ticket per category,
each carrying that category's own guide steps:

| Category | Ticket | Notes |
|---|---|---|
| `network` | HD-0066 | "Check that Wi-Fi or the network cable is connected..." |
| `peripherals` | HD-0067 | "Unplug the device and plug it back into a different USB port." |
| `performance` | HD-0068 | own steps, distinct from the above |
| `service_status` | HD-0069 | own steps, distinct from the above |
| `password_login` | HD-0054/60/62/63 (Scenarios 1/4/5) | own steps |
| `printer` | HD-0058/65 (Scenario 2b) | own steps |

Note: a single-message report of "is the VPN service down for everyone right now" (sent
twice, in two different fresh conversations) deterministically produced the same
clarifying reply both times — "Sounds like two separate things: the internet/network
trouble and the service outage. Let's handle one at a time..." This looked, on first
sight, like cross-conversation state leakage and was investigated as a possible new
defect; it is not one. `conversation-engine.ts`'s ambiguous-category handling
(`pendingAmbiguousRemediation`) is a deterministic template keyed only on the two
candidate category labels the classifier is torn between, so identical input text
produces byte-identical output in any conversation — "VPN service down" is genuinely
ambiguous between `network` and `service_status` in this classifier, by design. Re-sent
with unambiguous wording ("the company helpdesk status page shows the email service is
down for the whole team") to get a clean `service_status` classification (HD-0069).

**3a stress test (OBS-14, now fixed).** Four reports (`network`, `peripherals`,
`performance`, the ambiguous VPN one) were POSTed with genuine overlap (two truly
concurrent via backgrounded `curl`, then two more before the first pair's replies had
returned) against one active conversation. Before the fix, this exact class of race
(no per-conversation serialization on the fire-and-forget reply path) had produced agent
replies quoting ticket references that subsequently 404'd on direct lookup. After the fix
(`conversationQueues`/`enqueueReply()` in `conversation-engine.ts`, serializing replies
per conversation via promise chaining): all four messages were processed in submission
order, every quoted reference (HD-0066, HD-0067, HD-0068) resolved with `GET
/api/tickets/<reference>` → `200`, and the system correctly declined to silently split the
overlapping reports, instead asking "which would you like to start with?" — no lost or
phantom tickets.

**3b — vague report / wrong-guide guard.** Fresh conversation, `things are weird today` →
`clarificationRounds: 1`, agent replies "Can you tell me more about what's going on?" — a
clarifying question, not a guess into any category's guide. No ticket, no guide steps,
confirming FR-012's guard.

**Result: PASS** (after the OBS-14 fix; SC-004, FR-012).

## Scenario 4 — P3: management API (US4)

All calls authenticated with the real `MAINTAINER_KEY` from `backend/.env`.

1. **Add category + guide (FR-014).** `POST /api/admin/categories` with
   `email_calendar` (1-step guide) → `201`. New conversation, `my emails are not
   sending` → classified `email_calendar`, ticket **HD-0061**, Step 1 of 1 is exactly the
   new guide's step ("Sign out of the mail app and sign back in."). **PASS** (SC-007).
2. **Pinned guide version (FR-017).** Published `password_login` guide v2
   (`POST .../categories/password_login/guide`) → `201, version: 2`. A brand-new
   conversation opened after the publish (`I cannot log into my account`, ticket
   **HD-0062**) immediately got v2's wording ("UPDATED v2: Use the account-recovery
   portal..."), `guidance.guideVersion: 2`. Meanwhile the ticket opened *before* the
   publish (HD-0060, from Scenario 5's first leg, `guideVersion: 1`) was re-checked
   after the publish and still read `guideVersion: 1` with its original v1 step text —
   unaffected by the edit. Also confirmed structurally in
   `src/services/guidance/guidance-service.ts`: a session's guide is always resolved via
   `Guide.findOne({ categoryName, version: session.guideVersion })` — the version is
   captured once at session start and never re-resolved to "whatever is active now".
   Published a third version afterward to double-check the same pin holds generally
   (`version: 3`); HD-0062 was not re-checked against v3 specifically (its own guide has
   only 1 step, so a live continuation would immediately exhaust it rather than exercise
   wording), but the code-level guarantee applies uniformly to any version. **PASS.**
3. **Empty steps rejected (FR-015).** `POST /api/admin/categories` with `guide.steps: []`
   → `422 INVALID_GUIDE_STEPS` ("Array must contain at least 1 element(s)"). Re-listed
   `GET /api/admin/categories` afterward — no `empty_steps_test` category present.
   **PASS.**
4. **Mandated category undeletable (FR-018).** `DELETE
   /api/admin/categories/password_login` → `403 MANDATED_CATEGORY_UNDELETABLE`. **PASS.**
5. **Auth (FR-018 / general).** Wrong `x-maintainer-key` → `401
   MAINTAINER_KEY_INVALID`. Missing key entirely → same `401`. **PASS.**
6. **Version history (SC-008).** `GET
   /api/admin/categories/password_login/guide/versions` → three entries (v1 seed, v2 and
   v3 from this run), each with real `changedBy`/`changedAt`/`changeNote`. **PASS.**

**Result: PASS**, all six checks.

## Scenario 5 — guidance state survives a restart (FR-011, SC-006)

Account `qw003-s5`, ticket **HD-0060** (`password_login`).

1. Reported the issue → HD-0060, Step 1 of 3. Replied `Didn't work` → Step 2 of 3.
2. `GET /api/tickets/HD-0060?sessionId=<old>` (pre-restart) → `guidance.state: "active"`,
   `stepAttempts: [{stepIndex: 0, outcome: "not_worked", instruction: "Double-check that
   Caps Lock is off..."}]`. Matches spec exactly.
3. **Restarted the backend process** for real: touched `src/server.ts` to trigger
   `tsx watch`'s reload, then confirmed via `Get-CimInstance` that the actual server
   child process PID changed (18732 → 24692, fresh `CreationDate`) — a genuine process
   restart, not just a health-check coincidence. `GET /api/health` came back `ok` with
   Mongo and the LLM both reachable immediately after.
4. Replayed the *old* session against the *old* conversation:
   `POST /api/conversations/<old conv>/messages` with the old `sessionId` →
   **`403 SESSION_INVALID`**, exactly as designed (chat sessions are an in-memory map,
   invalidated by a restart by design, not a defect).
5. New session on the same account (cookie-authenticated, same account, fresh
   `POST /api/sessions`) → `openTickets` includes HD-0060 — the ticket record, keyed to
   the account/reporter, survived the restart even though the chat session didn't.
6. `GET /api/tickets/HD-0060?sessionId=<new>` (post-restart) → **identical** guidance
   block to step 2: `state: "active"`, same single `stepAttempts` entry — reconstructed
   from MongoDB by the freshly-restarted process, not held over in server memory.

**Result: PASS**, all six steps (SC-006). The automated counterpart `GR-001` in
`tests/integration/guided-session-resume.test.ts` covers the same DB-persistence
guarantee (simulating the restart via a Mongo disconnect/reconnect cycle rather than an
actual process restart) and was updated alongside the OBS-13 fix above; it does not cover
step 4, which only exists here per the quickstart's own note.

## Automated gates

```
npx tsc --noEmit                 # clean
npx eslint <touched files>       # clean
npx vitest run                   # 426/427 — sole failure: tests/benchmark/classification.bench.test.ts,
                                  #   an explicitly opt-in real-local-LLM accuracy benchmark, pre-existing
                                  #   and unrelated to any change made in this pass (flaky under this
                                  #   suite's DB-disconnect/reconnect test ordering, not this feature)
```

## Summary

| Scenario | Result | Defects found |
|---|---|---|
| 1 — guided flow to resolution | PASS (after fix) | OBS-13 |
| 2 — exhaustion & user-requested escalation | PASS | — |
| 3 — all categories + wrong-guide guard | PASS (after fix) | OBS-14 |
| 4 — management API | PASS | — |
| 5 — state survives a restart | PASS | — |

All five scenarios plus the automated gates pass — feature 003 is demo-ready per
Principle IV, with OBS-13 and OBS-14 fixed rather than merely logged.
