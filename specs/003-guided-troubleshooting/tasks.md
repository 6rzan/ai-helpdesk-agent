# Tasks: Guided Troubleshooting

**Input**: Design documents from `/specs/003-guided-troubleshooting/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: REQUIRED for every feature (Constitution Principle IV). Escalation-affecting logic (session termination, exhaustion, wants-human) is safety-critical and MUST be test-first: its test tasks precede implementation tasks and must fail before implementation. Prompt-module tasks include refreshing the classification and guardrail regression tests (Principle VIII). Test names map to the FYP Chapter 5 TC-table format.

**Organization**: Tasks are grouped by user story so each story is independently implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md; Setup/Foundational/Polish tasks carry no story label

## Path Conventions

Web application layout per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup

**Purpose**: Environment and script plumbing for the feature (project already exists — no scaffolding needed)

- [X] T001 Document `MAINTAINER_KEY` in backend/.env.example (purpose, admin routes disabled when unset) and add `seed:guides` npm script pointing at src/scripts/seed-guides.ts in backend/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prompt-module extraction (Principle VIII precondition), data models, seed data, and data-driven classification that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create shared prompt core module (identity/persona layer + safety layer; user content always delimited as data) in backend/src/services/llm/prompts/core.ts
- [X] T003 Create classification prompt module with data-driven category list (name + classificationDescription + confidence rules; `unclassified` hardcoded fallback) branching from core, in backend/src/services/llm/prompts/classification.ts
- [X] T004 [P] Refactor backend/src/services/llm/ollama-provider.ts to consume prompt modules and delete its inline `CLASSIFICATION_SYSTEM_PROMPT` / `CHAT_SYSTEM_PROMPT` literals
- [X] T005 [P] Refactor backend/src/services/llm/openai-compat-provider.ts to consume prompt modules and delete its duplicated inline prompt literals
- [X] T006 Refresh classification + guardrail regression tests so they pass against the extracted prompt modules (Principle VIII gate) in backend/tests (existing regression test files)
- [X] T007 [P] Create SupportCategory Mongoose model (unique slug name, displayName, classificationDescription, mandated, retired, createdBy/createdAt; mandated blocks retire/delete) in backend/src/models/category.ts
- [X] T008 [P] Create versioned TroubleshootingGuide Mongoose model (categoryName, monotonic version, GuideStep[] 1–20 with instruction/successHint bounds, exactly-one-active constraint, changedBy/changedAt/changeNote; `(categoryName, version)` unique index) in backend/src/models/guide.ts
- [X] T009 [P] Create GuidedSession + embedded StepAttempt Mongoose model (conversationId, ticketId, categoryName, pinned guideVersion, currentStepIndex, append-only stepAttempts, state enum active/resolved/escalated/abandoned; partial unique index: one active session per conversation) in backend/src/models/guided-session.ts
- [X] T010 Replace the static `IssueCategory` union with runtime validation against the categories collection (keep `unclassified` as hardcoded fallback) in backend/src/models/enums.ts
- [X] T011 Create idempotent seed script inserting the six IR-mandated categories (mandated: true) with an initial password/login guide v1 — upsert by category name, never overwrite newer versions — in backend/src/scripts/seed-guides.ts
- [X] T012 Modify backend/src/services/classification/classifier.ts to assemble the classification prompt from the categories collection at runtime and validate LLM output against the live category set (unknown → `unclassified` → existing low-confidence escalation path)
- [X] T013 Run the existing classification regression set against the seeded six categories and fix any regressions (gate for R2 dynamic-category change) in backend/tests (existing classification regression file)

**Checkpoint**: Prompt modules extracted, models + seed in place, classification data-driven — user story implementation can begin

---

## Phase 3: User Story 1 - Step-by-step guidance for password/login issues (Priority: P1) 🎯 MVP

**Goal**: Immediately after a password/login issue is classified and its ticket created, the assistant walks the user through the curated guide one step at a time, records each outcome, and resolves the ticket on success.

**Independent Test**: Report a login problem in chat; first troubleshooting step appears in the assistant's very next reply (SC-001); reply "didn't work" → next step; reply "that worked" → resolution confirmed, ticket resolved, stepAttempts visible on the ticket (quickstart Scenario 1).

### Tests for User Story 1 (REQUIRED - Constitution Principle IV) ⚠️

- [X] T014 [P] [US1] Unit tests (TC-named) for the guidance state machine transitions: worked→resolved, not_worked→advance, already_tried→record+advance, question→hold on current step, unclear/low-confidence→clarify never guess (FR-013); plus an advisory-only guard test asserting guidance-service imports no executor/command modules and every transition output is text-only (FR-010), in backend/tests/unit/guidance-service.test.ts
- [X] T015 [P] [US1] Unit test for `interpretStepReply` zod schema: valid strict-JSON accepted; malformed/extra-field/invalid-enum LLM output rejected and mapped to the clarify path, in backend/tests/unit/interpret-step-reply.test.ts
- [X] T016 [P] [US1] Integration test (supertest): "I can't log into my account" → classification + ticket + Step 1 message with guidance metadata in same reply flow (SC-001) → "didn't work" → Step 2 → "that worked" → ticket resolved (FR-006) and GET /api/tickets/:id shows both stepAttempts (FR-005); then re-report the same problem → a fresh guided session starts on a new ticket while the prior attempt record stays visible in history (spec edge case), in backend/tests/integration/guided-flow-resolution.test.ts
- [X] T017 [P] [US1] Integration test: guided session resumes at correct step after service restart / conversation reopen — state loaded from MongoDB, not memory (FR-011, SC-006), in backend/tests/integration/guided-session-resume.test.ts

### Implementation for User Story 1

- [X] T018 [US1] Create guidance prompt module with two mode variants branching from core: step presentation (canonical stored instruction included verbatim, plain language) and step-reply interpretation (strict-JSON output contract), in backend/src/services/llm/prompts/guidance.ts
- [X] T019 [US1] Add `interpretStepReply` capability to the provider interface with zod-validated output `{ outcome: worked|not_worked|already_tried|question|wants_human|unclear, confidence, reply }` in backend/src/services/llm/types.ts
- [X] T020 [P] [US1] Implement `interpretStepReply` in backend/src/services/llm/ollama-provider.ts (strict-JSON + zod, mirroring the existing classify pattern)
- [X] T021 [P] [US1] Implement `interpretStepReply` in backend/src/services/llm/openai-compat-provider.ts
- [X] T022 [US1] Implement the deterministic step state machine in backend/src/services/guidance/guidance-service.ts: start session pinned to the active guide version (FR-017), present step from stored guide only (FR-004), record StepAttempt per outcome (FR-005), transitions per data-model.md — resolve, advance, hold-on-question, clarify; no LLM decides transitions
- [X] T023 [US1] Wire the guidance stage into processReply in backend/src/services/conversation/conversation-service.ts: start guidance immediately after classification into a supported category + ticket creation (FR-001); route user replies through interpretation while a session is active; on resolved, flip ticket status and publish on existing SSE ticket events (FR-006)
- [X] T024 [US1] Extend the ticket detail response with the `guidance` block (categoryName, guideVersion, state, stepAttempts with instruction text resolved from the pinned guide version) per contracts/api.md, in the existing ticket detail route/service under backend/src/api/routes/
- [X] T025 [US1] Add optional `guidance: { stepIndex, stepCount }` metadata to assistant step messages in the message emit path (backend) and mirror the type in frontend/src/lib/types.ts and frontend/src/services/api.ts (types only)
- [X] T026 [P] [US1] Create QuickReplies component ("That worked" / "Didn't work" / "Talk to a human" chips that send plain text as normal user messages; WCAG AA contrast both themes; `scale-[0.98]` press state; `prefers-reduced-motion` honored; no emoji icons) in frontend/src/components/QuickReplies.tsx
- [X] T027 [US1] Render "Step n of m" marker on guidance messages and mount QuickReplies under the newest step in frontend/src/pages/ChatPage.tsx (minimal change — shared with voice flow)
- [X] T028 [US1] Frontend tests: QuickReplies renders/sends plain text, ChatPage renders step marker; existing ChatPage + VoiceControl regression tests stay green, in frontend/tests/

**Checkpoint**: Full password/login guided flow to resolution works end-to-end — demonstrable MVP

---

## Phase 4: User Story 2 - Escalation with attempted-steps context (Priority: P2)

**Goal**: Guided sessions terminate safely: exhausted guides and "get me a human" requests escalate the ticket carrying the full attempted-steps record so users never repeat themselves.

**Independent Test**: Reply "didn't work" to every password/login step until exhaustion → ticket escalates with complete attempted-steps record (SC-003); separately send "just get me a person" mid-guide → immediate escalation with partial record (quickstart Scenario 2).

### Tests for User Story 2 (SAFETY-CRITICAL — test-first, MUST fail before implementation) ⚠️

- [X] T029 [P] [US2] Unit tests (TC-named, written first, failing) for escalation transitions: last step not_worked + no further steps → escalated (FR-007); wants_human at any step → escalated with partial record (FR-008); new different problem mid-guide → abandoned recorded (spec edge case), in backend/tests/unit/guidance-escalation.test.ts
- [X] T030 [P] [US2] Integration test: exhaust all guide steps → plain-language escalation notice, ticket escalated, session state `escalated`, every step present in stepAttempts (SC-003), in backend/tests/integration/guided-escalation-exhaustion.test.ts
- [X] T031 [P] [US2] Integration test: "just get me a person" mid-guide → guidance stops immediately, ticket escalates with partial attempted-steps record, and GET /api/tickets/:id shows guidance history alongside conversation context (FR-009), in backend/tests/integration/guided-escalation-request.test.ts

### Implementation for User Story 2

- [X] T032 [US2] Implement exhaustion, wants_human, and abandonment transitions in backend/src/services/guidance/guidance-service.ts, escalating via the existing escalation service with the session's attempted-steps record attached; terminal states never transition
- [X] T033 [US2] Emit the plain-language escalation notice and carry guidance history through the handover in backend/src/services/conversation/conversation-service.ts; escalated ticket status publishes on existing SSE events unchanged

**Checkpoint**: Guided sessions always terminate safely — resolution (US1) or context-carrying escalation (US2)

---

## Phase 5: User Story 3 - Guided flows for the remaining categories (Priority: P3)

**Goal**: Network, printer, peripherals, slow performance, and service status issues each get their own curated guide through the same mechanism; wrong-guide delivery is impossible.

**Independent Test**: Report one representative issue per remaining category and step each guide to both resolved and escalated outcomes; a vague report gets clarification/escalation, never another category's steps (quickstart Scenario 3).

### Tests for User Story 3 (REQUIRED - Constitution Principle IV) ⚠️

- [X] T034 [P] [US3] Integration test (test-first): low-confidence classification, unknown category, or missing/invalid guide → escalate, never present steps from an unrelated guide (FR-012), in backend/tests/integration/guidance-guard.test.ts
- [X] T035 [P] [US3] Per-category integration tests: representative report per remaining category receives its own category's steps and no other's (SC-004), covering resolved and escalated endings, in backend/tests/integration/guided-categories.test.ts

### Implementation for User Story 3

- [X] T036 [US3] Implement the missing/invalid-guide guard in backend/src/services/guidance/guidance-service.ts: no session starts when the classified category has no valid active guide; existing escalation behaviour applies (FR-012)
- [X] T037 [US3] Author plain-language guides (steps + successHints, generic fictional-org IT references) for network connectivity, printer, peripheral devices, slow performance, and service status in backend/src/scripts/seed-guides.ts
- [X] T038 [US3] Extend the classification regression set with representative phrasings for all six categories and confirm it passes, in backend/tests (existing classification regression file)

**Checkpoint**: All six IR-mandated categories deliver correct guided flows

---

## Phase 6: User Story 4 - Add and edit categories and their guides (Priority: P3)

**Goal**: A credentialed maintainer adds new categories with guides or publishes new guide versions via the management API — no code change; every change audited; mandated six undeletable; in-flight sessions keep their pinned version.

**Independent Test**: POST a new "email_calendar" category with a guide, report a matching issue in a fresh conversation → classified into it with its steps; publish a new password/login guide version → new sessions get new wording, an in-progress session finishes on its pinned version (quickstart Scenario 4).

### Tests for User Story 4 (REQUIRED - Constitution Principle IV) ⚠️

- [X] T039 [P] [US4] Contract tests (test-first) for the admin API per contracts/api.md: 401 wrong/missing `x-maintainer-key` (and routes absent when `MAINTAINER_KEY` unset); 400 missing `x-maintainer-name`; POST /api/admin/categories 201 / 409 duplicate / 422 empty-steps with previous content untouched (FR-015); PUT metadata-only edit; DELETE 403 `MANDATED_CATEGORY_UNDELETABLE` for the seeded six (FR-018) and soft-retire for custom categories; POST .../guide 201 new active version; GET .../guide/versions full history with changedBy/changedAt (FR-016, SC-008), in backend/tests/integration/admin-guides-api.test.ts
- [X] T040 [P] [US4] Integration test: publish guide version n+1 while a session runs on version n → in-flight session completes on pinned version, new session uses n+1, ticket records match the exact version used (FR-017, SC-008), in backend/tests/integration/guide-version-pinning.test.ts
- [X] T041 [P] [US4] Integration test: add new category via API → fresh conversation reporting a matching issue is classified into it and receives its guide's steps, and the mandated-six classification regression still passes (SC-007), in backend/tests/integration/dynamic-category.test.ts

### Implementation for User Story 4

- [X] T042 [US4] Implement maintainer auth middleware: timing-safe `MAINTAINER_KEY` compare on `x-maintainer-key` (401 mismatch), required non-empty `x-maintainer-name` (400), admin routes mounted only when `MAINTAINER_KEY` is set, in backend/src/api/middleware/maintainer-auth.ts
- [X] T043 [US4] Implement guide admin service: category create-with-initial-guide (atomic), metadata edit, mandated-protected soft-retire, immutable guide version publishing with atomic active flip, zod validation of all bodies, changedBy/changedAt recording, in backend/src/services/guidance/guide-admin-service.ts
- [X] T044 [US4] Implement admin routes per contracts/api.md (GET/POST /api/admin/categories, PUT/DELETE /api/admin/categories/:name, POST /api/admin/categories/:name/guide, GET /api/admin/categories/:name/guide/versions) using the existing error envelope, in backend/src/api/routes/admin-guides.ts

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation evidence, README upkeep, and the demo-readiness gate

- [X] T045 [P] Update README.md: How to use (guided flow, quick replies), Troubleshooting, configuration (`MAINTAINER_KEY`, `seed:guides`), admin API summary, roadmap tick for guided troubleshooting
- [ ] T046 [P] Capture documentation evidence in docs/: chat screenshots of a guided flow to resolution and to escalation (Chapter 4) — **screenshots not captured (no live browser session run this pass)**; updated sequence diagram including the guidance stage (Chapter 4.2–4.4) — done, see `docs/design/sequence-diagrams.md` §4; TC tables generated from test names (Chapter 5) — done, `docs/testing/tc-tables.md` regenerated
- [ ] T047 Run all five quickstart.md scenarios plus automated gates on the demo machine: `npm run typecheck --workspace backend`, lint, `npm test --workspace backend` (incl. classification regression + guardrail tests), `npm test --workspace frontend` (ChatPage + VoiceControl green) — **automated gates done and green** (166/166 backend, 47/47 frontend, typecheck + lint clean); the 5 manual quickstart.md walkthroughs on a live demo machine were not run this pass
- [X] T048 Run `graphify update .` to refresh the knowledge graph after implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories. Internal order: T002–T003 (prompt modules) before T004–T006 (provider refactor + regression gate); T007–T009 (models) before T010–T013 (enums, seed, classifier)
- **US1 (Phase 3)**: depends on Foundational. T018–T019 before T020–T021; T022 before T023; T023 before T024–T025; T025 before T026–T028
- **US2 (Phase 4)**: depends on US1 (extends the same state machine). T029–T031 written and failing BEFORE T032–T033 (safety-critical TDD)
- **US3 (Phase 5)**: depends on US1 (mechanism) and US2 (escalated endings in tests). T034 before T036; T037 independent of both
- **US4 (Phase 6)**: depends on Foundational only (admin API is orthogonal to the chat flow); T041 additionally exercises classification, so run after T012. T039–T041 before T042–T044
- **Polish (Phase 7)**: depends on all desired stories

### User Story Dependency Summary

- **US1 (P1)**: Foundational only — MVP
- **US2 (P2)**: builds on US1's state machine; independently testable via its own escalation scenarios
- **US3 (P3)**: reuses US1/US2 mechanism; content + guard only
- **US4 (P3)**: independent of US1–US3 at the API layer; can proceed in parallel with US2/US3 after Foundational

### Parallel Opportunities

- Phase 2: T004 ∥ T005; T007 ∥ T008 ∥ T009
- US1: T014 ∥ T015 ∥ T016 ∥ T017 (tests); T020 ∥ T021 (providers); T026 ∥ backend tasks
- US2: T029 ∥ T030 ∥ T031
- US3: T034 ∥ T035; T037 parallel with test writing
- US4: T039 ∥ T040 ∥ T041; entire phase can run in parallel with Phases 4–5 (different files)
- Polish: T045 ∥ T046

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (different files):
Task: "Unit tests for guidance state machine in backend/tests/unit/guidance-service.test.ts"
Task: "Unit test for interpretStepReply zod schema in backend/tests/unit/interpret-step-reply.test.ts"
Task: "Integration test guided flow to resolution in backend/tests/integration/guided-flow-resolution.test.ts"
Task: "Integration test session resumption in backend/tests/integration/guided-session-resume.test.ts"

# Then providers in parallel after T019:
Task: "interpretStepReply in backend/src/services/llm/ollama-provider.ts"
Task: "interpretStepReply in backend/src/services/llm/openai-compat-provider.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001) → Phase 2 (T002–T013) — prompt extraction and data-driven classification are the heavy lift
2. Phase 3 (T014–T028) — password/login guided flow to resolution
3. **STOP and VALIDATE**: quickstart Scenario 1 + Scenario 5 (resumption) on the demo machine — this is a demoable MVP satisfying IR FR-4 for the mandated starting category

### Incremental Delivery

1. MVP (above) → demo
2. Add US2 (T029–T033) → safe termination, escalation with context → demo quickstart Scenario 2
3. Add US3 (T034–T038) → all six categories → demo Scenario 3
4. Add US4 (T039–T044) → maintainer management API → demo Scenario 4
5. Polish (T045–T048) → docs evidence + release gate

### Notes

- The developer performs all git commits himself (constitution Development Workflow); agents suggest messages only
- Files stay ≤ 500 lines; zod at every boundary (admin bodies, LLM interpretation output)
- Guide steps are curated data: the LLM never invents, reorders, or omits steps — the state machine in T022 is the enforcement point
