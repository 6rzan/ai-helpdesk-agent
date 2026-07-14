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

- [ ] T040 [P] [US3] Write FAILING integration tests (ownership is safety-relevant, test-first): starting a conversation without a session cookie → 401 (FR-003); created ticket carries reporterAccountId; GET /my/tickets returns only own tickets; another user's ticket by id → 403 no data; staff update visible in owner's ticket view — backend/tests/integration/my-tickets.test.ts

### Implementation for User Story 3

- [ ] T041 [US3] Add optional `accountId` to Conversation model (backend/src/models/conversation.ts) and require a signed-in session for new session/conversation creation, linking conversation + ticket to the account — backend/src/api/routes/sessions.ts and backend/src/services/conversation/conversation-service.ts (existing anonymous data stays readable — FR-014)
- [ ] T042 [US3] Implement user routes GET /my/tickets and GET /my/tickets/:id (status, handling mode, current handler display name in plain language) in backend/src/api/routes/my.ts, mounted behind requireAuth in backend/src/app.ts
- [ ] T043 [US3] Update ChatPage to use the signed-in account identity: remove the anonymous name entry (retire frontend/src/components/SessionForm.tsx), gate chat behind RequireAuth — frontend/src/pages/ChatPage.tsx (voice + guidance test suites must stay green; update mocks in frontend/tests/pages/ChatPage.test.tsx and ChatPage.guidance.test.tsx as needed)
- [ ] T044 [US3] Build MyTicketsPage (own tickets, live status via existing SSE stream, handler name per FR-020) in frontend/src/pages/MyTicketsPage.tsx
- [ ] T045 [US3] Build SettingsPage with password change form (labels above inputs, inline errors) in frontend/src/pages/SettingsPage.tsx
- [ ] T046 [P] [US3] Frontend tests for MyTicketsPage and SettingsPage in frontend/tests/pages/MyTicketsPage.test.tsx and frontend/tests/pages/SettingsPage.test.tsx
- [ ] T047 [US3] Capture documentation evidence (registration, my-tickets, settings screenshots, TC rows) into docs/

**Checkpoint**: Every new ticket has an owner; users self-serve status

---

## Phase 6: User Story 4 - Self-Service Profiles with Staff-Appended Details (Priority: P4)

**Goal**: Users maintain support-relevant profile fields; staff view any profile, append attributed notes/corrections (never overwriting), see credential status and re-issue initial passwords (FR-011, FR-012, FR-015, FR-018)

**Independent Test**: User fills profile; staff appends a correction; both appear correctly attributed on the profile and on the user's next escalated ticket (quickstart US4)

### Tests for User Story 4 (REQUIRED — write first) ⚠️

- [ ] T048 [P] [US4] Write FAILING integration tests: owner profile read/update limited to the three support fields; other users refused (FR-015); staff append is attributed + timestamped and user fields unchanged (FR-012); owner sees staff entries; credential status returns only `usingInitialPassword`; credential reset re-issues + invalidates sessions + is attributed (FR-018) — backend/tests/integration/profiles.test.ts

### Implementation for User Story 4

- [ ] T049 [US4] Implement profile service (own-field updates; append-only staff entries with note/correction kinds; corrections recorded alongside user values) in backend/src/services/profile/profile-service.ts
- [ ] T050 [US4] Implement routes GET/PUT /my/profile (backend/src/api/routes/my.ts) and GET /staff/users/:id/profile, POST /staff/users/:id/profile/entries, GET /staff/users/:id/credentials, POST /staff/users/:id/credentials/reset (backend/src/api/routes/staff-users.ts, behind requireStaff, StaffActionRecord on append/reset)
- [ ] T051 [US4] Build ProfilePage (self-service form, only support-relevant fields with helper text on why each is asked, staff-appended entries visibly distinct + attributed) in frontend/src/pages/ProfilePage.tsx
- [ ] T052 [US4] Build staff UserProfilePage (view profile, append note/correction, credential status + re-issue with inline confirm) in frontend/src/pages/staff/UserProfilePage.tsx, linked from the reporter block in frontend/src/pages/staff/TicketDetailPage.tsx
- [ ] T053 [P] [US4] Frontend tests for ProfilePage and UserProfilePage in frontend/tests/pages/ProfilePage.test.tsx and frontend/tests/pages/UserProfilePage.test.tsx
- [ ] T054 [US4] Capture documentation evidence (profile + staff-append screenshots, TC rows) into docs/

**Checkpoint**: Profile surfacing (US2) now runs on real self-service data

---

## Phase 7: User Story 5 - Bulk-Import Users from an Existing Excel File (Priority: P5)

**Goal**: Staff import users from .xlsx with column→field mapping, preview, per-row outcomes, provisioned credentials; existing accounts updated by email (FR-016, FR-017)

**Independent Test**: Import a sample spreadsheet, adjust one mapping, apply, sign in as an imported user with issued credentials (quickstart US5)

### Tests for User Story 5 (REQUIRED — write first) ⚠️

- [ ] T055 [P] [US5] Create sample .xlsx fixture (≈10 rows incl. duplicate email + missing-required-value row) in backend/tests/fixtures/users-sample.xlsx and write FAILING integration tests: upload returns columns; mapping requires email; preview reports created/updated/rejected with per-row reasons; apply creates accounts with initial passwords, updates existing by email without duplication, rejects invalid rows; unreadable file → 400 before any state; imported user signs in and changes password — backend/tests/integration/imports.test.ts

### Implementation for User Story 5

- [ ] T056 [P] [US5] Create ProfileImport Mongoose model with state machine (mapping → previewed → applied / aborted) per data-model.md in backend/src/models/profile-import.ts
- [ ] T057 [US5] Implement import service: exceljs workbook parse (research R3), mapping validation, dry-run preview, idempotent apply with email-normalised upsert and provisioned credentials — backend/src/services/import/import-service.ts
- [ ] T058 [US5] Implement routes POST /staff/imports (multer upload), PUT /staff/imports/:id/mapping, POST /staff/imports/:id/preview, POST /staff/imports/:id/apply (behind requireStaff, StaffActionRecord on apply) in backend/src/api/routes/staff-imports.ts
- [ ] T059 [US5] Build ImportPage with three sequential inline steps per Design Direction (upload → per-column field selects → preview table with outcome chips → apply summary; no wizard modal) in frontend/src/pages/staff/ImportPage.tsx
- [ ] T060 [P] [US5] Frontend test for mapping/preview/apply flow in frontend/tests/pages/ImportPage.test.tsx
- [ ] T061 [US5] Capture documentation evidence (mapping + preview screenshots, TC rows, SC-007 timing note) into docs/

**Checkpoint**: All five stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T062 Design audit per frontend-design-pro build sequence (critique → polish → audit) across all new pages: full interactive-state coverage (hover/focus/active/disabled/loading/error), WCAG AA contrast, keyboard navigation, `prefers-reduced-motion`, consistent component vocabulary — frontend/src/pages/ and frontend/src/components/
- [ ] T063 [P] Update README.md (How to use: accounts + dashboard, Configuration, API summary, Troubleshooting, Roadmap tick for feature 004)
- [ ] T064 [P] Update design diagrams for Chapter 4 (ERD/schema with new collections, use-case diagram with staff/user roles) in docs/
- [ ] T065 Extend the scripted end-to-end demo path with sign-in → escalation → dashboard takeover → resolve, then run all quality gates: `tsc --noEmit`, lint, full test suites in backend/ and frontend/ (Principle IV release gate)
- [ ] T066 Run quickstart.md validation walkthroughs US1–US5 on the demo machine and record outcomes (UAT-ready evidence) in docs/

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
