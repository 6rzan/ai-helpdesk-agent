# Tasks: Staff Dashboard & User Accounts

**Input**: Design documents from `/specs/004-staff-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: REQUIRED for every feature (Constitution Principle IV). Safety-critical components here are the **access-control middleware** (`requireAuth`/`requireStaff`, ownership checks — SC-003) and the **takeover/assignment concurrency logic**: their test tasks precede implementation and must FAIL first. All other stories ship tests in the same phase. Test names map to Chapter 5 TC-table format.

**Organization**: Tasks grouped by user story (US1–US5 from spec.md) so each story is independently implementable, testable, and demoable. Frontend tasks follow the Design Direction in plan.md; the `before_implement` hook re-invokes `/frontend-design-pro build` at implementation time.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 for user-story phases; Setup/Foundational/Polish tasks carry no story label
- Exact file paths in every description

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency additions — the repo structure already exists (features 001–003)

- [X] T001 [P] Add `exceljs` dependency to backend/package.json (`npm install exceljs` in backend/)
- [X] T002 [P] Add `react-router-dom` (v7) dependency to frontend/package.json (`npm install react-router-dom` in frontend/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Accounts, sessions, role middleware, and the role-gated SPA shell — every story needs sign-in (staff or user) to exist first

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create UserAccount Mongoose model per data-model.md (email unique CI index, role, scrypt hash/salt fields, `usingInitialPassword`, `availability`) in backend/src/models/user-account.ts
- [X] T004 [P] Create AuthSession Mongoose model (tokenHash unique, accountId, TTL index on expiresAt) in backend/src/models/auth-session.ts
- [X] T005 [P] Implement scrypt password service (hash, timing-safe verify — research R2) in backend/src/services/auth/password-service.ts with unit tests in backend/tests/unit/password-service.test.ts
- [X] T006 Implement session service (issue opaque cookie token, resolve to fresh account read, rolling expiry, invalidate-all-for-account) in backend/src/services/auth/session-service.ts
- [X] T007 [P] Write FAILING access-control integration tests (safety-critical, test-first — SC-003): signed-out → 401 no data; regular user on staff routes → 403 no data; role revoked mid-session refused on next action; in backend/tests/integration/access-control.test.ts
- [X] T008 Implement requireAuth and requireStaff middleware (per-request account re-read) in backend/src/api/middleware/require-auth.ts and backend/src/api/middleware/require-staff.ts until T007 passes
- [X] T009 Implement auth routes POST /auth/register, /auth/login, /auth/logout, GET /auth/me, POST /auth/change-password (zod-validated per contracts/api.md; change-password flips `usingInitialPassword`, invalidates other sessions) in backend/src/api/routes/auth.ts, mounted in backend/src/app.ts
- [X] T010 Auth integration tests (duplicate email → 409 plain message, wrong password → 401 without account-existence leak, password-change session invalidation) in backend/tests/integration/auth.test.ts
- [X] T011 [P] Create maintainer seed script for staff accounts (email + initial password, FR-002/research R10) in backend/src/scripts/seed-staff.ts with `seed:staff` npm script in backend/package.json
- [X] T012 [P] Extend frontend API client with `credentials: 'include'` and auth endpoints, plus account types, in frontend/src/services/api.ts and frontend/src/lib/types.ts
- [X] T013 Create AuthProvider context (loads GET /auth/me once, exposes account + role) in frontend/src/context/AuthContext.tsx
- [X] T014 Add router shell per plan.md route map: BrowserRouter, RequireAuth/RequireStaff guard routes, top nav (≤64px per Design Direction), LoginPage and RegisterPage — frontend/src/App.tsx, frontend/src/components/AppNav.tsx, frontend/src/pages/LoginPage.tsx, frontend/src/pages/RegisterPage.tsx (chat stays the default route; existing ChatPage tests stay green)
- [X] T015 Frontend auth tests (login/register flows, guard redirect, clear refusal for non-staff on /staff) in frontend/tests/pages/auth.test.tsx

**Checkpoint**: Sign-in works for seeded staff and self-registered users; role gating enforced and tested — user stories can begin

---

## Phase 3: User Story 1 - Staff Sign In and Manage Tickets on the Dashboard (Priority: P1) 🎯 MVP

**Goal**: Role-gated dashboard listing all tickets with filter/sort, full-context ticket detail, status update/resolve with attribution, live list updates (FR-004–FR-009, FR-014)

**Independent Test**: Sign in as seeded staff, view tickets created through existing chat, open one, resolve it; reporter's chat reflects it ≤5 s; a non-staff account is refused (quickstart US1)

### Tests for User Story 1 (REQUIRED — write first) ⚠️

- [X] T016 [P] [US1] Write FAILING integration tests for staff ticket operations: list with status/category filters + sort, detail aggregation (conversation, classification, attempted steps, status history), status change + resolve with StaffActionRecord attribution, legacy no-account marker, non-staff refusal — backend/tests/integration/staff-tickets.test.ts
- [X] T017 [P] [US1] Write FAILING integration test for live propagation: staff SSE stream receives ticket created/updated events; reporter conversation receives plain-language status message on staff resolve (FR-009) — backend/tests/integration/staff-events.test.ts

### Implementation for User Story 1

- [X] T018 [P] [US1] Extend Ticket model with optional `reporterAccountId` (legacy tickets remain valid — FR-014) in backend/src/models/ticket.ts
- [X] T019 [P] [US1] Create StaffActionRecord append-only model per data-model.md in backend/src/models/staff-action.ts
- [X] T020 [US1] Implement staff ticket service (list/filter/sort, detail aggregation across conversation + guided steps + status history, status changes through existing state machine, attribution records) in backend/src/services/staff/staff-ticket-service.ts
- [X] T021 [US1] Implement staff routes GET /staff/tickets, GET /staff/tickets/:id, POST /staff/tickets/:id/status (zod-validated, behind requireStaff, per contracts/api.md) in backend/src/api/routes/staff-tickets.ts, mounted in backend/src/app.ts
- [X] T022 [US1] Extend SSE event bus with staff stream (GET /api/staff/events behind requireStaff) publishing ticket created/updated events in backend/src/api/sse/event-bus.ts
- [X] T023 [US1] Add plain-language reporter notification templates for staff status changes and resolution (reuse existing path) in backend/src/services/ticket/notifications.ts
- [X] T024 [P] [US1] Add staff ticket types + API functions and staff-stream support to frontend/src/lib/types.ts, frontend/src/services/api.ts, frontend/src/services/useEvents.ts (existing hook signature stays compatible)
- [X] T025 [US1] Build DashboardPage per Design Direction: dense ticket table (rows, hairline dividers, tabular-nums), escalated tickets pinned in distinct amber-marked group (FR-005), filter/sort toolbar, live updates with row-update pulse, skeleton loader, teaching empty state — frontend/src/pages/DashboardPage.tsx (reuse frontend/src/components/StatusBadge.tsx)
- [X] T026 [US1] Build TicketDetailPage: two-column layout (transcript left; status history + actions right), status update/resolve actions with full interactive states — frontend/src/pages/TicketDetailPage.tsx
- [X] T027 [P] [US1] Frontend tests for dashboard list/filter/live-update and detail actions in frontend/tests/pages/dashboard.test.tsx
- [X] T028 [US1] Capture documentation evidence (dashboard + detail screenshots, TC-table rows for T016/T017 suites) into docs/ (Principle V)

**Checkpoint**: US1 fully functional — the support loop closes (MVP)

---

## Phase 4: User Story 2 - Take Over an Escalated Ticket with the Reporter's Profile at Hand (Priority: P2)

**Goal**: Takeover/reassignment with attribution, conflict safety, availability + suggested assignee, automatic profile surfacing on escalated tickets (FR-005, FR-007, FR-013, FR-019–FR-021)

**Independent Test**: Escalate a ticket via chat (profile on file), take it over from the dashboard, reassign it; reporter sees named handler ≤5 s; concurrent second takeover cleanly rejected (quickstart US2)

### Tests for User Story 2 (REQUIRED — write first) ⚠️

- [X] T029 [P] [US2] Write FAILING integration tests for assignment (safety-critical concurrency, test-first): takeover sets human mode + attribution + reporter notification; concurrent takeover → 409 with current assignee (US2-5); reassign appends history, never back to agent (FR-019); roster returns availability + open-case counts + advisory suggestion (FR-021) — backend/tests/integration/takeover.test.ts
- [X] T030 [P] [US2] Write FAILING integration test for profile surfacing: escalated ticket detail includes reporter profile automatically; explicit `profile: null` when none exists (FR-013) — backend/tests/integration/ticket-profile.test.ts

### Implementation for User Story 2

- [X] T031 [P] [US2] Create SupportProfile Mongoose model (user fields + append-only staffEntries per data-model.md) in backend/src/models/support-profile.ts
- [X] T032 [US2] Extend Ticket model with `assignee` + `assignmentHistory` in backend/src/models/ticket.ts and enforce one-way human handling mode (no transition back to automated) in backend/src/services/ticket/state-machine.ts
- [X] T033 [US2] Implement assignment service: atomic conditional takeover/reassign via findOneAndUpdate precondition (research R6), roster aggregation with open-case counts + suggested assignee (research R7), availability update — backend/src/services/staff/assignment-service.ts
- [X] T034 [US2] Add routes POST /staff/tickets/:id/takeover, POST /staff/tickets/:id/assignee (409 on precondition mismatch), GET /staff/roster, PUT /staff/availability in backend/src/api/routes/staff-tickets.ts and backend/src/api/routes/staff-roster.ts
- [X] T035 [US2] Wire profile into ticket detail response (backend/src/services/staff/staff-ticket-service.ts), publish assignment SSE events (backend/src/api/sse/event-bus.ts), and add plain-language "named person is handling your case" reporter notifications for takeover/reassignment (backend/src/services/ticket/notifications.ts) (FR-009, FR-020)
- [X] T036 [P] [US2] Build ProfilePanel (fields or explicit "No profile on file") and AssigneePicker popover (availability dot = the one semantic dot, open-case count, suggested default preselected, explicit confirm — never auto-assign) in frontend/src/components/ProfilePanel.tsx and frontend/src/components/AssigneePicker.tsx
- [X] T037 [US2] Integrate takeover/reassign actions, conflict (409) handling UI, and ProfilePanel into frontend/src/pages/TicketDetailPage.tsx; add staff availability selector to frontend/src/components/AppNav.tsx
- [X] T038 [P] [US2] Frontend tests for takeover flow, conflict message, picker suggestion, profile panel states in frontend/tests/pages/TicketDetailAssignment.test.tsx
- [X] T039 [US2] Capture documentation evidence (takeover/reassignment screenshots, takeover sequence diagram for Chapter 4, TC rows) into docs/

**Checkpoint**: Escalation handling end-to-end — dashboard's reason to exist is demoable

---

## Phase 5: User Story 3 - Users Sign In and Follow Their Own Tickets (Priority: P3)

**Goal**: New conversations require sign-in; tickets are account-linked; users see all and only their own tickets with live status and current handler name (FR-003, FR-010, FR-017 settings, FR-020 reporter view)

**Independent Test**: Register, report an issue, see the ticket under "my tickets" with live status; a second account cannot see it; sign in next day → history intact (quickstart US3)

### Tests for User Story 3 (REQUIRED — write first) ⚠️

- [X] T040 [P] [US3] Write FAILING integration tests (ownership is safety-relevant, test-first): starting a conversation without a session cookie → 401 (FR-003); created ticket carries reporterAccountId; GET /my/tickets returns only own tickets; another user's ticket by id → 403 no data; staff update visible in owner's ticket view — backend/tests/integration/my-tickets.test.ts

### Implementation for User Story 3

- [X] T041 [US3] Add optional `accountId` to Conversation model (backend/src/models/conversation.ts) and require a signed-in session for new session/conversation creation, linking conversation + ticket to the account — backend/src/api/routes/sessions.ts and backend/src/services/conversation/conversation-service.ts (existing anonymous data stays readable — FR-014)
- [X] T042 [US3] Implement user routes GET /my/tickets and GET /my/tickets/:id (status, handling mode, current handler display name in plain language) in backend/src/api/routes/my.ts, mounted behind requireAuth in backend/src/app.ts
- [X] T043 [US3] Update ChatPage to use the signed-in account identity: remove the anonymous name entry (retire frontend/src/components/SessionForm.tsx), gate chat behind RequireAuth — frontend/src/pages/ChatPage.tsx (voice + guidance test suites must stay green; update mocks in frontend/tests/pages/ChatPage.test.tsx and ChatPage.guidance.test.tsx as needed)
- [X] T044 [US3] Build MyTicketsPage (own tickets, live status via existing SSE stream, handler name per FR-020) in frontend/src/pages/MyTicketsPage.tsx
- [X] T045 [US3] Build SettingsPage with password change form (labels above inputs, inline errors) in frontend/src/pages/SettingsPage.tsx
- [X] T046 [P] [US3] Frontend tests for MyTicketsPage and SettingsPage in frontend/tests/pages/MyTicketsPage.test.tsx and frontend/tests/pages/SettingsPage.test.tsx
- [X] T047 [US3] Capture documentation evidence (registration, my-tickets, settings screenshots, TC rows) into docs/

**Checkpoint**: Every new ticket has an owner; users self-serve status

---

## Phase 6: User Story 4 - Self-Service Profiles with Staff-Appended Details (Priority: P4)

**Goal**: Users maintain support-relevant profile fields; staff view any profile, append attributed notes/corrections (never overwriting), see credential status and re-issue initial passwords (FR-011, FR-012, FR-015, FR-018)

**Independent Test**: User fills profile; staff appends a correction; both appear correctly attributed on the profile and on the user's next escalated ticket (quickstart US4)

### Tests for User Story 4 (REQUIRED — write first) ⚠️

- [X] T048 [P] [US4] Write FAILING integration tests: owner profile read/update limited to the three support fields; other users refused (FR-015); staff append is attributed + timestamped and user fields unchanged (FR-012); owner sees staff entries; credential status returns only `usingInitialPassword`; credential reset re-issues + invalidates sessions + is attributed (FR-018) — backend/tests/integration/profiles.test.ts

### Implementation for User Story 4

- [X] T049 [US4] Implement profile service (own-field updates; append-only staff entries with note/correction kinds; corrections recorded alongside user values) in backend/src/services/profile/profile-service.ts
- [X] T050 [US4] Implement routes GET/PUT /my/profile (backend/src/api/routes/my.ts) and GET /staff/users/:id/profile, POST /staff/users/:id/profile/entries, GET /staff/users/:id/credentials, POST /staff/users/:id/credentials/reset (backend/src/api/routes/staff-users.ts, behind requireStaff, StaffActionRecord on append/reset)
- [X] T051 [US4] Build ProfilePage (self-service form, only support-relevant fields with helper text on why each is asked, staff-appended entries visibly distinct + attributed) in frontend/src/pages/ProfilePage.tsx
- [X] T052 [US4] Build staff UserProfilePage (view profile, append note/correction, credential status + re-issue with inline confirm) in frontend/src/pages/staff/UserProfilePage.tsx, linked from the reporter block in frontend/src/pages/staff/TicketDetailPage.tsx
- [X] T053 [P] [US4] Frontend tests for ProfilePage and UserProfilePage in frontend/tests/pages/ProfilePage.test.tsx and frontend/tests/pages/UserProfilePage.test.tsx
- [X] T054 [US4] Capture documentation evidence (profile + staff-append screenshots, TC rows) into docs/

**Checkpoint**: Profile surfacing (US2) now runs on real self-service data

---

## Phase 7: User Story 5 - Bulk-Import Users from an Existing Excel File (Priority: P5)

**Goal**: Staff import users from .xlsx with column→field mapping, preview, per-row outcomes, provisioned credentials; existing accounts updated by email (FR-016, FR-017)

**Independent Test**: Import a sample spreadsheet, adjust one mapping, apply, sign in as an imported user with issued credentials (quickstart US5)

### Tests for User Story 5 (REQUIRED — write first) ⚠️

- [X] T055 [P] [US5] Create sample .xlsx fixture (≈10 rows incl. duplicate email + missing-required-value row) in backend/tests/fixtures/users-sample.xlsx and write integration tests: upload returns columns; mapping requires email; preview reports created/updated/rejected with per-row reasons; apply creates accounts with initial passwords, updates existing by email without duplication, rejects invalid rows; unreadable file → 400 before any state; imported user signs in and changes password — backend/tests/integration/imports.test.ts

### Implementation for User Story 5

- [X] T056 [P] [US5] Create ProfileImport Mongoose model with state machine (mapping → previewed → applied / aborted) per data-model.md in backend/src/models/profile-import.ts
- [X] T057 [US5] Implement import service: exceljs workbook parse (research R3), mapping validation, dry-run preview, idempotent apply with email-normalised upsert and provisioned credentials — backend/src/services/import/import-service.ts
- [X] T058 [US5] Implement routes POST /staff/imports (multer upload), PUT /staff/imports/:id/mapping, POST /staff/imports/:id/preview, POST /staff/imports/:id/apply (behind requireStaff, StaffActionRecord on apply) in backend/src/api/routes/staff-imports.ts
- [X] T059 [US5] Build ImportPage with three sequential inline steps per Design Direction (upload → per-column field selects → preview table with outcome chips → apply summary; no wizard modal) in frontend/src/pages/staff/ImportPage.tsx
- [X] T060 [P] [US5] Frontend test for mapping/preview/apply flow in frontend/tests/pages/ImportPage.test.tsx
- [X] T061 [US5] Capture documentation evidence (mapping + preview screenshots, TC rows, SC-007 timing note) into docs/

**Checkpoint**: All five stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T062 Design audit per frontend-design-pro build sequence (critique → polish → audit) across all new pages: full interactive-state coverage (hover/focus/active/disabled/loading/error), WCAG AA contrast, keyboard navigation, `prefers-reduced-motion`, consistent component vocabulary — frontend/src/pages/ and frontend/src/components/
- [X] T063 [P] Update README.md (How to use: accounts + dashboard, Configuration, API summary, Troubleshooting, Roadmap tick for feature 004)
- [X] T064 [P] Update design diagrams for Chapter 4 (ERD/schema with new collections, use-case diagram with staff/user roles) in docs/
- [X] T065 Extend the scripted end-to-end demo path with sign-in → escalation → dashboard takeover → resolve, then run all quality gates: `tsc --noEmit`, lint, full test suites in backend/ and frontend/ (Principle IV release gate)
- [X] T066 Run quickstart.md validation walkthroughs US1–US5 on the demo machine and record outcomes (UAT-ready evidence) in docs/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately
- **Foundational (Phase 2)**: needs Phase 1; **BLOCKS all stories** (every story requires accounts + role gating + router shell)
- **US1 (Phase 3)**: needs Phase 2 only
- **US2 (Phase 4)**: needs Phase 2; builds on US1's dashboard/detail pages (T025/T026) and staff routes (T021)
- **US3 (Phase 5)**: needs Phase 2 only (independent of US1/US2)
- **US4 (Phase 6)**: needs Phase 2; SupportProfile model (T031) already exists if US2 was done first — otherwise pull T031 into US4
- **US5 (Phase 7)**: needs Phase 2 + US4's profile service (T049) for row application
- **Polish (Phase 8)**: after all desired stories

### Within Each Story

- FAILING tests first (T007, T016/T017, T029/T030, T040, T048, T055 precede their implementations)
- Models → services → routes → frontend → frontend tests → evidence

### Parallel Opportunities

- Phase 1: T001 ∥ T002
- Phase 2: T003 ∥ T004 ∥ T005 ∥ T007; then T011 ∥ T012 alongside backend route work
- US1: T016 ∥ T017; T018 ∥ T019; T024 ∥ backend service work; T027 ∥ T028
- US2: T029 ∥ T030; T031 ∥ T032 start; T036 ∥ backend wiring; T038 in parallel with T039
- **US3 can run fully in parallel with US2** (different files, both depend only on Phase 2 + US1 surfaces)
- Polish: T063 ∥ T064

## Parallel Example: User Story 1

```bash
# Failing tests together:
Task: "T016 staff ticket ops tests in backend/tests/integration/staff-tickets.test.ts"
Task: "T017 live-update tests in backend/tests/integration/staff-events.test.ts"

# Models together:
Task: "T018 extend Ticket model in backend/src/models/ticket.ts"
Task: "T019 StaffActionRecord model in backend/src/models/staff-action.ts"
```

## Implementation Strategy

**MVP first (US1)**: Phases 1 → 2 → 3, then STOP and validate via quickstart US1 — this alone turns the agent into a working support loop and is the strongest single demo increment.

**Incremental delivery**: after US1, each story is a self-contained demo increment in priority order (US2 escalation handling → US3 user accounts in chat → US4 profiles → US5 import). The Principle IV demo path must pass at every checkpoint before a supervisor meeting.

## Notes

- Foundational auth is deliberately in Phase 2 (not US3) because staff sign-in (US1) and user sign-in (US3) share it
- T043 touches the shared ChatPage — run the existing voice/guidance suites immediately after (regression risk flagged in plan.md)
- Commit after each task or logical group (developer commits himself — agents suggest messages only)

## Phase 9: Convergence

- [X] T067 CRITICAL refactor `backend/src/services/conversation/conversation-service.ts` into single-responsibility modules of no more than 500 lines while preserving its public behaviour and keeping all conversation, classification, guidance, escalation, voice-origin, and regression tests green per Constitution VI (contradicts)
- [X] T068 CRITICAL expose the complete ticket assignment history and attributed `StaffActionRecord` audit trail through the staff ticket-detail service/API and render it in `frontend/src/pages/TicketDetailPage.tsx`, with backend and frontend tests proving staff can see who performed each action and when, per Constitution III, FR-008, FR-019, and plan: ticket-detail status/assignment history (partial)
- [X] T069 add the guided-troubleshooting attempt block to the `TicketDetail`/`StaffTicketDetail` frontend types and render every attempted instruction, outcome, and timestamp on the staff ticket-detail page, with backend and frontend regression tests, per FR-006 and US1/AC3 (partial)
- [X] T070 reject takeover of `resolved` or `closed` tickets atomically before changing the assignee or handling mode, and add integration tests covering both refused states plus allowed `open`/`in_progress` takeover, per FR-007 (contradicts)

## Phase 10: Convergence

- [X] T071 CRITICAL restore strict backend TypeScript compilation by giving every Mongoose registry export a concrete model type, resolving all resulting source/test errors, and removing the dead imports left in the conversation refactor so `npm run typecheck` and lint complete cleanly per Constitution VI and T065 (contradicts)
- [X] T072 CRITICAL replace the unannotated `any` escape hatches in `backend/src/services/import/import-service.ts` and `frontend/src/pages/staff/ImportPage.tsx` with shared typed import DTOs, and zod-validate upload metadata, import IDs, mappings, and every mapped row before use per Constitution VI and plan: zod boundary validation (contradicts)
- [X] T073 CRITICAL render `assignmentHistory` and the meaningful details of every attributed staff action in `frontend/src/pages/TicketDetailPage.tsx`, preserving actor, assignee, action, and timestamp, with frontend regression tests proving the full trail is visible per Constitution III, FR-019, and T068 (partial)
- [X] T074 CRITICAL configure `MongoMemoryServer` with an effective launch timeout so the full backend suite is reliable, rerun every backend/frontend typecheck, lint, and test gate plus the US1–US5 quickstart walkthroughs, and replace unsupported PASS/environment claims in `docs/feature-004-evidence.md`, `docs/testing/demo-path-log.md`, and `docs/testing/feature-004-uat.md` with dated observed results per Constitution IV, Constitution V, T065, and T066 (contradicts)
- [X] T075 render handling mode plus both creation and last-update times in the staff dashboard table, retain escalated grouping, and add a reduced-motion-safe row update pulse with regression tests for required columns and live refresh per FR-004, US1/AC1, and T025 (partial)
- [X] T076 show an accessible text label for every staff member's Available, Busy, or Away state in `frontend/src/components/AssigneePicker.tsx`, distinguish Busy from Away without relying on an aria-hidden dot, and flag when no staff member is available while keeping assignment advisory per FR-021 and US2/AC7 (partial)
- [X] T077 add an authenticated `/tickets/:reference` user route and own-ticket detail page backed by `getMyTicket`, then replace 5-second polling with live account-scoped ticket updates for both the list and detail views, with ownership and UI tests per FR-009, FR-010, FR-020, US3/AC2–3, and T044 (partial)
- [X] T078 make import apply persist every mapped profile field including `remoteAccessId`, preserve existing values for unmapped fields, reject provided initial passwords shorter than 8 characters with per-row reasons, and add created/updated/rejected integration coverage per FR-016, FR-017, and T057 (partial)
- [X] T079 enforce the forward `ProfileImport` state machine and make apply atomic and idempotent so repeated confirmation cannot duplicate or reject already-applied work and an applied import cannot return to mapping, with concurrency/retry tests per plan: ProfileImport state and T057 (contradicts)
- [X] T080 complete `frontend/src/pages/staff/ImportPage.tsx` so upload, mapping, preview, and apply have loading, disabled, error, and retry states; applied per-row outcomes replace the preview and visibly include generated initial passwords, rejection reasons, and outcome chips; and behavior-focused tests cover the full flow per FR-016, T059, T060, and T062 (partial)
- [X] T081 support adding, editing, and removing multiple tool-labelled remote-access IDs in the self-service profile without collapsing the stored array, with persistence and rendering tests per FR-011, US4/AC1, and T051 (partial)

## Phase 11: Convergence

- [X] T082 materialize `ProfileImport.rowOutcomes` Mongoose subdocuments into typed plain outcomes before apply so rejected rows retain their `outcome`, are skipped instead of processed as accounts, and remain in the response while valid rows still apply; add regression assertions that rejected rows never create or update accounts and the apply route returns 200 with the complete per-row report per FR-016, US5/AC3, T055, and plan: ProfileImport rowOutcomes (contradicts)

## Phase 12: Convergence

- [X] T083 CRITICAL zod-validate the complete multer upload boundary in `backend/src/api/routes/staff-imports.ts` (file presence, original name, MIME/type metadata, buffer, and import ID inputs), return the API contract's 400 validation response for missing or invalid upload metadata instead of an unhandled 500, and add route regression tests per Constitution VI, plan: zod boundary validation, and T072 (contradicts)
- [X] T084 CRITICAL re-establish a reproducible default backend `npm test` release gate on the Windows demo machine, record a dated clean run with the actual discovered file/test counts, correct stale `211 tests`/`79 files` claims, and actually execute and document the quickstart US1-US5 walkthroughs rather than describing them as pending manual activities per Constitution IV, Constitution V, T065, T066, and T074 (contradicts)
- [X] T085 CRITICAL add frontend regression tests that supply and render complete `assignmentHistory` and `staffActions` data in `frontend/src/pages/TicketDetailPage.tsx`, asserting actor/staff name, action, assignee, meaningful details, and timestamps per Constitution IV, Constitution III, FR-008, FR-019, and T073 (partial)
- [X] T086 CRITICAL add frontend regression tests for the staff dashboard's handling-mode, created-time, and updated-time columns plus escalated grouping and the reduced-motion-safe row pulse triggered by a live `ticket_updated` event per Constitution IV, FR-004, US1/AC1, and T075 (partial)
- [X] T087 CRITICAL add accessible AssigneePicker regression tests proving Available, Busy, and Away are text-distinguishable, open-case counts and the advisory suggestion remain visible, and the no-available-staff warning still permits manual assignment per Constitution IV, FR-021, US2/AC7, and T076 (partial)
- [X] T088 CRITICAL add backend and frontend regression coverage for the authenticated own-ticket detail route and account-scoped SSE refresh, proving the owner sees status/handling mode/current handler updates without delay while another account receives no detail or events per Constitution IV, FR-009, FR-010, FR-020, US3/AC2-3, and T077 (partial)
- [X] T089 CRITICAL add frontend and persistence regression tests for adding, editing, removing, saving, and reloading multiple tool-labelled remote-access IDs without collapsing the stored array per Constitution IV, FR-011, US4/AC1, and T081 (partial)
- [X] T090 remove the conflicting simultaneous `$setOnInsert.remoteAccessIds` and `$addToSet.remoteAccessIds` update when importing a new profile, then add integration coverage for mapped remote-access IDs, updated existing accounts, preservation of unmapped profile fields, short initial-password rejection, issued-credential sign-in/password change, and created/updated/rejected outcomes per FR-016, FR-017, US5/AC3-4, and T078 (contradicts)
- [X] T091 make import apply atomic and recoverably idempotent across mid-apply failure and concurrent confirmation so no partial account/profile writes become permanently locked by `appliedAt`, and add failure-injection, concurrency, first-retry, and post-success retry tests that preserve stored outcomes and generated initial passwords per plan: ProfileImport state and T079 (contradicts)
- [X] T092 implement explicit upload/mapping/preview/applying/applied/error states in `frontend/src/pages/staff/ImportPage.tsx` so preview rows are not labelled as applied, Apply is unavailable after success, retries resume the correct failed step, and generated passwords, rejection reasons, and outcome chips replace the preview only after apply; cover the complete interaction flow with behavior-focused tests per FR-016, T059, T060, T062, and T080 (partial)

## Phase 13: Convergence

- [X] T093 CRITICAL execute and document the complete quickstart US1-US5 walkthrough on the demo machine, including live US1 resolution and reporter update, US2 reassignment/conflict handling, and US3 cross-account refusal; reconcile the stale import-blocked introduction and all pending/manual claims with the observed replica-set Apply result per Constitution IV, T065, T066, and T084 (partial)
- [X] T094 CRITICAL preserve the Feature 004 browser evidence inside `docs/` and link implementation evidence for registration, own tickets, settings/password change, self-service profile, staff-appended profile details, and the Excel upload/mapping/preview/apply flow instead of referencing transient `C:\tmp` files per Constitution V, T047, T054, and T066 (missing)
- [X] T095 provide a reproducible single-node MongoDB replica-set setup for the local demo environment and update `.env.example`, `README.md`, `specs/004-staff-dashboard/quickstart.md`, and troubleshooting guidance so the documented default configuration supports transactional Excel import Apply; verify the full US5 flow under that documented setup per FR-016, plan: Target Platform and Constraints, T063, and T091 (contradicts)
