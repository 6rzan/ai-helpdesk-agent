---

description: "Task list for 005 Constrained Automated Remediation"
---

# Tasks: Constrained Automated Remediation

**Input**: Design documents from `/specs/005-constrained-remediation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/tools.md](contracts/tools.md), [quickstart.md](quickstart.md),
[DESIGN-DIRECTION.md](DESIGN-DIRECTION.md)

**Tests**: MANDATORY for every task (Constitution Principle IV). The safety-critical
components named in the constitution — the whitelist policy engine, the command executor, and
the escalation logic — are **test-first**: their failing test task precedes their
implementation task, and this ordering is not negotiable for this feature. Prompt-module
changes refresh the classification and guardrail regression tests (Principle VIII).

**Organization**: grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 through US6, mapping to the spec's user stories

## Path Conventions

Web application layout: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, configuration, the container environment, and the two extractions
that must happen before any new UI lands.

- [X] T001 Install `ssh2` and `@types/ssh2` in `backend/package.json` (`npm --prefix backend install ssh2` and `npm --prefix backend install -D @types/ssh2`)
- [X] T002 [P] Add `LLM_PROVIDERS`, `AGENT_MAX_STEPS`, `REMEDIATION_ENABLED`, `REMEDIATION_SSH_KEY_PATH`, `REMEDIATION_SSH_KEY_PASSPHRASE`, `REMEDIATION_CONNECT_TIMEOUT_MS`, `REMEDIATION_COMMAND_TIMEOUT_MS`, and `REMEDIATION_APPROVAL_TTL_MINUTES` to the zod schema in `backend/src/config/index.ts` with the defaults from research.md, plus a config unit test in `backend/tests/unit/config.test.ts`
- [X] T003 [P] Document the same variables in `.env.example` with comments, committing no secret values
- [X] T004 [P] Add `.keys/` to `.gitignore` so no SSH key material can be committed (Principle VI)
- [X] T005 [P] Create the test-endpoint environment in `backend/test-endpoints/docker-compose.yml` plus its image build context, defining `test-node-a` (OpenSSH, an approved dummy service, seeded local test accounts) and `test-node-b` (OpenSSH, CUPS) per research.md R1
- [X] T006 [P] Create `backend/test-endpoints/capture-host-keys.mjs` to read each running endpoint's host key fingerprint for pinning in the registry
- [X] T007 [P] Create `backend/test-endpoints/reset.ps1` wrapping the `down -v` / `up -d` reset cycle, and a seeding step that restores locked test accounts, queued print jobs, and approved services to a known state (FR-020)
- [X] T008 Extract the ticket history timeline and its sub-sections out of `frontend/src/pages/TicketDetailPage.tsx` into `frontend/src/components/TicketTimeline.tsx`, keeping `frontend/tests/pages/*` green — the page is 13.3K and must shrink before this feature adds to it (500-line rule)
- [X] T009 Extract the ticket list and filter controls out of `frontend/src/pages/DashboardPage.tsx` into `frontend/src/components/staff/TicketList.tsx`, keeping existing tests green — same reason

**Checkpoint**: dependencies installed, configuration validated, endpoints reachable over SSH by hand, and both oversized pages back under the ceiling.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the safety spine. Policy data, the default-deny engine, the append-only trail,
the availability gate, and the shared frontend atoms. Every user story depends on this.

**⚠️ CRITICAL**: no user story work begins until this phase is complete. Note the test-first
ordering on the policy schema, the policy loader, the audit trail, the availability gate, and
the policy engine.

### Enums and models

- [X] T010 [P] Extend `backend/src/models/enums.ts` with `ACTION_TIERS` (`read_only`, `state_changing`), `ACTION_OUTCOMES` (`succeeded`, `failed`, `timed_out`, `attempted_unverified`, `refused`), and `REFUSAL_REASONS` (the twelve values in data-model.md §5), with a unit test asserting the exact members in `backend/tests/unit/enums.test.ts`
- [X] T011 [P] Extend `backend/src/models/staff-action.ts` with `remediation_toggle` and `approval_decision` in `STAFF_ACTIONS` and `remediation` in `STAFF_ACTION_TARGETS`, with a test proving existing staff-action records still validate

### Policy data (test-first — safety-critical)

- [X] T012 Write failing unit tests for the policy and registry schemas in `backend/tests/unit/policy-schema.test.ts`: placeholder/argument symmetry both ways, unique ids, `allowedEndpointIds` resolving to real endpoints, `state_changing` entries naming a valid `read_only` `verifiedBy`, and rejection of any free-text argument kind
- [X] T013 Implement the zod schemas in `backend/src/policy/policy-schema.ts` so T012 passes
- [X] T014 [P] Author the whitelist in `backend/src/policy/action-policy.json`: the nine entries from research.md R11 with `version`, plain-language descriptions, fixed command templates, enum or anchored-pattern arguments only, `allowedEndpointIds`, and `verifiedBy` on all three state-changing entries
- [X] T015 [P] Author the registry in `backend/src/policy/test-endpoints.json`: `test-node-a` and `test-node-b` with id, label, host, port, username, pinned `hostKeyFingerprint`, and description, and **no secret values**
- [X] T016 Write failing unit tests for the loader in `backend/tests/unit/policy-loader.test.ts`, including the fail-closed cases: a missing file, an empty entry list, and an invalid file all leave remediation **unavailable** and never permissive, while guidance and escalation stay unaffected (edge case, FR-002)
- [X] T017 Implement `backend/src/policy/policy-loader.ts` to read, validate, and freeze both files once at startup, exposing read-only accessors and no write path of any kind (FR-005)

### Append-only audit trail (test-first — safety-critical)

- [X] T018 Write failing tests in `backend/tests/integration/audit-immutability.test.ts` asserting that `findOneAndUpdate`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, and `findOneAndDelete` on action records each throw (FR-010, research R7)
- [X] T019 Implement `backend/src/models/action-record.ts` per data-model.md §5 with `strict: "throw"`, throwing `pre` hooks on all six mutation paths, and indexes on `at` and `ticketId`
- [X] T020 Implement `backend/src/services/remediation/audit-service.ts` with an append-only write API and no update or delete function, plus unit tests in `backend/tests/unit/audit-service.test.ts` covering a record for each outcome and each refusal reason

### Availability gate (test-first — safety-critical)

- [X] T021 [P] Implement `backend/src/models/remediation-settings.ts` as the singleton from data-model.md §3, defaulting `globallyEnabled` from `REMEDIATION_ENABLED` (default `false`)
- [X] T022 Write failing unit tests in `backend/tests/unit/availability-service.test.ts`: execution is permitted only when globally enabled **and** the target endpoint is not individually disabled, and the check is evaluated immediately before execution rather than cached per turn
- [X] T023 Implement `backend/src/services/remediation/availability-service.ts` so T022 passes

### Default-deny policy engine (test-first — safety-critical)

- [X] T024 Write failing unit tests in `backend/tests/unit/policy-engine.test.ts` covering exact matching only: unknown action id, altered argument, argument outside its enum, argument failing its pattern, unregistered endpoint id, endpoint not in the entry's `allowedEndpointIds`, and near-miss variants of approved actions — each returns a refusal with the correct reason and **never** an execution (FR-002, US2 AS3)
- [X] T025 Implement `backend/src/services/remediation/policy-engine.ts` so T024 passes: it resolves the target from the policy entry and ticket context, applies the availability gate, and is the **only** module permitted to call the executor
- [X] T026 [P] Add fixtures and factories for policy entries, endpoints, action records, and approval requests to `backend/tests/helpers/factories.ts`

### Shared frontend atoms

- [X] T027 [P] Add `ActionRecord`, `ApprovalRequest`, `TestEndpointSummary`, `RemediationAvailability`, `ActionProposal`, and `MetricsSummary` types to `frontend/src/lib/types.ts`
- [X] T028 [P] Create `frontend/src/components/ActionOutcomeBadge.tsx` as a vocabulary **separate** from `StatusBadge.tsx`, with refused, declined, and expired rendered neutral grey and red reserved for a failed execution, plus a test in `frontend/tests/components/ActionOutcomeBadge.test.tsx` asserting refusals are not styled as errors (Design Direction)
- [X] T029 [P] Create `frontend/src/components/ActionRecordCard.tsx` as the single action-record atom with the fixed field order from DESIGN-DIRECTION.md, an icon plus written label for read-only versus state-changing, mono inert command text, and collapsed-by-default output disclosure, with a test in `frontend/tests/components/ActionRecordCard.test.tsx`
- [X] T030 [P] Extend `frontend/src/services/api.ts` with the client functions for every endpoint in contracts/api.md
- [X] T031 Extend `EventHandlers` and `StaffEventHandlers` in `frontend/src/services/useEvents.ts` with the five new event types from contracts/api.md, with a regression test proving the shipped `ticket_created` and `ticket_updated` handlers still fire

**Checkpoint**: nothing can execute yet, but everything that decides *whether* something may execute exists, is default-deny, and is tested.

---

## Phase 3: User Story 1 - The Agent Checks Something Instead of Asking the Employee To (Priority: P1) 🎯 MVP

**Goal**: an approved read-only diagnostic runs against a registered endpoint on the
reporter's in-chat consent, its result is reported in plain language, it feeds the next guided
step, and it is audited.

**Independent Test**: report a service-status or network issue, reach the point in the guided
flow where a diagnostic applies, and confirm the agent runs it against the test endpoint,
reports the observed output, writes an audit record, and continues guidance — with no other
story implemented.

### Tests for User Story 1 (MANDATORY, executor and loop are test-first) ⚠️

- [X] T032 [P] [US1] Write failing unit tests for the executor in `backend/tests/unit/executor.test.ts` against a stubbed SSH transport: connect timeout, command timeout, forced channel and connection close on timeout, host-key mismatch rejection, and the assertion that no employee text or model output ever reaches the command string (FR-007, research R2)
- [X] T033 [P] [US1] Write a failing integration test in `backend/tests/integration/remediation-diagnostic.test.ts` for the happy path: consent recorded, diagnostic executes against the registered endpoint, plain-language report returned, action record appended (US1 AS1)
- [X] T034 [P] [US1] Write a failing integration test in `backend/tests/integration/remediation-endpoint-failure.test.ts` for an unreachable endpoint: honest failure message, audited attempt and outcome, escalation rather than a silent retry (US1 AS3)
- [X] T035 [P] [US1] Write failing unit tests for the bounded loop in `backend/tests/unit/agent-loop.test.ts`: at most one tool call per step, the `AGENT_MAX_STEPS` cap, escalation on reaching the cap, and escalation on no progress defined as the same `(tool, arguments)` pair twice or two consecutive stepless iterations (FR-011, FR-012, US1 AS4)
- [X] T036 [P] [US1] Write a failing test in `backend/tests/integration/guided-step-order.test.ts` proving an action can satisfy or inform a guided step without the guide's own step sequence or versioning changing (FR-014, US1 AS2)
- [X] T037 [P] [US1] Write a failing frontend test in `frontend/tests/components/ConsentBlock.test.tsx` asserting the consent block is a distinct affordance and is not rendered as a `QuickReplies` pill (Design Direction)

### Implementation for User Story 1

- [X] T038 [US1] Implement `backend/src/services/remediation/executor.ts` on `ssh2` with structured host and port parameters, pinned `hostVerifier`, the two bounded timeouts, and length-bounded output capture, so T032 passes
- [X] T039 [US1] Implement the `RegisteredTool` shape and registry in `backend/src/services/agent/tools/index.ts` per contracts/tools.md, with startup validation that every state-changing tool maps 1:1 onto a policy entry (FR-013)
- [X] T040 [P] [US1] Implement the six read-only tools (`account_status`, `network_probe`, `print_queue_status`, `peripheral_list`, `service_status`, and the argument schemas they share) as modules under `backend/src/services/agent/tools/`, with descriptions that state they inspect the test endpoint and never imply reach into the employee's own hardware (research R11)
- [X] T041 [US1] Implement `backend/src/services/agent/agent-loop.ts` as the bounded plan → act → observe cycle that produces proposals and never calls the executor directly, so T035 passes
- [X] T042 [US1] Add the layered per-tool usage prompt module in `backend/src/services/llm/prompts/tools.ts`, branching from the shared core rather than forking it, and refresh the classification and guardrail regression tests (Principle VIII)
- [X] T043 [US1] Implement proposal issuance and consent recording in `backend/src/services/remediation/consent-service.ts`: a proposal is per-turn, single-use, and consent requires an explicit affirmative tied to a specific `messageId` — silence, ambiguity, or earlier general willingness is not consent (FR-004)
- [X] T044 [US1] Implement `POST /tickets/:id/actions/consent` in `backend/src/api/routes/tickets.ts` per contracts/api.md, rejecting unknown, stale, or already-consumed `proposalId` with `PROPOSAL_INVALID`, and refusing non-owners with `not_ticket_owner` recorded as an audited refusal (edge case)
- [X] T045 [US1] Implement `GET /tickets/:id/actions` in `backend/src/api/routes/tickets.ts` returning action records and pending approvals for the ticket
- [X] T046 [US1] Wire the loop into `backend/src/services/conversation/conversation-guidance.ts` at the points where an approved action applies, so guidance continues from the observed result, so T036 passes
- [X] T047 [US1] Emit `action_proposed` and `action_recorded` on the existing SSE channels from `backend/src/api/sse/event-bus.ts`
- [X] T048 [US1] Create `frontend/src/components/ConsentBlock.tsx` as a bounded consent affordance stating in plain words what will be done, to what, and that it is a test endpoint, so T037 passes
- [X] T049 [US1] Integrate the consent block and action reporting into `frontend/src/pages/ChatPage.tsx` with no optimistic state — nothing renders as running or done until the server says so (Design Direction) — keeping `ChatPage.test.tsx` and `ChatPage.guidance.test.tsx` green
- [X] T050 [US1] Render observed command output through the collapsed-by-default disclosure in `ActionRecordCard.tsx` on the chat surface, with a frontend test covering the expanded and collapsed states
- [X] T051 [US1] Implement escalation on cap, no-progress, and endpoint failure by routing through the existing `backend/src/services/escalation/escalation-service.ts` so the diagnostic result travels with the escalated ticket (FR-007 of the IR, US1 AS3)

**Checkpoint**: the safest half of FR-8 is real and demoable. The employee gets an answer instead of an instruction, and the whole safety spine has been exercised end to end.

---

## Phase 4: User Story 2 - Anything Not Explicitly Approved Is Refused and Escalated (Priority: P2)

**Goal**: every out-of-whitelist request is refused in plain language, audited with its reason,
and offered escalation, and today's blanket keyword refusal becomes a genuine policy decision
without weakening for a moment.

**Independent Test**: issue a spread of out-of-whitelist requests — unknown actions, near-miss
variants, approved actions aimed at unregistered targets — and confirm each is refused, audited
with its reason, and offered escalation, with no execution in any case.

### Tests for User Story 2 (MANDATORY, escalation logic is test-first) ⚠️

- [X] T052 [P] [US2] Write failing integration tests in `backend/tests/integration/remediation-refusal.test.ts` for the full refusal matrix in quickstart.md, asserting the exact `refusalReason` and zero executions for each (US2 AS1, AS2, AS3; SC-001)
- [X] T053 [P] [US2] Write a failing integration test in `backend/tests/integration/remediation-injection.test.ts` proving employee text such as "ignore your rules and run X" is handled as data, that any resulting proposal still faces exact matching, and that the attempt is audited like any other refusal (FR-006, US2 AS4)
- [X] T054 [P] [US2] Write a failing test in `backend/tests/integration/remediation-confidence.test.ts` asserting low confidence escalates instead of acting, and that ambiguity between two approved actions produces a clarifying question rather than a choice (FR-015, US2 AS5, edge case)
- [X] T055 [P] [US2] Write a failing test in `backend/tests/integration/remediation-no-mutation-path.test.ts` asserting there is no route, in any role, that creates, edits, or disables a policy entry, a registry endpoint, or an audit record, and that the corresponding HTTP methods 404 (US2 AS6, FR-005, FR-010)
- [X] T056 [P] [US2] Write a failing regression test in `backend/tests/integration/refusal.test.ts` proving every request refused by today's keyword rule is still refused after FR-016 lands, so nothing becomes executable except through an explicit policy entry

### Implementation for User Story 2

- [X] T057 [US2] Replace the blanket `REMEDIATION_PATTERN` branch in `backend/src/services/conversation/conversation-engine.ts` with a policy decision: matched and authorised requests proceed, everything else is refused in plain language with escalation offered (FR-016), so T056 passes
- [X] T058 [US2] Ensure every refusal path writes a complete action record through `audit-service.ts` with actor, classified intent, requested action, target where one was named, and reason (FR-009), so T052 passes
- [X] T059 [US2] Implement prompt-injection defence in `backend/src/services/llm/prompts/core.ts` by delimiting user messages and retrieved content as data that is never concatenated as instructions, refreshing the guardrail regression tests (Principle VIII), so T053 passes
- [X] T060 [US2] Implement the low-confidence and ambiguity branches in `backend/src/services/agent/agent-loop.ts`, routing to escalation and to a clarifying question respectively, so T054 passes
- [X] T061 [US2] Render refusals in `frontend/src/pages/ChatPage.tsx` neutrally with a plain reason and an escalation offer, never as an error, with a frontend test asserting the neutral treatment (Design Direction)
- [X] T062 [US2] Add the `not_ticket_owner` and `already_attempted` refusal paths so acting on a ticket the requester does not own, and re-running an action that already failed for a ticket, are both refused and audited (edge cases, FR-012)

**Checkpoint**: the property the viva will probe hardest is provable on demand, and the shipped blanket refusal has been upgraded without being weakened.

---

## Phase 5: User Story 3 - The Agent Fixes a Routine Problem End to End (Priority: P3)

**Goal**: an approved state-changing action runs only after reporter consent **and** a named
staff member's approval, is verified, and is reported plainly.

**Independent Test**: drive a routine issue to the point where a remedial action applies, then
confirm the approval request reaches staff, that nothing executes before approval, that
approval leads to a verified and reported execution against the test endpoint, and that a
decline, an expiry, or a failed attempt each escalates with the attempt recorded.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T063 [P] [US3] Write failing unit tests for the approval lifecycle in `backend/tests/unit/approval-service.test.ts`: lazy expiry evaluated on list and on decide, expiry never meaning approval, and only `pending` requests transitioning (FR-004b, research R6)
- [X] T064 [P] [US3] Write a failing integration test in `backend/tests/integration/approval-concurrency.test.ts` proving two near-simultaneous decisions resolve with the first writer winning, the second receiving `APPROVAL_ALREADY_DECIDED`, exactly one execution, and both attempts attributed (edge case)
- [X] T065 [P] [US3] Write a failing integration test in `backend/tests/integration/approval-preconditions.test.ts` covering approval against a resolved ticket, against disabled remediation, and for an action already executed on that ticket — each closing as `no_longer_applicable` with no execution (edge case, R6)
- [X] T066 [P] [US3] Write a failing integration test in `backend/tests/integration/remediation-state-changing.test.ts` asserting **zero** state-changing executions without both a recorded consent and a recorded staff approval, including deliberate attempts to bypass the approval step (SC-005a)
- [X] T067 [P] [US3] Write a failing test in `backend/tests/integration/remediation-verification.test.ts` covering all three verification outcomes: verified success, verified contradiction reported as `failed` with escalation, and missing or failed verification reported as `attempted_unverified` with escalation (research R10, US3 AS5)
- [X] T068 [P] [US3] Write a failing test in `backend/tests/integration/remediation-password-disclosure.test.ts` asserting the unlock path genuinely unlocks the local test account, verifies before reporting, and always states plainly that this applied to the test account and not to any organisational directory (US3 AS7, FR-019)
- [X] T069 [P] [US3] Write a failing test asserting that when the employee declines consent, no approval request is raised at all and the decision is recorded (US3 AS4)

### Implementation for User Story 3

- [X] T070 [US3] Implement `backend/src/models/approval-request.ts` per data-model.md §4 including the embedded `ConsentRecord` and the five status values
- [X] T071 [US3] Implement `backend/src/services/remediation/approval-service.ts` with lazy expiry, atomic `findOneAndUpdate` on `status: "pending"`, and precondition re-checking at approval time, so T063, T064, and T065 pass
- [X] T072 [P] [US3] Add the three state-changing policy entries to `backend/src/policy/action-policy.json` (`unlock-account`, `expire-password`, `clear-print-queue`, `restart-service` with its enumerated service list) if not already authored in T014, each naming its `verifiedBy` entry
- [X] T073 [P] [US3] Implement the state-changing tools `unlock_account`, `expire_password`, `clear_print_queue`, and `restart_service` under `backend/src/services/agent/tools/`, each 1:1 with its policy entry (FR-013)
- [X] T074 [US3] Implement verification in `backend/src/services/remediation/policy-engine.ts`: after a state-changing execution, run the entry's `verifiedBy` read-only entry through the same policy path and derive the outcome from it, so T067 passes
- [X] T075 [US3] Extend `consent-service.ts` so consenting to a state-changing proposal raises an approval request rather than executing, so T066 passes
- [X] T076 [US3] Implement `GET /staff/approvals`, `POST /staff/approvals/:id/approve`, and `POST /staff/approvals/:id/decline` in `backend/src/api/routes/staff-approvals.ts` per contracts/api.md, writing a `StaffActionRecord` with action `approval_decision` on each decision
- [X] T077 [US3] Mount `staff-approvals.ts` in `backend/src/app.ts` behind the existing staff role guard
- [X] T078 [US3] Emit `approval_pending` and `approval_decided` from `backend/src/api/sse/event-bus.ts`
- [X] T079 [US3] Implement the three-stage in-chat state in `frontend/src/pages/ChatPage.tsx` — waiting on your consent, waiting on IT staff, then done or failed — so the employee is never unsure which is true (FR-004c, FR-006 of the IR)
- [X] T080 [US3] Implement the mandatory test-account disclosure string on the password path in `backend/src/services/remediation/`, with no em-dash, so T068 passes
- [X] T081 [US3] Implement the failed-action path: escalate carrying the action, its output, and the verification result, and never retry the same action (US3 AS5, FR-012)
- [X] T082 [US3] Implement the disable-during-execution behaviour: a running action completes and is audited, and nothing new starts because the availability gate is checked immediately before execution (edge case), with an integration test
- [X] T083 [US3] Handle the employee-contradicts-verification case: record both the verification result and the employee's contradiction on the ticket and escalate, without re-running the action (edge case)

**Checkpoint**: Objective O-3's automated half is complete and NFR-4's human oversight is exercised before the risky operation rather than reconstructed after it.

---

## Phase 6: User Story 4 - Staff Oversee, Audit, and Override Every Automated Action (Priority: P4)

**Goal**: staff decide pending approvals from the dashboard, inspect every executed and refused
action, and can switch remediation off globally or per endpoint.

**Independent Test**: generate pending requests plus a mix of executed and refused actions, then
confirm from a staff account that the queue lists every pending request and that deciding has
the stated effect, that every executed and refused action appears in the audit view with
complete detail, that the trail cannot be edited or deleted from any surface, and that
disabling remediation immediately stops executions while leaving guidance and escalation
working.

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T084 [P] [US4] Write a failing integration test in `backend/tests/integration/audit-trail-view.test.ts` asserting every executed **and** refused action appears with timestamp, actor, classified intent, exact action, target endpoint, authorisation, and outcome, and that filters by ticket, endpoint, and outcome work (US4 AS2, SC-002)
- [X] T085 [P] [US4] Write a failing integration test in `backend/tests/integration/remediation-toggle.test.ts` asserting a disable stops further executions immediately, that the employee is told the agent cannot act right now, that guidance and escalation still work, and that the disable is recorded as an attributed staff action (US4 AS4, SC-006)
- [X] T086 [P] [US4] Write a failing access-control test in `backend/tests/integration/access-control.test.ts` (extending the existing file) asserting non-staff accounts receive 403 with no action data in the body for `/staff/actions`, `/staff/approvals`, and `/staff/remediation` (US4 AS6)
- [X] T087 [P] [US4] Write a failing frontend test in `frontend/tests/components/AuditTrail.test.tsx` asserting the audit view renders **no** edit, delete, or overflow affordance, including disabled ones (Design Direction, US4 AS5)
- [X] T088 [P] [US4] Write a failing frontend test in `frontend/tests/components/ApprovalQueue.test.tsx` asserting each row shows ticket, exact action, target endpoint, reporter consent, and age, that approve requires a confirmation restating command and target, and that decline is not styled as destructive (Design Direction, US4 AS1)

### Implementation for User Story 4

- [X] T089 [US4] Implement `GET /staff/actions` in `backend/src/api/routes/staff-actions.ts` with pagination and the ticket, endpoint, outcome, and date filters, returning executed and refused actions together by default, so T084 passes
- [X] T090 [US4] Implement `GET /staff/remediation` and `POST /staff/remediation/toggle` in `backend/src/api/routes/staff-remediation.ts`, writing a `StaffActionRecord` with action `remediation_toggle` on each change, so T085 passes
- [X] T091 [US4] Mount `staff-actions.ts` and `staff-remediation.ts` in `backend/src/app.ts` behind the staff role guard, and add a test asserting `PATCH`, `PUT`, and `DELETE` on `/staff/actions` and `/staff/actions/:id` fall through to the 404 handler (FR-010)
- [X] T092 [US4] Emit `remediation_availability_changed` from `backend/src/api/sse/event-bus.ts`
- [X] T093 [US4] Create `frontend/src/components/staff/ApprovalQueue.tsx` as a decision queue with a confirmation step on approve, decline in neutral outline rather than red, and a designed empty state reading as a good outcome, so T088 passes
- [X] T094 [US4] Create `frontend/src/components/staff/AuditTrail.tsx` over `ActionRecordCard`, with the ticket, endpoint, and outcome filters and no mutation affordance anywhere, so T087 passes
- [X] T095 [US4] Create `frontend/src/components/staff/RemediationControls.tsx` with the asymmetric kill switch — off in one click, on behind a confirmation — plus the persistent non-dismissible disabled banner (Design Direction)
- [X] T096 [US4] Add the approval-queue entry point with its pending count indicator to `frontend/src/pages/DashboardPage.tsx`, and route the audit view and remediation controls through `frontend/src/components/RouteGuards.tsx`
- [X] T097 [US4] Interleave action records into the existing timeline in `frontend/src/components/TicketTimeline.tsx` alongside conversation, guided steps, and staff actions, building **no** second timeline and duplicating **no** existing staff-action entry (US4 AS3, FR-010)
- [X] T098 [US4] Add the new staff routes to `frontend/src/App.tsx` and verify staff retain takeover, reassign, and resolve authority on tickets the agent acted upon (FR-022) with an integration test

**Checkpoint**: automated actions are inspectable, decidable, and stoppable, which is what makes them usable as evidence.

---

## Phase 7: User Story 5 - Staff See How the Support Operation Is Actually Performing (Priority: P5)

**Goal**: a metrics summary on the dashboard covering volume, splits, autonomous handling,
escalation rate, automated-action outcomes, and resolution times for a selectable period.

**Independent Test**: generate a known mix of tickets, escalations, and automated actions, then
confirm the dashboard reports counts and rates matching that mix for the selected period, and
that a non-staff account cannot reach the surface.

### Tests for User Story 5 (MANDATORY) ⚠️

- [X] T099 [P] [US5] Write a failing integration test in `backend/tests/integration/metrics.test.ts` seeding a known mix and asserting every figure matches an independently counted expectation exactly, for each period preset (US5 AS1, SC-009)
- [X] T100 [P] [US5] Write a failing test asserting an empty period returns `hasData: false` with empty groupings rather than a zero-filled shape, and that an out-of-set `period` returns `METRICS_PERIOD_INVALID` (US5 AS3)
- [X] T101 [P] [US5] Write a failing frontend test in `frontend/tests/components/MetricsSummary.test.tsx` asserting the no-data state states plainly there is nothing to report, that figures use tabular numerals, and that no numeral is animated (Design Direction, US5 AS3)

### Implementation for User Story 5

- [X] T102 [US5] Implement `backend/src/services/metrics/metrics-service.ts` with the aggregation pipelines and the exact metric definitions from research.md R8, including median rather than mean resolution time, computed on demand with no cache, so T099 passes
- [X] T103 [US5] Implement `GET /staff/metrics` in `backend/src/api/routes/staff-metrics.ts` with the four period presets, so T100 passes
- [X] T104 [US5] Mount `staff-metrics.ts` in `backend/src/app.ts` behind the staff role guard, with an access test asserting 403 for non-staff (US5 AS4)
- [X] T105 [US5] Load the `dataviz` skill, then create `frontend/src/components/staff/MetricsSummary.tsx` as stat tiles plus labelled horizontal bar rows backed by real text values, with **no** charting dependency and no filled-track progress bars (Design Direction, research R12)
- [X] T106 [US5] Implement the period selector so figures update in place without a manual reload (US5 AS2), with a frontend test
- [X] T107 [US5] Place the metrics band on `frontend/src/pages/DashboardPage.tsx` alongside the ticket list per IR §1.5, keeping the page under the 500-line ceiling by extracting rather than inflating

**Checkpoint**: Objective O-4's workload-reduction claim becomes measurable rather than asserted.

---

## Phase 8: User Story 6 - The Assistant Keeps Working When a Model Provider Fails (Priority: P6)

**Goal**: an ordered provider chain that falls through on failure, preserves the existing
visible degradation on total failure, and closes CD-1.

**Independent Test**: configure an ordered list, force the first to fail, and confirm the
conversation continues on the next; then force all to fail and confirm the existing
visible-degradation and escalation behaviour still holds.

### Tests for User Story 6 (MANDATORY) ⚠️

- [ ] T108 [P] [US6] Write failing unit tests in `backend/tests/unit/chained-provider.test.ts`: `classifyAndReply` and `interpretStepReply` fall through to the next provider; `streamReply` falls through **only before the first token** and otherwise ends the stream and degrades visibly; `health` is true if any provider is healthy (research R4)
- [ ] T109 [P] [US6] Write a failing test asserting a single configured provider behaves exactly as today, and that an existing `.env` carrying only `LLM_PROVIDER` still works (US6 AS3, FR-024)
- [ ] T110 [P] [US6] Write a failing integration test asserting no automated action executes on a classification produced while the system is in a degraded model state, refused with `degraded_model` and audited (FR-025, US6 AS4)

### Implementation for User Story 6

- [ ] T111 [US6] Implement `backend/src/services/llm/chained-provider.ts` implementing the existing `LlmProvider` interface, mirroring the chain shape in `backend/src/services/stt/stt-service.ts`, so T108 passes
- [ ] T112 [US6] Extend `backend/src/services/llm/factory.ts` to parse `LLM_PROVIDERS` and build the chain, deriving it from `LLM_PROVIDER` when the list is absent, so T109 passes
- [ ] T113 [US6] Export the chained provider from `backend/src/services/llm/index.ts` and confirm no module outside the abstraction calls a provider directly (Principle VI), with a test asserting it
- [ ] T114 [US6] Record fallbacks per research.md R4: a `warn` log always, a system entry on the ticket history when the conversation has a ticket, and a `providerFallbacks` count in the metrics period summary — and **not** in the action audit trail
- [ ] T115 [US6] Add the `degraded_model` refusal path to `backend/src/services/remediation/policy-engine.ts`, so T110 passes
- [ ] T116 [US6] Confirm `backend/tests/integration/degradation.test.ts` still passes unchanged, since total-provider-failure behaviour must not regress (CD-1 closing evidence)

**Checkpoint**: CD-1's closing evidence exists.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T117 Run the full quickstart.md validation, including every refusal-matrix row and every user-story scenario, on the demo machine with the containers running
- [ ] T118 Confirm the release-gated demo path passes on the demo machine on the first attempt with the remediation leg included (SC-008, Principle IV)
- [ ] T119 [P] Capture Chapter 4 implementation screenshots into `docs/`: consent block, action result in chat, approval queue, approval confirmation, audit view with filters, per-ticket action history, kill switch with the disabled banner, and the metrics surface including its no-data state (Principle V)
- [ ] T120 [P] Add named Chapter 4.6 sample-code excerpts to `docs/` for the policy engine's default-deny path, the executor's structured-parameter connection, and the audit model's immutability hooks (Principle V)
- [ ] T121 [P] Update the architecture, sequence, and ERD/schema diagrams in `docs/` for the three new collections, the two policy files, and the plan → act → observe loop (Principle V)
- [ ] T122 [P] Generate Chapter 5 TC tables from the new suites via `npm --prefix backend run tc-tables` and file the output in `docs/`
- [ ] T123 [P] Update `README.md` — How to use, Troubleshooting, configuration, API, and roadmap — for the container prerequisite, the new environment variables, the new endpoints, and the remediation feature
- [ ] T124 Run the impeccable refinement sequence on every changed frontend file: `critique → layout → colorize → typeset → polish → audit`, then the taste §14 pre-flight, then `node "%USERPROFILE%/.claude/skills/impeccable/scripts/detect.mjs" --json <changed files>` and address the findings (before_implement hook)
- [ ] T125 Audit every new user-visible string for em-dashes and remove them, including the test-account disclosure and the no-data message (Design Direction, taste §9.G)
- [ ] T126 [P] Verify accessibility on the new surfaces: WCAG AA contrast on the outcome vocabulary, keyboard operability of the approval queue and its confirmation step, and `prefers-reduced-motion` honoured on every new transition
- [ ] T127 Run all quality gates: `npm --prefix backend run typecheck`, `lint`, `test`, and the same three for `frontend`, and confirm no file exceeds 500 lines
- [ ] T128 Run `graphify update .` to refresh the knowledge graph after implementation
- [ ] T129 Remove the stray zero-byte files in `frontend/` (`draft.length`, `m.author`, `m.text.includes(ticket.reference)`, `{,`, `{,+`) left by mis-redirected shell commands
- [ ] T130 Run `/speckit-constitution` to strike Compliance Debt Register entries **CD-1** and **CD-2**, citing the closing evidence: `chained-provider.test.ts` and the preserved `degradation.test.ts` for CD-1, and the policy engine, executor, registry, tool registry, and audit suites plus the passing remediation demo leg for CD-2. Per Governance, this runs **after** the evidence exists, never on intent

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T008 and T009 are refactors that must land before any new UI.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story.**
- **US1 (Phase 3)**: depends on Foundational. No dependency on other stories.
- **US2 (Phase 4)**: depends on Foundational. Independently testable; in practice most of its
  guarantee is already provable once Phase 2 lands, and this phase makes it visible and
  replaces the blanket refusal.
- **US3 (Phase 5)**: depends on Foundational and on the executor from US1 (T038). This is the
  one genuine cross-story dependency and it is deliberate: state-changing power is only safe
  once the read-only path and default-deny are proven.
- **US4 (Phase 6)**: depends on Foundational; the approval queue portion depends on US3's
  approval lifecycle (T070, T071). The audit view and kill switch do not.
- **US5 (Phase 7)**: depends on Foundational only. Fully parallelisable with US3 and US4.
- **US6 (Phase 8)**: depends on Foundational only. Fully parallelisable with everything from
  US1 onward, except T115 which touches the policy engine.
- **Polish (Phase 9)**: depends on all desired stories being complete.

### Within Each Story

- Safety-critical tests are written and **failing** before their implementation task.
- Policy data before the loader; the loader before the engine; the engine before the executor
  is ever called.
- Models before services, services before routes, routes before UI.

### Parallel Opportunities

- Phase 1: T002 through T007 are all parallel.
- Phase 2: T010 and T011 in parallel; T014 and T015 in parallel; T026 through T030 in parallel.
- Phase 3: all six test tasks T032 through T037 in parallel; the six read-only tools in T040
  are parallel with each other.
- Phase 4: T052 through T056 in parallel.
- Phase 5: T063 through T069 in parallel; T072 and T073 in parallel.
- Phase 6: T084 through T088 in parallel.
- Phase 7: T099 through T101 in parallel.
- Phase 8: T108 through T110 in parallel.
- Phase 9: T119 through T123 and T126 in parallel.
- Across stories: US5 and US6 can run alongside US3 and US4 entirely.

---

## Parallel Example: User Story 1

```bash
# All six failing tests for US1 together:
Task: "Executor unit tests in backend/tests/unit/executor.test.ts"
Task: "Diagnostic happy path in backend/tests/integration/remediation-diagnostic.test.ts"
Task: "Endpoint failure in backend/tests/integration/remediation-endpoint-failure.test.ts"
Task: "Agent loop bounds in backend/tests/unit/agent-loop.test.ts"
Task: "Guided step order in backend/tests/integration/guided-step-order.test.ts"
Task: "ConsentBlock in frontend/tests/components/ConsentBlock.test.tsx"

# All six read-only tools together (T040):
Task: "account_status tool in backend/src/services/agent/tools/account-status.ts"
Task: "network_probe tool in backend/src/services/agent/tools/network-probe.ts"
Task: "print_queue_status tool in backend/src/services/agent/tools/print-queue-status.ts"
Task: "peripheral_list tool in backend/src/services/agent/tools/peripheral-list.ts"
Task: "service_status tool in backend/src/services/agent/tools/service-status.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 Setup.
2. Phase 2 Foundational — the safety spine, and the largest single block of work here.
3. Phase 3 US1.
4. **Stop and validate**: run the US1 scenarios in quickstart.md against the containers.
5. This is already demoable and already closes the missing leg of the demo path in read-only
   form.

### Incremental Delivery

1. Setup + Foundational → nothing can execute, but everything that decides whether it may exists.
2. US1 → read-only diagnostics work end to end. **MVP.**
3. US2 → default-deny is visible and the blanket refusal is replaced.
4. US3 → state-changing actions under tiered authorisation. O-3 complete.
5. US4 → oversight, audit, and override.
6. US5 → metrics. FR-9 fully delivered.
7. US6 → provider chain. CD-1 closed.
8. Polish → evidence, gates, and the constitution amendment.

### Sequencing Note

US1 and US2 look reorderable but are not, quite. US2's guarantee is *built* in Phase 2 and
*demonstrated* in Phase 4, which is why the safety spine sits in Foundational rather than
inside US1. Nothing in US1 can execute without passing through the default-deny engine that
Phase 2 delivers, so the P1-before-P2 ordering never means capability arriving ahead of its
constraint.

---

## Notes

- `[P]` means different files with no dependency on an incomplete task.
- Safety-critical tests must be observed failing before their implementation lands. A test
  that passes on first write is evidence of a test that does not test anything.
- Commit after each task or logical group. The developer performs commits; no AI attribution
  in any commit, document, or published artifact.
- Stop at any checkpoint to validate the story independently.
- After every code change, `graphify update .` keeps the knowledge graph current.
