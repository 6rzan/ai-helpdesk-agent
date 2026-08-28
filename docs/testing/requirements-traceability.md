# Requirements Traceability Matrix

Maps every IR §3.4.5 requirement reproduced in `.specify/memory/constitution.md` (lines 149–185)
to the feature specification that owns it, the implementation that satisfies it, and the
automated evidence that verifies it. Supports objective **O-4** (evaluation of the prototype
against the gathered user requirements).

**Suite state at generation**: 420/420 backend tests passing across 76 files, `tsc --noEmit`
clean on both projects, ESLint clean. TC identifiers refer to
[`tc-tables.md`](tc-tables.md); rows there are generated from test names.

**Two limits on this matrix, stated up front:**

1. **TC identifiers cover features 001–003 only.** The suites added by feature 004
   (staff dashboard) and feature 005 (constrained remediation) do not carry `TC-` prefixes
   in their test names, so `tc-tables.md` stops at TC-073 and those suites are absent from
   it. Where a requirement is verified by a 004/005 suite, this matrix cites the test file
   by path instead of a TC number. The evidence exists; the numbering does not reach it.
2. **Rows marked _Partial_ have automated evidence but an outstanding manual artefact**
   (a screenshot, a walkthrough log, or the 24-hour probe). Those are tracked as open task
   IDs in the relevant `specs/*/tasks.md` and are listed in the closing section.

---

## Functional requirements

| ID | Requirement (abridged) | Spec | Implementation | Automated evidence | Status |
|---|---|---|---|---|---|
| **FR-1** | Text or voice input; voice transcribed to text before any analysis | 002-voice-input | `backend/src/services/stt/stt-service.ts`, `backend/src/api/routes/transcriptions.ts`, `frontend/src/components/VoiceControl.tsx` | TC-061–TC-073 (`unit/stt-service.test.ts`, `integration/transcription.test.ts`, `integration/messages-origin.test.ts`); `frontend/tests/components/VoiceControl.test.tsx` | Verified |
| **FR-2** | At least six issue categories as a permanent floor; extensible as data | 001, 003 | `backend/src/services/category/category-service.ts`, `backend/src/models/enums.ts`, `backend/src/scripts/seed-guides.ts` | TC-014, TC-016 (all six categories classify); `unit/enums.test.ts`, `integration/dynamic-category.test.ts`, `integration/admin-guides-api.test.ts` | Verified |
| **FR-3** | Classify each report and auto-create a ticket with timestamps and reporter info | 001 | `backend/src/services/classification/classifier.ts`, `backend/src/services/ticket/ticket-service.ts` | TC-006–TC-016 (`unit/classification.test.ts`, `integration/report-issue.test.ts`); TC-013 covers timestamp, category, description, reporter identity | Verified |
| **FR-4** | Guided step-by-step troubleshooting immediately after categorisation | 003 | `backend/src/services/guidance/` (guidance service, step interpretation, version pinning) | `integration/guided-flow-resolution.test.ts`, `guided-step-order.test.ts`, `guided-categories.test.ts`, `guided-session-resume.test.ts`, `guide-version-pinning.test.ts`, `guidance-guard.test.ts`; `unit/guidance-service.test.ts`, `interpret-step-reply.test.ts` | **Partial** — automated gates green; five manual quickstart walkthroughs outstanding (T047) |
| **FR-5** | Available beyond standard working hours (24/7 in the controlled test environment) | 001 | `backend/src/api/routes/health.ts`, `backend/scripts/availability-probe.ts` | TC-017, TC-018 (health reports `degraded`, still HTTP 200, when the LLM is unreachable); probe smoke-verified 3/3 against the live stack | **Partial** — the 24-hour unattended probe (T049, SC-006) has not been run |
| **FR-6** | Ticket status in plain messages; handling-mode changes reflected without delay | 001, 004 | `backend/src/services/ticket/state-machine.ts`, `backend/src/api/sse/event-bus.ts`, `backend/src/services/ticket/notifications.ts` | TC-019–TC-032 (`unit/state-machine.test.ts`, `integration/status-updates.test.ts`); `integration/staff-events.test.ts`; `frontend/tests/services/useEvents.test.ts`, `components/StatusBadge.test.tsx`, `components/TicketTimeline.test.tsx` | Verified |
| **FR-7** | Escalate on complexity, ambiguity, low confidence, or explicit user preference | 001, 003 | `backend/src/services/escalation/escalation-service.ts`, guidance exhaustion path | TC-037–TC-047 (`unit/escalation.test.ts`, `integration/escalation-flow.test.ts`); `integration/guided-escalation-exhaustion.test.ts`, `guided-escalation-request.test.ts`; `unit/guidance-escalation.test.ts` | Verified |
| **FR-8** | Only predefined remediation, permission-governed, logged, against designated test endpoints | 005 | `backend/src/services/remediation/` (approval, executor, audit, availability), `backend/src/policy/`, `backend/src/services/agent/tools/`, `backend/test-endpoints/` | `integration/remediation-diagnostic.test.ts`, `remediation-state-changing.test.ts`, `remediation-refusal.test.ts`, `remediation-edge-refusals.test.ts`, `remediation-injection.test.ts`, `remediation-no-mutation-path.test.ts`, `remediation-endpoint-failure.test.ts`, `remediation-verification.test.ts`; `unit/policy-engine.test.ts`, `policy-schema.test.ts`, `policy-loader.test.ts`, `executor.test.ts`, `tools-registry.test.ts` | **Partial** — automated gates green; eight Chapter 4 screenshots outstanding (T119) |
| **FR-9** | Web dashboard: tickets, progress, urgent/escalated handling, plus performance metrics | 004, 005, 007 | `backend/src/api/routes/staff-tickets.ts`, `staff-actions.ts`, `staff-users.ts` (007: `PUT /staff/users/:id/profile/fields`, `POST .../fields/:field/release`, `GET .../fields/:field/history`), `staff-accounts.ts` (007: `GET /staff/accounts?q=`), `backend/src/services/profile/profile-field-service.ts`, `field-validation.ts`, `account-directory-service.ts`, `backend/src/models/profile-field-history.ts`, `backend/src/services/metrics/metrics-service.ts`, `frontend/src/pages/` dashboard surfaces (007: `staff/AccountDirectoryPage.tsx`, `components/profile/ProfileField.tsx`, `FieldHistoryDisclosure.tsx`, `SupportDetailsSection.tsx`) | `integration/staff-tickets.test.ts`, `takeover.test.ts`, `metrics.test.ts`, `audit-trail-view.test.ts`, `imports.test.ts`, `profiles.test.ts`; 007: `integration/staff-profile-fields.test.ts`, `profile-field-conflict.test.ts`, `staff-accounts.test.ts`, `unit/profile-field-service.test.ts`, `profile-field-history-model.test.ts`, `support-profile-field-state.test.ts`, `account-directory-service.test.ts`; `frontend/tests/pages/dashboard.test.tsx`, `TicketDetailAssignment.test.tsx`, `components/MetricsBand.test.tsx`, `MetricsSummary.test.tsx`, `ApprovalQueue.test.tsx`, `AuditTrail.test.tsx`; 007: `pages/UserProfilePage.test.tsx`, `ProfilePage.test.tsx`, `AccountDirectoryPage.test.tsx`, `components/ProfileField.test.tsx`, `FieldHistoryDisclosure.test.tsx`, `ProfilePanel.test.tsx`, `lib/profileCopy.test.ts` | Verified |

## Non-functional requirements

| ID | Requirement (abridged) | Implementation | Automated evidence | Status |
|---|---|---|---|---|
| **NFR-1** | Fast responses for common problems; minimise waiting on simple fixes | Local LLM via `openai_compat` provider, guidance served without a model round-trip once a step is pinned | SC-008 latency assertions in `tests/benchmark/classification.bench.test.ts` (TC-025); `docs/testing/benchmark-results.md` | **Partial** — see the TC-025 caveat below |
| **NFR-2** | Plain, jargon-free guidance in logical step order | Guide content in `backend/src/scripts/seed-guides.ts`, ordering enforced by the guidance service | TC-015 (bare greeting gets a conversational reply, no ticket), TC-048–TC-050 (`unit/refusal.test.ts`); `integration/guided-step-order.test.ts`, `refusal.test.ts` | Verified |
| **NFR-3** | Secured, isolated test environment; never touch live or production systems | `backend/test-endpoints/` (two containerised nodes, restricted `sudoers.remediation`, pinned host keys), policy allowlist, no mutation path outside approved scripts | TC-033 (`integration/test-support-guard.test.ts`); `integration/remediation-no-mutation-path.test.ts`, `remediation-injection.test.ts`; `unit/policy-engine.test.ts` | Verified |
| **NFR-4** | Human oversight for critical operations; automation limited to pre-approved functions | Consent block and approval queue, per-action approval TTL, global remediation kill switch | `integration/approval-preconditions.test.ts`, `approval-concurrency.test.ts`, `remediation-toggle.test.ts`, `remediation-disable-during-execution.test.ts`; `unit/approval-service.test.ts`; `frontend/tests/components/ConsentBlock.test.tsx`, `RemediationControls.test.tsx` | **Partial** — kill-switch and consent screenshots outstanding (T119) |
| **NFR-5** | Data minimisation; log access restricted to approved roles | Session auth (`require-auth.ts`), role checks on staff routes, append-only audit records, no credential material in transcripts. 007: the account directory projects **exactly** `id`, `displayName`, `email`, `role` and nothing else, and a field's history is **staff-only** — there is no owner-facing route and no owner-facing affordance for it. Both `/staff/accounts` and `.../fields/:field/history` sit behind `requireAuth` + `requireStaff`, and a refusal answers neither the search term nor the account's existence. `ProfileFieldHistory` and `MaintainerSignInAttempt` are append-only with no update or delete path in any role; no maintainer key is ever written to a log, a document, `localStorage`, a cookie, or a URL (FR-035) | `integration/access-control.test.ts` (007: AC-005–AC-017), `auth.test.ts`, `audit-immutability.test.ts`, `remediation-password-disclosure.test.ts`, `my-tickets.test.ts`, `ticket-profile.test.ts`; `unit/password-service.test.ts`, `audit-service.test.ts`; 007: `integration/staff-accounts.test.ts` (SA-002, SA-003, SA-011, SA-012), `unit/account-directory-service.test.ts` (AD-001, AD-002), `unit/profile-field-history-model.test.ts`, `frontend/tests/pages/ProfilePage.test.tsx` (PP-011), `services/maintainerApi.test.ts` | Verified |
| **NFR-6** | AI handles simple tasks; complex cases route to humans | Confidence threshold gate before classification is accepted; refusal and escalation paths | TC-009, TC-010 (at/below threshold), TC-011, TC-012 (unknown category falls back); `integration/remediation-confidence.test.ts`, `remediation-verification-contradiction.test.ts` | Verified |
| **NFR-7** | Runs on the available hardware (HP Victus 16, Windows 11) with no mandatory external infrastructure | Local MongoDB replica set, local LM Studio / Ollama provider, local STT model, provider chain degrades to `mock` | `unit/config.test.ts`, `llm-base-url.test.ts`, `llm-factory.test.ts`, `chained-provider.test.ts`, `llm-abstraction-boundary.test.ts`; `integration/degradation.test.ts` (TC-016–TC-018), `degraded-model-remediation.test.ts` | Verified |

---

## Caveat on TC-025 (affects NFR-1)

`tests/benchmark/classification.bench.test.ts` is an **opt-in** benchmark. It probes for a
local LLM in `beforeAll`; when none is reachable it logs a warning and returns before making
any assertion, which vitest records as a pass. The filed table therefore shows TC-025 as
*Passed* without the accuracy and latency thresholds having been exercised.

When a local LLM **is** reachable the test takes the real path and fails, because that file
never opens a database connection and `classify()` calls
`listClassificationCategories()`, which queries MongoDB. So the benchmark cannot currently
produce a genuine pass in either condition.

NFR-1 should therefore be read as resting on `docs/testing/benchmark-results.md` rather than
on TC-025, until the benchmark file is given a database fixture.

## Caveat on session resumption (affects FR-4)

`integration/guided-session-resume.test.ts` (GR-001) is cited above for FR-4. It proves that
`GuidedSession.currentStepIndex`, `state`, and `stepAttempts` persist in MongoDB and are read
fresh after the database connection cycles. It does **not** prove that a chat session survives
a process restart: the test rebuilds the Express app but the session store is a module-level
map (`backend/src/services/session/session-service.ts`), so it is shared across `createApp()`
instances and survives the simulated restart.

Actual behaviour after a real restart is that the old `sessionId` is invalid (403
`SESSION_INVALID`) and a new session opens a new conversation, while the ticket and its
guidance record persist. Scenario 5 of the feature-003 quickstart was reworded on 2026-08-25
to assert that behaviour rather than the resumption it previously claimed.

## Outstanding evidence

These rows close when the corresponding manual artefacts are captured. All are tracked tasks.

| Task | Feature | Closes | Nature |
|---|---|---|---|
| T046 | 003 | FR-4 (Chapter 4 chat screenshots: resolution and escalation) | Demo machine |
| T047 | 003 | FR-4 (five manual quickstart walkthroughs) | Demo machine |
| T119 | 005 | FR-8, NFR-4 (eight remediation screenshots incl. kill switch and no-data metrics) | Demo machine |
| T049 | 001 | FR-5 (24-hour unattended availability probe, SC-006) | Overnight, unattended |
| O-4 | — | Perceived-usefulness judgement and UAT with ≥3 testers | Human participants |

The FR/NFR mappings above are complete; what remains is documentation evidence and the
human-participant evaluation, not unbuilt functionality.
