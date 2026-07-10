# Tasks: Conversational & Ticketing Foundation

**Input**: Design documents from `/specs/001-conversational-ticketing-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: REQUIRED for every feature (Constitution Principle IV). Escalation logic is safety-critical → test-first (T034 must be written and FAIL before T036–T038). All test names follow `TC-`traceable naming so the Vitest reporter can emit APU Chapter-5 TC tables.

**Organization**: Tasks grouped by user story so each story is an independently implementable, testable, demoable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (report→ticket), US2 (status visibility), US3 (clarify/escalate)

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create repository scaffolding per plan.md: `backend/` and `frontend/` directory trees, root `.gitignore`, root `.env.example` (MONGODB_URI, PORT, APP_MODE, LLM_PROVIDER, LLM_MODEL, OLLAMA_URL, LLM_TIMEOUT_MS, CONFIDENCE_THRESHOLD, MAX_CLARIFICATION_ROUNDS, SESSION_INACTIVITY_MINUTES)
- [X] T002 Initialize backend project: `backend/package.json` (express, mongoose, zod, pino; dev: typescript@5, vitest, supertest, mongodb-memory-server, tsx), `backend/tsconfig.json` with `strict: true`
- [X] T003 [P] Initialize frontend project: Vite + React + TypeScript strict + Tailwind CSS in `frontend/` (`frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/tsconfig.json`)
- [X] T004 [P] Configure ESLint + Prettier for both projects: `backend/eslint.config.js`, `frontend/eslint.config.js`, shared `.prettierrc` at root
- [X] T005 Implement zod-validated config module in `backend/src/config/index.ts` loading `.env` (fail-fast on invalid config; exports typed Config object; APP_MODE enum normal|demo|test)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create structured logging + typed errors: `backend/src/lib/logger.ts` (pino), `backend/src/lib/errors.ts` (AppError hierarchy incl. `LlmUnavailable`, `InvalidTransition`), error envelope per contracts/api.md in `backend/src/api/middleware/error-handler.ts`
- [X] T007 Create Express app skeleton + Mongo connection + health endpoint: `backend/src/app.ts` (app factory taking injected LlmProvider), `backend/src/server.ts`, `backend/src/api/routes/health.ts` returning `{status, llm:{reachable,model}, db:{reachable}}` per contracts/api.md
- [X] T008 [P] Create Mongoose models + shared enums per data-model.md: `backend/src/models/enums.ts` (IssueCategory, TicketStatus, HandlingMode, MessageAuthor, Actor), `backend/src/models/reporter.ts` (unique orgId), `backend/src/models/conversation.ts`, `backend/src/models/message.ts`, `backend/src/models/ticket.ts` (embedded append-only history, unique reference)
- [X] T009 [P] Implement the single LLM gateway in `backend/src/services/llm/`: `provider.ts` (LlmProvider interface: classifyAndReply, streamReply, health), `schema.ts` (zod schema for `{category, confidence, reply}` against closed enum), `ollama-provider.ts` (JSON-mode + token streaming, 10 s timeout → typed LlmUnavailable), `mock-provider.ts` (deterministic scripted responses for tests), `factory.ts` (config-driven selection)
- [X] T010 Implement SSE infrastructure: per-session event bus in `backend/src/api/sse/event-bus.ts`, `GET /api/events` endpoint in `backend/src/api/sse/events-route.ts` (event types agent_token, agent_message, ticket_created, ticket_updated per contracts/api.md)
- [X] T011 Implement zod request-validation middleware in `backend/src/api/middleware/validate.ts` (body/params/query schemas, 400 with error envelope)
- [X] T012 Implement session + reporter upsert: `backend/src/services/session/session-service.ts` (opaque session tokens, inactivity expiry from config) and `POST /api/sessions` route in `backend/src/api/routes/sessions.ts` returning `{sessionId, reporter, conversationId, openTickets}` per contracts/api.md
- [X] T013 [P] Frontend foundation: typed API client mirroring contract types in `frontend/src/services/api.ts`, SSE subscription hook `frontend/src/services/useEvents.ts`, shared types `frontend/src/lib/types.ts`, app shell + SessionForm (displayName + orgId) in `frontend/src/pages/ChatPage.tsx`, `frontend/src/components/SessionForm.tsx`
- [X] T014 Test infrastructure: `backend/vitest.config.ts`, `backend/tests/helpers/test-app.ts` (app factory + mongodb-memory-server + MockLlmProvider), TC-table generator `backend/scripts/tc-tables.ts` (Vitest JSON output → APU Chapter-5 markdown table in `docs/testing/tc-tables.md`), npm scripts `test`, `test:benchmark`, `tc-tables`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Report an IT issue and receive a ticket (Priority: P1) 🎯 MVP

**Goal**: An identified user describes a problem in free text; the agent classifies it into one of six categories, creates a ticket (timestamp, category, description, reporter), and confirms in plain language with a quotable `HD-NNNN` reference. Greeting-only input creates no ticket. LLM outage still records the report (unclassified, human-flagged).

**Independent Test**: Run the prepared six-category report set through the chat; each yields a correctly categorised ticket + confirmation; "hi" yields no ticket; with the provider stopped, a report still creates an unclassified ticket (quickstart.md §US1, §Degradation).

### Tests for User Story 1 (REQUIRED - Constitution Principle IV) ⚠️

- [X] T015 [P] [US1] Integration test for session start + reporter upsert (`POST /api/sessions` contract: 201 shape, orgId validation 400, re-use of same orgId) in `backend/tests/integration/sessions.test.ts`
- [X] T016 [P] [US1] Integration test for report→classify→ticket journey in `backend/tests/integration/report-issue.test.ts`: all six categories reachable (spec US1-AS3), ticket fields complete (US1-AS2), confirmation includes reference (US1-AS1), greeting creates no ticket (US1-AS4) — MockLlmProvider scripted per case
- [X] T017 [P] [US1] Unit test for LLM output parsing in `backend/tests/unit/classification.test.ts`: valid JSON accepted, unknown category rejected, confidence out of range rejected, malformed output → LlmUnavailable path (Principle II: never partially trust)
- [X] T018 [P] [US1] Integration test for degradation (FR-013) in `backend/tests/integration/degradation.test.ts`: provider timeout/down → unclassified ticket with reason `llm_unavailable`, user told report saved, `/api/health` shows degraded

### Implementation for User Story 1

- [X] T019 [US1] Implement atomic ticket reference counter (`HD-NNNN`) in `backend/src/services/ticket/counter.ts` and ticket creation service in `backend/src/services/ticket/ticket-service.ts` (writes first history record; category `unclassified` ⇒ escalated per data-model.md)
- [X] T020 [US1] Implement classification service in `backend/src/services/classification/classifier.ts`: classification prompt, provider call through gateway, zod parse, confidence policy (≥ CONFIDENCE_THRESHOLD accept; below → defer to clarification path stub returning low-confidence result)
- [X] T021 [US1] Implement conversation orchestration in `backend/src/services/conversation/conversation-service.ts`: persist user Message, greeting/report discrimination, invoke classifier, create ticket on success, compose plain-language confirmation (FR-010), stream reply tokens via event bus, persist agent Message
- [X] T022 [US1] Implement `POST /api/conversations/:conversationId/messages` route in `backend/src/api/routes/conversations.ts`: 202 + messageId, session/conversation ownership checks (403/404), 400 `MESSAGE_TOO_LONG` over 4000 chars, wires conversation service side effects per contracts/api.md
- [X] T023 [P] [US1] Frontend chat components in `frontend/src/components/`: `MessageBubble.tsx` (user/agent/system variants, streaming token append), `TicketCard.tsx` (reference, category, plain-language confirmation)
- [X] T024 [US1] Wire frontend chat flow in `frontend/src/pages/ChatPage.tsx`: send message → render streamed reply (first token visible; SC-008 UX), render ticket_created as TicketCard, degradation notice rendering
- [X] T025 [US1] Create labelled benchmark fixture set (≥ 10 reports per category + ambiguous + out-of-scope, per SC-003) in `backend/tests/benchmark/fixtures/reports.json` and opt-in benchmark test `backend/tests/benchmark/classification.bench.test.ts` asserting ≥ 80% accuracy and SC-008 latency against real Ollama

**Checkpoint**: User Story 1 fully functional — demoable MVP (report → categorised ticket → confirmation)

---

## Phase 4: User Story 2 - Follow ticket status in plain messages (Priority: P2)

**Goal**: Every status/handling-mode change appears in the reporter's conversation in plain language within 2 s; the user can ask about their tickets (including from earlier sessions under the same orgId) and get a clear summary.

**Independent Test**: Create a ticket, drive each allowed transition via the demo-mode endpoint, verify a plain-language SSE update arrives ≤ 2 s; ask "what's happening with my ticket?" and get status + mode; new session with same orgId lists the open ticket (quickstart.md §US2).

### Tests for User Story 2 (REQUIRED - Constitution Principle IV) ⚠️

- [X] T026 [P] [US2] Unit test (write FIRST — state machine gates all ticket mutation) for exhaustive transition matrix in `backend/tests/unit/state-machine.test.ts`: every allowed transition per data-model.md accepted, every other pair rejected with InvalidTransition, history appended with actor + timestamp, history is append-only
- [X] T027 [P] [US2] Integration test for status visibility in `backend/tests/integration/status-updates.test.ts`: transition → ticket_updated SSE with plainText ≤ 2 s (SC-004), status question in chat → per-ticket plain summary, cross-session lookup via same orgId (FR-008), waiting_on_user → user reply → mode returns to automated (US2-AS3)

### Implementation for User Story 2

- [X] T028 [US2] Implement ticket state machine in `backend/src/services/ticket/state-machine.ts` (allowed transitions from data-model.md incl. resolved→in_progress reopen; validates then appends TransitionRecord) to make T026 pass
- [X] T029 [US2] Implement ticket queries: `GET /api/tickets` and `GET /api/tickets/:reference` (detail incl. history + transcript) in `backend/src/api/routes/tickets.ts` with ownership checks per contracts/api.md
- [X] T030 [US2] Implement status-change notification in `backend/src/services/ticket/notifications.ts`: TransitionRecord → plain-language sentence (FR-010) → ticket_updated event on the reporter's session bus
- [X] T031 [US2] Implement status-question intent in `backend/src/services/conversation/conversation-service.ts`: detect ticket-status questions, answer with the reporter's tickets (status + handling mode, jargon-free)
- [X] T032 [US2] Implement demo/test-only transition endpoint `PATCH /api/tickets/:reference/state` in `backend/src/api/routes/test-support.ts` (separate router registered only when APP_MODE=demo|test; 409 on rejected transition) + integration test proving 404 in normal mode in `backend/tests/integration/test-support-guard.test.ts`
- [X] T033 [US2] Frontend status surfaces: `frontend/src/components/StatusBadge.tsx`, status-update system bubbles in ChatPage, open-tickets list on session start (from `POST /api/sessions` openTickets)
- [X] T048 [US2] Implement resolution confirmation flow in `backend/src/services/conversation/conversation-service.ts` + integration test `backend/tests/integration/resolution-confirm.test.ts`: on Resolved the agent asks the reporter to confirm the fix — confirmation → `resolved→closed`, "still broken" → `resolved→in_progress`, no reply leaves it Resolved (spec US2-AS4/FR-004; added post-analysis, numbered out of sequence)

**Checkpoint**: User Stories 1 AND 2 work independently — live status demo possible

---

## Phase 5: User Story 3 - Unclear or complex reports reach a human (Priority: P3)

**Goal**: Low confidence triggers a clarifying question (max MAX_CLARIFICATION_ROUNDS=2); still-unclear reports become unclassified tickets flagged `human_involved`; "I want a human" escalates immediately; escalated tickets carry the full transcript + classification attempts so nothing is re-asked (FR-007).

**Independent Test**: Ambiguous report → clarifying question (no ticket); vague twice more → escalated unclassified ticket; "can I just talk to IT staff?" → immediate escalation; fetch escalated ticket → transcript + attempts attached (quickstart.md §US3).

### Tests for User Story 3 (REQUIRED - Constitution Principle IV) ⚠️

> **Escalation logic is safety-critical (Constitution Principle II/IV): T034 MUST be written and observed FAILING before T036–T038 are implemented.**

- [X] T034 [US3] Write failing unit tests for escalation rules in `backend/tests/unit/escalation.test.ts`: trigger matrix (user_request any time; low_confidence after exactly 2 exhausted rounds; out_of_scope; llm_unavailable), each sets escalated + reason + human_involved, context preservation invariant (conversation link present), never-silent-guess invariant (low confidence NEVER yields a categorised unescalated ticket)
- [X] T035 [P] [US3] Integration test for clarify/escalate journeys in `backend/tests/integration/escalation-flow.test.ts`: US3-AS1 (ambiguous → question, no ticket), US3-AS2 (rounds exhausted → unclassified escalated ticket), US3-AS3 (explicit human request → immediate escalation + acknowledgement), US3-AS4/FR-007 handover payload completeness via `GET /api/tickets/:reference`

### Implementation for User Story 3

- [X] T036 [US3] Implement escalation service in `backend/src/services/escalation/escalation-service.ts` to make T034 pass (pure decision module: inputs = classification result, round count, user intent flags; outputs = escalation decision with reason)
- [X] T037 [US3] Implement clarification loop in `backend/src/services/conversation/conversation-service.ts`: increment Conversation.clarificationRounds, ask model-generated clarifying question below threshold, hand off to escalation service at limit; counter resets once a ticket is created or escalated (spec FR-005); explicit-human-request detection wired to immediate escalation
- [X] T038 [US3] Implement off-topic/unsafe refusal (FR-012) in `backend/src/services/conversation/conversation-service.ts` + unit test in `backend/tests/unit/refusal.test.ts`: non-IT and action-execution requests get polite scope restatement, remediation-like requests offer escalation, no execution code path exists
- [X] T039 [US3] Frontend escalation states: human-involved banner + escalation acknowledgement bubble in `frontend/src/components/EscalationNotice.tsx`, wired in ChatPage

**Checkpoint**: All user stories independently functional — full conversational foundation complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, evidence capture, and release-gate validation

- [X] T040 [P] Implement remaining spec edge cases in `backend/src/services/conversation/conversation-service.ts` + `backend/tests/integration/edge-cases.test.ts`: multi-problem message (acknowledge both, one at a time, offer second ticket), duplicate prompt (same reporter + same category + status ≠ closed, per spec edge case), empty/gibberish input handling
- [X] T041 [P] Frontend component tests in `frontend/tests/`: SessionForm validation, MessageBubble streaming render, TicketCard, StatusBadge (Vitest + Testing Library)
- [X] T042 Availability probe script for SC-006 in `backend/scripts/availability-probe.ts` (interval session+report attempts over 24 h window, writes results log)
- [X] T043 Run full quality gates: `tsc --noEmit` (both projects), lint, `npm test` (backend + frontend), record any fixes
- [X] T044 Run `npm run test:benchmark` against real Ollama on the Victus; record SC-003 accuracy and SC-008 latency results into `docs/testing/benchmark-results.md` (run against LM Studio + Qwen2.5-7B-Instruct Q4_K_M via the openai_compat provider — all gates pass, see benchmark-results.md)
- [X] T045 Generate Chapter-5 evidence: `npm run tc-tables` → `docs/testing/tc-tables.md`; verify TC-No/input/expected/actual/Passed-Failed columns render
- [X] T046 [P] Capture documentation evidence per Principle V in `docs/`: chat + ticket UI screenshots (`docs/implementation/screenshots/`), named sample-code excerpts (`docs/implementation/sample-code.md`), architecture/sequence/ERD diagrams (`docs/design/`)
- [X] T047 (PASS 9/9 against LM Studio + Qwen2.5-7B-Instruct, SSE push 109 ms — see docs/testing/demo-path-log.md) Execute the scripted demo path end-to-end on the demo machine per quickstart.md §Demo path (report → classify → ticket → status question → demo-mode escalation transition → clarification → escalation) — release gate; record pass in `docs/testing/demo-path-log.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T002 before T005; T003/T004 parallel to T002/T005
- **Foundational (Phase 2)**: Depends on Setup. T006→T007 sequential; T008/T009 parallel after T007; T010→T012 need T007/T008; T013 parallel to all backend tasks after T003; T014 after T007–T009. **BLOCKS all user stories**
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion. Priority order US1 → US2 → US3 for solo work; independently testable at each checkpoint
- **Polish (Phase 6)**: T040/T041 after US1–US3; T042 after Phase 2; T043–T047 last (T047 is the final release gate)

### User Story Dependencies

- **US1 (P1)**: Only Foundational. No dependency on US2/US3
- **US2 (P2)**: Only Foundational. Uses tickets created by US1 flows in tests but creates its own fixtures — independently testable
- **US3 (P3)**: Only Foundational. Touches conversation-service files shared with US1 (T037/T038 same file as T021/T031 — do not parallelize across US1/US3 in the same files)

### Within Each User Story

- Tests before implementation; **T034 must FAIL before T036–T038 (safety-critical TDD)**; T026 (state-machine tests) written before T028
- Models (Phase 2) → services → routes → frontend wiring
- Story complete + checkpoint validated before next priority

### Parallel Opportunities

- Phase 1: T003, T004 alongside T002/T005
- Phase 2: T008, T009 together; T013 alongside all backend work
- US1: T015–T018 (four test files) together; then T023 alongside T019–T022
- US2: T026, T027 together; T033 alongside T028–T032
- US3: T035 alongside T034 authoring; T039 alongside T036–T038
- Phase 6: T040, T041, T046 together

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test authoring together (different files):
Task: "Integration test session start in backend/tests/integration/sessions.test.ts"
Task: "Integration test report→ticket in backend/tests/integration/report-issue.test.ts"
Task: "Unit test LLM output parsing in backend/tests/unit/classification.test.ts"
Task: "Integration test degradation in backend/tests/integration/degradation.test.ts"

# Then backend services sequentially (shared conversation flow), frontend in parallel:
Task: "Ticket counter + creation service in backend/src/services/ticket/"
Task: "Chat components in frontend/src/components/ (parallel to backend)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup → Phase 2: Foundational (critical path)
2. Phase 3: US1 → **STOP and VALIDATE** via quickstart.md §US1 + degradation drill
3. This alone is a demoable supervisor checkpoint: always-on intake turning free-text reports into categorised tickets

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → **MVP demo** (report → ticket)
3. US2 → validate → live status demo (SSE transitions)
4. US3 → validate → full escalation story
5. Phase 6 → evidence + benchmark + demo-path release gate (T047) before supervisor meeting/recording

### Session Planning Note (user workflow)

Natural per-session slices given API usage phasing: (1) Phases 1–2, (2) Phase 3 US1, (3) Phase 4 US2, (4) Phase 5 US3, (5) Phase 6 polish + gates. Each ends at a validated checkpoint.

---

## Notes

- [P] = different files, no incomplete dependencies; never parallelize two tasks touching `conversation-service.ts`
- Constitution gates for "feature done": tsc, lint, all tests, demo path, docs evidence, plan Constitution Check (all PASS as of plan.md)
- Analysis remediation applied 2026-07-08: gate.md items CHK001/005/007/008/011/012/013/014/031/033 resolved across spec/data-model/research/tasks (inline notes in checklists/gate.md). Still open and low-impact: CHK010, CHK018, and the remaining unchecked gate items — review opportunistically during implementation
- Commit after each task or logical group (user performs commits per project practice)

---

## Phase 7: Convergence

**Purpose**: Remaining work identified by /speckit-converge (2026-07-11) assessing the current codebase against spec.md, plan.md, and tasks.md. Gates re-verified at assessment time: `tsc --noEmit` (both projects), lint (both projects), backend tests 82/82, frontend tests 22/22 — all pass.

- [ ] T049 (deferred by user decision 2026-07-11 — run before final submission) Run the availability probe (`backend/scripts/availability-probe.ts`) unattended across a 24-hour window on the demo machine and record the results log as documentation evidence in `docs/testing/` per SC-006 (partial)
- [X] T050 Align backend HTTP-layer layout with plan.md Project Structure: move `backend/src/routes/` and `backend/src/middleware/` under `backend/src/api/`, relocate the SSE event bus (`backend/src/services/events/event-bus.ts`, `backend/src/routes/events.ts`) to `backend/src/api/sse/`, and move the ticket reference counter from `backend/src/models/counter.ts` to `backend/src/services/ticket/counter.ts`, updating imports and keeping all tests green per plan: project structure (partial)
- [X] T051 Remove the four stray zero-byte artifacts at repository root (`2`, `6`, `80%`, `m.text.includes(ticket.reference)`) left by shell redirection accidents per Constitution — Development Workflow, repo hygiene (unrequested)
