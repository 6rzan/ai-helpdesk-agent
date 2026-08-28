# Tasks: Maintainer Admin Console & Staff-Authoritative Account Editing

**Input**: Design documents from `/specs/007-admin-console-account-editing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md),
[DESIGN-DIRECTION.md](DESIGN-DIRECTION.md)

**Tests**: Tests are MANDATORY for every task (Constitution Principle IV) — every implementation task
ships with its automated tests in the same task; no task is complete with untested behaviour. Two
areas are **test-first** per `research.md` R13, and their failing-test tasks are listed before their
implementation tasks: (1) the maintainer sign-in throttle and refused-attempt record (an
authentication control on a shared secret, and the substance of SC-011), and (2) the non-staff
refusals on the directory and profile routes (SC-006 claims 100%, and a 100% claim needs a test that
fails when the guard is removed).

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — Setup, Foundational, and Polish tasks carry no story label
- Every task names its exact file path

## Path Conventions

Web application, existing structure (plan.md → Project Structure): `backend/src/`, `backend/tests/`,
`frontend/src/`, `frontend/tests/`, `docs/`, `.specify/`. No new top-level directory and no second
build target.

---

## Phase 1: Setup & Governance Gates

**Purpose**: Clear the two constitutional gate conditions, record the green baseline, and add the two
configuration settings the throttle needs.

**⚠️ T001 and T002 are gate conditions from `plan.md` Complexity Tracking. No implementation task
(T006 onward) may start until both are recorded.**

- [X] T001 Record the outcome of gate condition **G1** (Principle I / Governance — supervisor agreement that this feature is an enhancement to IR FR-2 and FR-9 rather than a scope breach) in the Risks section of `specs/007-admin-console-account-editing/spec.md`, in `docs/testing/observations.md`, and on the next supervisor log sheet. The record MUST state the date, the supervisor's decision either way, and **that the agreement covers the specification, plan, and tasks already produced on 2026-08-28 — not only the implementation**: Principle VII's remaining-order clause says nothing may be specified ahead of the refining phase without agreement, and 007 was specified while 006 was still in progress. If agreement is refused, this feature's artifacts are withdrawn or parked by dated decision rather than left specified and unimplemented
- [X] T002 Clear gate condition **G2** by running `/speckit-constitution` to declare increment 7 with its requirement tracing in the Principle VII delivery record and reconcile the clause naming the refining phase as next and last, updating `.specify/memory/constitution.md` with a MINOR version bump and a refreshed Sync Impact Report
- [X] T003 Record the Gate 0 green baseline by running `npm run typecheck`, `npm run lint`, and `npm test` in both `backend/` and `frontend/`, and noting the result, the date, and **the commit SHA the baseline was taken at** in `docs/testing/observations.md` — T046 diffs against that SHA to enumerate the changed frontend files (quickstart.md Gate 0 — a scenario result recorded on a failing tree is not evidence)
- [X] T004 Add `MAINTAINER_SIGNIN_MAX_FAILURES` (default 5) and `MAINTAINER_SIGNIN_COOLDOWN_SECONDS` (default 300) to the zod-validated config in `backend/src/config/index.ts`, with coverage for both defaults and both overrides in `backend/tests/unit/config.test.ts`
- [X] T005 [P] Document both new settings with their committed defaults and a one-line explanation in `.env.example`

**Checkpoint**: Governance gates recorded, baseline green, throttle configuration available.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one module every story touches. `frontend/src/lib/types.ts` has the highest blast
radius in this feature (DESIGN-DIRECTION.md — shared component risk), so it is widened once here
rather than three times inside three stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Extend `frontend/src/lib/types.ts` with the shared shapes from `contracts/api.md`: `FieldState` (`setByKind`, `setById`, `setByName`, `setAt`, `controlledBy`, all nullable for pre-feature profiles), `SupportProfileView.fieldState`, `ProfileFieldHistoryEntry` (with `previousValue` typed per field — string for `location`/`hardware`, `{tool,id}[]` for `remoteAccessIds`), the per-field outcome map types (`applied` | `conflict` | `locked`), `AccountDirectoryEntry`, and the maintainer category and guide-version view types
- [X] T007 Update every consumer of the widened profile types so the tree typechecks with **no behaviour change** — `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/staff/UserProfilePage.tsx`, `frontend/src/components/ProfilePanel.tsx`, `frontend/src/pages/TicketDetailPage.tsx`, `frontend/src/services/api.ts` — keeping `frontend/tests/pages/ProfilePage.test.tsx`, `frontend/tests/pages/UserProfilePage.test.tsx`, and `frontend/tests/pages/auth.test.tsx` green

**Checkpoint**: Shared types in place; US1, US2, and US3 can now proceed in parallel.

---

## Phase 3: User Story 1 - The maintainer administers categories and guides from a screen (Priority: P1) 🎯 MVP

**Goal**: Convert the existing category and guide administration — today reachable only by
hand-crafting requests with two custom headers — into a usable screen at `/maintainer`, and add the
enabled-status probe, sign-in throttle, and refused-attempt record that the screen needs to refuse
correctly in three distinct ways.

**Independent Test**: Start the system with `MAINTAINER_KEY` set, open `/maintainer`, sign in with
the key and a name, and complete a create → edit → publish → history → retire cycle entirely through
the interface; confirm the resulting categories and guide versions are the ones the troubleshooting
flow serves, and that the six mandated categories offer no retire action at all.

### Tests for User Story 1 (MANDATORY — Constitution Principle IV) ⚠️

> **T008 and T009 are TEST-FIRST (`research.md` R13). Write them, watch them FAIL, then implement
> T011–T013.**

- [X] T008 [P] [US1] Test-first unit tests for the sign-in throttle in `backend/tests/unit/maintainer-signin-throttle.test.ts`: count derived from the collection rather than an in-memory counter, the count is time-windowed by `MAINTAINER_SIGNIN_COOLDOWN_SECONDS`, remaining cooling-off seconds are computed from the oldest in-window refusal, a successful sign-in writes nothing, and the record shape has **no field capable of holding the supplied key** (FR-035)
- [X] T009 [P] [US1] Test-first integration tests for maintainer sign-in refusal in `backend/tests/integration/maintainer-signin.test.ts`: a wrong key returns `401 MAINTAINER_KEY_INVALID` with a **byte-identical message** for keys of different lengths and shapes (FR-004), a blank name returns `400 MAINTAINER_NAME_REQUIRED`, the configured number of refusals then returns `429 MAINTAINER_SIGNIN_THROTTLED` with `retryAfterSeconds`, the `429` is returned **before** the key is compared so the throttle cannot be used as an oracle, one `MaintainerSignInAttempt` exists per refused attempt, and no document or log line anywhere contains the submitted key
- [X] T010 [P] [US1] Integration test for the enabled probe in `backend/tests/integration/maintainer-status.test.ts`: `GET /api/maintainer/status` returns `200 {"enabled":true}` with `MAINTAINER_KEY` set and `200 {"enabled":false}` with it unset, requires no authentication, is mounted in **both** cases, and discloses nothing beyond the boolean (FR-005, R2)

### Implementation for User Story 1

- [X] T011 [P] [US1] Create the append-only `MaintainerSignInAttempt` model in `backend/src/models/maintainer-signin-attempt.ts` with `{ clientKey, at, outcome: "refused" }`, index `{ clientKey: 1, at: -1 }`, **no field for the supplied key**, and no update or delete path at any layer (data-model.md §5)
- [X] T012 [US1] Create `backend/src/services/maintainer/signin-throttle-service.ts` — hash `req.ip` into `clientKey`, derive the in-window refusal count by querying the collection, expose `isThrottled()` with remaining seconds and `recordRefusal()`, reading its threshold and window from config (T004); satisfies T008
- [X] T013 [US1] Modify `backend/src/api/middleware/maintainer-auth.ts` to check the throttle **before** the constant-time key comparison, record every refusal through the service, return `429 MAINTAINER_SIGNIN_THROTTLED` with `retryAfterSeconds` while cooling off, return one fixed `401 MAINTAINER_KEY_INVALID` message for every invalid key with no pre-comparison key validation, and `400 MAINTAINER_NAME_REQUIRED` for a blank `x-maintainer-name`; satisfies T009
- [X] T014 [US1] Create `backend/src/api/routes/maintainer-status.ts` returning `{ enabled }`, and mount it **unconditionally** at `/api/maintainer/status` in `backend/src/app.ts` — including when `MAINTAINER_KEY` is unset, which is the whole point of it; satisfies T010
- [X] T015 [US1] Re-mount `adminGuidesRouter` under the `/api/maintainer` namespace in `backend/src/app.ts` (replacing the current `/api/admin` mount), keeping the conditional mount on `MAINTAINER_KEY` and the blanket `maintainerAuth`, and update the affected expectations in `backend/tests/integration/admin-guides-api.test.ts`; additionally add the **SC-007 survival regression** to `backend/tests/integration/dynamic-category.test.ts` — after a full console operation sequence (create a category, edit it, publish two guide versions, retire it, and attempt to retire each mandated category), all six mandated categories are still present, still unretired, and still classify their own reports. This is the automated counterpart to manual quickstart Scenario 9, and the guard plan.md names under Principle VIII (R1, contracts/api.md, SC-007)
- [X] T016 [US1] Make guide rejection identify the offending step and field (FR-013) — return `400 GUIDE_STEP_INVALID` with `stepIndex` and `field` from `backend/src/api/routes/admin-guides.ts`, adding step-level detail to `backend/src/services/guidance/guide-admin-service.ts` if the service does not already surface it, with cases for a zero-step guide, an over-maximum guide, a step missing its instruction, and a step missing its success hint in `backend/tests/integration/admin-guides-api.test.ts` (R12)
- [X] T017 [P] [US1] Create `frontend/src/services/maintainerApi.ts` — a thin `maintainerRequest(key, name, path, init)` caller that sets `x-maintainer-key` and `x-maintainer-name` per request, **never** sets `credentials: "include"`, and shares no code path with `request()` in `services/api.ts`; with `frontend/tests/services/maintainerApi.test.ts` asserting the key never reaches `api.ts`, `localStorage`, `sessionStorage`, a cookie, a URL, or a module-level default header (FR-014, FR-015, R3)
- [X] T018 [US1] Create `frontend/src/pages/maintainer/MaintainerConsolePage.tsx` — console shell holding the key in React state only, calling `/api/maintainer/status` on load, and rendering **three distinct refusal states**: wrong key (fixed message, no data, no feedback that narrows the key), administration switched off (**no sign-in form rendered at all**), and cooling off (server-reported remaining time, submit unavailable). It MUST also handle the two mid-session cases the spec's Edge Cases name: a `401` on any action after sign-in (the key was rotated) discards the held key and returns the maintainer to the sign-in form **with an explanation rather than a dead screen**, and a `404` on any `/api/maintainer/*` action renders the switched-off state rather than a generic error, so a change is never silently lost. Tests in `frontend/tests/pages/MaintainerConsolePage.test.tsx` cover all three refusal states, both mid-session transitions, and key-not-retained-on-reload
- [X] T019 [US1] Create `frontend/src/pages/maintainer/CategoryListPage.tsx` listing display name, classification description, mandated status, retired status, and active guide version; with create, edit, version history, and a retire confirmation that **states the consequence before confirming** (existing tickets keep the category; future classification stops), and **no retire affordance at all** on a mandated category — absent, not disabled. Creating or renaming a category MUST report a duplicate slug (`409 CATEGORY_EXISTS`) and a malformed slug (the lowercase snake_case rule) **on the offending field before the change is attempted**, not as a generic failure after it (FR-006–FR-012, spec edge case); tests in `frontend/tests/pages/CategoryListPage.test.tsx`
- [X] T020 [US1] Create `frontend/src/pages/maintainer/GuideEditor.tsx` — numbered step editor with add and remove, an optional change note, and **inline step-level validation errors placed on the offending step and field** from T016's response, mirroring the server's limits for guidance only while the server stays the enforcement point; tests in `frontend/tests/pages/GuideEditor.test.tsx` (FR-013, R12)
- [X] T021 [US1] Mount `/maintainer` in `frontend/src/App.tsx` **outside** `AppLayout` so `AppNav` never renders inside it and the console is not wired through the auth context, and add a regression test in `frontend/tests/components/AppNav.test.tsx` asserting `frontend/src/components/AppNav.tsx` carries **no maintainer link in any role** (FR-015, R1, Design Direction)

**Checkpoint**: User Story 1 is fully functional and demoable on its own — quickstart Scenarios 1, 2,
and 9 pass without any US2 or US3 work existing.

---

## Phase 4: User Story 2 - Staff record a user's real device, location, and remote access details (Priority: P1)

**Goal**: A staff-set value **becomes** the profile's value everywhere the profile is shown, carrying
who set it and when, with per-field history, per-field control transfer and release, and per-field
conflict detection — replacing the current arrangement where a staff correction sits beside a stale
owner value.

**Independent Test**: Sign in as staff, open a user's profile, change all three support fields, and
confirm the saved values are what both the staff view and the owner's own profile view report, that
each field names the staff member who set it, that the owner can no longer edit those fields, and
that the prior values remain visible in the staff-only field history.

### Preparatory restructuring (Principle VI watch item 1 — before the additions, not after)

- [X] T022 [US2] Extract the presentational pieces of `frontend/src/pages/staff/UserProfilePage.tsx` (credentials block, notes region, profile form) into components under `frontend/src/pages/staff/` or `frontend/src/components/profile/` with **no behaviour change**, so the page stays under 500 lines once authority, history, release, and conflict handling are added; `frontend/tests/pages/UserProfilePage.test.tsx` stays green
- [X] T023 [US2] Restructure `frontend/src/pages/ProfilePage.tsx` out of its single dense JSX expression into per-field composition with **no behaviour change**, so a field can render as editable or read-only independently; `frontend/tests/pages/ProfilePage.test.tsx` stays green
- [X] T024 [P] [US2] Create `frontend/src/lib/profileCopy.ts` holding the **one** provenance byline sentence, the **one** locked-field explanation sentence (the string SC-009 is measured on), and the no-recorded-author byline for pre-feature profiles — written once and reused by every surface, with no em-dashes; `frontend/tests/lib/profileCopy.test.ts` asserts each string is exported once and consumed from here (Design Direction, Open decisions)

### Tests for User Story 2 (MANDATORY — Constitution Principle IV) ⚠️

> **T025 is TEST-FIRST (`research.md` R13) — SC-006 claims 100%, so these must fail if a guard is
> removed. Write it before T031 and T032.**

- [X] T025 [P] [US2] Test-first role-refusal cases added to `backend/tests/integration/access-control.test.ts`: a non-staff account receives `403 FORBIDDEN` with **no resource data** from `GET /api/staff/users/:id/profile`, `PUT /api/staff/users/:id/profile/fields`, `POST /api/staff/users/:id/profile/fields/:field/release`, and `GET /api/staff/users/:id/profile/fields/:field/history`; a signed-out request receives `401`; and a valid maintainer key reaches **no** `/api/staff/*` or `/api/my/*` route (FR-015, FR-027, SC-006)
- [X] T026 [P] [US2] Integration test for per-field concurrency in `backend/tests/integration/profile-field-conflict.test.ts`: two staff saves against one profile where the second submits a stale `expectedSetAt` for `location` and a current one for `hardware` return `200` with `hardware: applied` and `location: conflict` carrying the current value, author, and time; an `expectedSetAt: null` on a field that has since been set is refused; and the resulting `StaffActionRecord` lists **only** the applied field (FR-029, R7, data-model.md §8)

### Implementation for User Story 2

- [X] T027 [P] [US2] Create the append-only `ProfileFieldHistory` model in `backend/src/models/profile-field-history.ts` per data-model.md §4 — `accountId`, `field`, `changeKind`, `previousValue` (typed union), `previousSetByKind`/`Name`/`At`, `newControlledBy`, `actorKind`/`actorId`/`actorName`, `at` — index `{ accountId: 1, field: 1, at: -1 }`, with **no update and no delete path in any role**; unit test in `backend/tests/unit/profile-field-history-model.test.ts`
- [X] T028 [P] [US2] Add the `fieldState` sub-documents (`location`, `hardware`, `remoteAccessIds`, each a `_id: false` `FieldState` with all fields optional and `controlledBy` defaulting to `"owner"`) to `backend/src/models/support-profile.ts`, leaving `staffEntries` and the `correction` enum value in place so existing documents still validate; unit test covering a document written before this feature reading back as owner-controlled with null authorship (data-model.md §3.2, R8)
- [X] T029 [P] [US2] Add `profile_edit` and `profile_release` to the action enum in `backend/src/models/staff-action.ts`, keeping `profile_append` for notes, with cases in `backend/tests/unit/staff-action-model.test.ts`
- [X] T030 [US2] Create `backend/src/services/profile/profile-field-service.ts` — per-field conflict check against the stored `setAt` (with `null` as the never-set baseline), value write with provenance, control transfer to staff on a staff write, release back to the owner leaving `setBy*` and `setAt` untouched, refusal of a release on an owner-controlled field, and the `ProfileFieldHistory` appends for both `value` and `control` changes including the two-entry case where a staff write also moves control; unit tests in `backend/tests/unit/profile-field-service.test.ts` covering set → release → set producing three ordered entries and a cleared field preserving its previous value (R5, R6, R7, data-model.md §4)
- [X] T031 [US2] Modify `backend/src/services/profile/profile-service.ts` so `view()` returns `fieldState` with lazy owner-controlled defaults for pre-feature documents, so the staff and owner reads share one shape, so field history is **never** included in any `view()` output, and so the `kind: "correction"` write path is retired while existing correction entries keep rendering unchanged; update `backend/tests/integration/profiles.test.ts`; once this lands, T051 and T052 are due (FR-025, R8, R9)
- [X] T032 [US2] Add the three new routes to `backend/src/api/routes/staff-users.ts` — `PUT /staff/users/:id/profile/fields` returning the per-field outcome map plus the full profile at `200` even when a field was refused, `POST /staff/users/:id/profile/fields/:field/release` with `409 FIELD_NOT_STAFF_CONTROLLED` on an owner-controlled field, and `GET /staff/users/:id/profile/fields/:field/history` newest-first — each zod-validated at the boundary with the existing `my.ts` limits (location ≤ 160, hardware ≤ 500, ≤ 10 remote entries, `REMOTE_ACCESS_ENTRY_INVALID` with `entryIndex` for a half-filled entry), and each applied field writing one `StaffActionRecord`; integration tests in `backend/tests/integration/staff-profile-fields.test.ts` covering, in addition to the happy path, the two spec edge cases this route owns: **an account with no profile yet** returns `200` with an empty, fully owner-controlled profile rather than `404`, and **a staff member editing their own profile through the staff surface** is permitted and recorded identically to any other edit; satisfies T025
- [X] T033 [US2] Modify `backend/src/api/routes/my.ts` so `PUT /api/my/profile` performs a **per-field control check** — owner-controlled fields apply and record the owner as author, staff-controlled fields return `outcome: "locked"` with `currentSetByName` and `currentSetAt` — returning the same per-field outcome map, appending a `ProfileFieldHistory` `value` entry for an owner write, never changing `controlledBy`, never writing a `StaffActionRecord`, and **never** returning history; extend `backend/tests/integration/profiles.test.ts` (FR-020, FR-021, FR-024, FR-018)
- [X] T034 [P] [US2] Create `frontend/src/components/profile/ProfileField.tsx` rendering a field's value, its provenance byline from `profileCopy.ts` (muted one-line text — **not** a badge, never routed through `StatusBadge.tsx`), its control state, and its per-field conflict state; a locked field renders as **read-only text with the explanation on the field itself, never a disabled input, never amber or red**; tests in `frontend/tests/components/ProfileField.test.tsx` (FR-022, Design Direction)
- [X] T035 [P] [US2] Create `frontend/src/components/profile/FieldHistoryDisclosure.tsx` — staff-only, collapsed by default, newest first, rendering a list field's previous value as a list, with **no edit or delete affordance including a disabled one**; tests in `frontend/tests/components/FieldHistoryDisclosure.test.tsx`
- [X] T036 [US2] Add the profile field calls to `frontend/src/services/api.ts` — staff profile read, per-field save with `expectedSetAt`, release, and field history — through the shared `request()` helper, with the maintainer key having no path into this file
- [X] T037 [US2] Add authoritative editing to `frontend/src/pages/staff/UserProfilePage.tsx`: set all three fields with their loaded `setAt` as concurrency tokens, render the per-field outcome map **per field with no page-level failure banner and without discarding the staff member's typed value**, offer release only on a staff-controlled field, treat the remote access list as one field with its byline, lock, and release on the fieldset rather than on entries, and keep the notes region and pre-feature corrections rendering clearly as notes rather than as values; no optimistic UI on a save, lock, or release; tests in `frontend/tests/pages/UserProfilePage.test.tsx` (FR-016, FR-019, FR-029, Design Direction)
- [X] T038 [US2] Make `frontend/src/pages/ProfilePage.tsx` provenance-aware: every field shows who set it and when, a staff-controlled field is read-only with the locked explanation on the field, fields the owner still controls stay editable exactly as before, a `locked` outcome from a save is explained rather than silently discarded, an all-fields-locked page still explains what the page is for and how to get a value corrected, and **no field-history affordance appears anywhere — not shown, not collapsed, not disabled**; tests in `frontend/tests/pages/ProfilePage.test.tsx` (FR-018, FR-020–FR-022, SC-009)
- [X] T039 [US2] Update `frontend/src/components/ProfilePanel.tsx` so the reporter profile shown on `frontend/src/pages/TicketDetailPage.tsx` carries the same values and the **same byline wording and placement** as the two profile pages, with no stale or unattributed copy; tests in `frontend/tests/components/ProfilePanel.test.tsx` and a green `backend/tests/integration/ticket-profile.test.ts` (AS1, FR-7 escalation context)

**Checkpoint**: User Stories 1 AND 2 both work independently — quickstart Scenarios 3, 4, 5, 7, and 8
pass.

---

## Phase 5: User Story 3 - Staff reach any account, not only reporters of an open ticket (Priority: P2)

**Goal**: Staff find any account by name or email from the dashboard and open its profile directly,
including an account that has never reported a ticket.

**Independent Test**: Sign in as staff, open the directory, search for an account that has never
reported a ticket, and open its profile from the results — three interactions or fewer from the
dashboard.

### Tests for User Story 3 (MANDATORY — Constitution Principle IV) ⚠️

> **T040 is TEST-FIRST (`research.md` R13) — SC-006 claims 100%. Write it before T042.**

- [X] T040 [P] [US3] Test-first role-refusal cases added to `backend/tests/integration/access-control.test.ts`: `GET /api/staff/accounts` returns `401` when signed out and `403 FORBIDDEN` for a signed-in non-staff account, with no account data in either body (FR-033, SC-006)

### Implementation for User Story 3

- [X] T041 [P] [US3] Create `backend/src/services/profile/account-directory-service.ts` — list all user accounts projecting **exactly** `id`, `displayName`, `email`, `role`, with case-insensitive substring filtering on display name or email applied server-side; unit tests in `backend/tests/unit/account-directory-service.test.ts` covering the projection carrying nothing else (R10, NFR-5)
- [X] T042 [US3] Create `backend/src/api/routes/staff-accounts.ts` with `GET /staff/accounts?q=` behind `requireAuth` + `requireStaff`, `q` zod-validated at ≤ 120 chars, returning `200` with an empty array for no match rather than `404`; mount it in `backend/src/app.ts`; integration tests in `backend/tests/integration/staff-accounts.test.ts`; satisfies T040
- [X] T043 [US3] Add the directory call to `frontend/src/services/api.ts` with the search term debounced at the caller
- [X] T044 [US3] Create `frontend/src/pages/staff/AccountDirectoryPage.tsx` listing display name, email, and role **and nothing else**, narrowing as the staff member types, showing a designed no-match state that names the term rather than an empty frame, opening a selected account's profile directly, and offering **no bulk-selection affordance including a disabled one**; tests in `frontend/tests/pages/AccountDirectoryPage.test.tsx` (FR-030–FR-032, Design Direction)
- [X] T045 [US3] Mount the directory route inside `AppLayout` under `RequireStaff` in `frontend/src/App.tsx` and add the staff-only directory link to `frontend/src/components/AppNav.tsx`, confirming in `frontend/tests/pages/auth.test.tsx` that a non-staff account is refused the route and does not see the link

**Checkpoint**: All three user stories are independently functional — quickstart Scenario 6 passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The design gate, the full validation run, and the documentation obligations this feature
creates by invalidating existing evidence (Principle V, `research.md` R14). The evidence-recapture
tasks require the demo machine; Principle V permits deferring them by dated decision **only because
they are tracked here**. T059 is the UAT session Principle IV mandates; it is a separate deliverable
from the developer walkthroughs in T049.

- [X] T046 Run the frontend-design-pro build sequence (`craft → critique → layout → colorize → typeset → polish → audit`), the Final Pre-Flight Check, and the mechanical detector over every frontend file this feature changed — enumerate them with `git diff --name-only <Gate 0 baseline commit from T003> -- frontend/` (the repo works on `main`, so do **not** diff against `main`) and pass that list to `node "C:\Users\tahaf\.claude\skills\impeccable\scripts\detect.mjs" --json <files>` — fixing what it reports (Design Direction, `before_implement` gate)
- [X] T047 Confirm no file this feature touched exceeds 500 lines and no `any` was introduced, by checking `frontend/src/pages/staff/UserProfilePage.tsx`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/maintainer/*.tsx`, and the new backend services. Confirm in the same pass that **no profile field beyond `location`, `hardware`, and `remoteAccessIds` was introduced** — FR-028 is a constraint verified by inspection, since a requirement satisfied by omission has no test that can fail (Principle VI, FR-028)
- [X] T048 Run the full quality gate — `npm run typecheck`, `npm run lint`, `npm test` in both `backend/` and `frontend/` — confirming the pre-existing suites this feature reaches are green: `backend/tests/integration/profiles.test.ts`, `ticket-profile.test.ts`, `access-control.test.ts`, `admin-guides-api.test.ts`, `dynamic-category.test.ts`, `guided-categories.test.ts`, `backend/tests/unit/classification.test.ts`, and `frontend/tests/pages/auth.test.tsx` and `ChatPage.test.tsx`. The classification suites are named explicitly because a console operation changes a category's `classificationDescription`, which feeds classification — plan.md's Principle VIII guard
- [ ] T049 Execute quickstart.md Scenarios 1–9 and record each result with its date in `docs/testing/observations.md`, including the SC-001, SC-003, SC-005, and SC-010 timings and interaction counts
- [ ] T050 Execute quickstart.md Scenario 10 — the scripted end-to-end demo path on the demo machine — and record the run in `docs/testing/demo-path-log.md`, confirming the escalation leg still carries correct reporter profile context (Principle IV release gate)
- [X] T051 [P] Add the dated supersession note to FR-012 in `specs/004-staff-dashboard/spec.md`, naming 007 FR-016 and FR-025 and stating that the never-overwrite guarantee still holds for recorded `staffEntries` and free-text notes but no longer describes how staff set a field's value (`research.md` R9)
- [X] T052 [P] Update the FR-9 and NFR-5 rows of `docs/testing/requirements-traceability.md` with the new routes, the directory and field-history access restrictions, and the new test files
- [X] T053 [P] Generate the new TC rows in `docs/testing/tc-tables.md` from the test names added by this feature rather than hand-writing them (Principle IV)
- [X] T054 [P] Update `docs/design/feature-004-roles-erd.md` with the `FieldState` provenance sub-documents, the `ProfileFieldHistory` collection, and the `MaintainerSignInAttempt` collection
- [ ] T055 [P] Revise the profile-editing steps in `docs/testing/uat-scenarios.md` for staff-authoritative editing, and add the SC-008 UAT tasks (one maintainer task and one staff profile-correction task, three testers, unaided, first attempt)
- [ ] T056 Recapture the three stale feature-004 screenshots in `docs/testing/feature-004-browser/` on the demo machine — `uat-staff-reporter-profile.png`, `uat-staff-profile-note.png`, `uat-user-profile-saved.png` — with realistic seeded names, no placeholder data (`research.md` R14)
- [ ] T057 Capture the seven new evidence screenshots named in quickstart.md into `docs/testing/feature-004-browser/`: console category list, guide step editor with an inline step-level error, guide version history, console "administration not enabled" state, console cooling-off state, per-field conflict with one applied and one refused, and the account directory with a search applied
- [X] T058 Run `graphify update .` so `graphify-out/` reflects the new modules (project CLAUDE.md rule)
- [ ] T059 Run the SC-008 UAT session on the demo machine with **three acceptance testers** (demographics recorded, pseudonyms allowed) — each completing one maintainer task from quickstart Scenario 1 and one staff profile-correction task from Scenario 3, unaided and on first attempt — and record the results, the verbatim SC-009 answers from Scenario 4 step 7, and the tester demographics in `docs/testing/feature-007-uat.md` (Constitution Principle IV; spec SC-008, SC-009)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 are governance gates and block every implementation task. T003–T005 have no dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all three user stories**.
- **User Stories (Phases 3–5)**: All depend on Phase 2. Once it completes they may proceed in parallel, or sequentially in priority order US1 → US2 → US3.
- **Polish (Phase 6)**: Depends on whichever stories were built. T046–T048 depend on all frontend work; T049–T050 depend on all three stories; T051–T058 are documentation and evidence; T059 (UAT) runs last and depends on T049 and T050 passing.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Nothing in US2 or US3 is required.
- **US2 (P1)**: Depends only on Foundational. Shares no file with US1 except `frontend/src/App.tsx` (T021 vs. nothing in US2) and `frontend/src/services/api.ts` (T036, not touched by US1 — the console has its own caller by design).
- **US3 (P2)**: Depends only on Foundational. Shares `frontend/src/services/api.ts` (T043) and `frontend/src/App.tsx` (T045) with the other stories, so those two tasks serialise against T036 and T021 respectively.

### Within Each User Story

- Test-first tasks (T008, T009, T025, T040) MUST be written and MUST FAIL before their implementation tasks.
- Models → services → routes → frontend callers → pages.
- T022 and T023 (restructuring) precede every other US2 frontend task — extraction before the additions, not after.
- T024 precedes T034, T037, T038, and T039, which all consume its strings.
- T016 precedes T020 (the editor renders the server's step-level error).
- T030 precedes T032 and T033 (both routes call the field service).
- T051 and T052 execute **immediately after T031**, not at the end of Phase 6. T031 is the task that retires the `kind: "correction"` write path, and from that moment 004's FR-012 ("recorded alongside, never overwriting") describes behaviour the code no longer has. Leaving the supersession note and the traceability rows until Phase 6 leaves the requirements record contradicting the codebase for the length of the build (`research.md` R9).

### Cross-Story File Contention (not parallel-safe)

| File | Tasks | Order |
|---|---|---|
| `backend/src/app.ts` | T014, T015, T042 | Sequential |
| `backend/tests/integration/access-control.test.ts` | T025, T040 | Sequential |
| `backend/tests/integration/admin-guides-api.test.ts` | T015, T016 | Sequential (both US1) |
| `frontend/src/App.tsx` | T021, T045 | Sequential |
| `frontend/src/services/api.ts` | T007, T036, T043 | Sequential |
| `frontend/src/lib/types.ts` | T006 only | Single task by design |
| `backend/tests/integration/profiles.test.ts` | T031, T033 | Sequential |

### Parallel Opportunities

- **Phase 1**: T005 runs alongside T003 and T004.
- **Phase 3**: T008, T009, T010 in parallel; then T011 and T017 in parallel with the T012 → T013 chain.
- **Phase 4**: T025 and T026 in parallel; T027, T028, T029 in parallel; T034 and T035 in parallel.
- **Phase 5**: T040 and T041 in parallel.
- **Phase 6**: T051, T052, T053, T054, T055 all in parallel.
- **Across stories**: after Phase 2, US1, US2, and US3 can be worked simultaneously by different developers, respecting the contention table above.

---

## Parallel Example: User Story 1

```bash
# The three test-first / test tasks together (different files, no dependencies):
Task: "T008 Test-first throttle unit tests in backend/tests/unit/maintainer-signin-throttle.test.ts"
Task: "T009 Test-first sign-in refusal integration tests in backend/tests/integration/maintainer-signin.test.ts"
Task: "T010 Status probe integration test in backend/tests/integration/maintainer-status.test.ts"

# Then the independent pieces while the middleware chain proceeds:
Task: "T011 MaintainerSignInAttempt model in backend/src/models/maintainer-signin-attempt.ts"
Task: "T017 Maintainer caller in frontend/src/services/maintainerApi.ts"
```

## Parallel Example: User Story 2

```bash
# All three model changes together (different files):
Task: "T027 ProfileFieldHistory model in backend/src/models/profile-field-history.ts"
Task: "T028 fieldState sub-documents in backend/src/models/support-profile.ts"
Task: "T029 Two new action values in backend/src/models/staff-action.ts"

# Both new profile components together:
Task: "T034 ProfileField in frontend/src/components/profile/ProfileField.tsx"
Task: "T035 FieldHistoryDisclosure in frontend/src/components/profile/FieldHistoryDisclosure.tsx"
```

---

## Implementation Strategy

### Gate first

T001 and T002 are not paperwork to catch up on later. The constitution's Governance section requires
supervisor agreement before implementing a Principle I scope change, and Principle VII requires the
delivery record to name increment 7. Both are recorded before T006.

### MVP First (User Story 1 only)

1. Phase 1 — gates recorded, baseline green, config added.
2. Phase 2 — shared types.
3. Phase 3 — US1.
4. **STOP and VALIDATE**: quickstart Scenarios 1, 2, and 9. The maintainer console demonstrates IR
   FR-2 in a live walkthrough, which is the single largest gain in this feature and stands entirely
   alone.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate Scenarios 1, 2, 9 → demo (MVP).
3. Add US2 → validate Scenarios 3, 4, 5, 7, 8 → demo.
4. Add US3 → validate Scenario 6 → demo.
5. Phase 6 → design gate, full quickstart, evidence recapture.

Each story adds value without breaking the previous one. If time runs short, US3 is the slice to drop:
US2 already delivers authoritative profiles for every account that has raised a ticket.

### Parallel Team Strategy

1. Everyone completes Phase 1 and Phase 2 together.
2. Then: Developer A takes US1 (entirely backend + a self-contained console route), Developer B takes
   US2 (the largest story), Developer C takes US3 and starts Phase 6 documentation.
3. Serialise only the six files in the contention table.

---

## Notes

- `[P]` means a different file with no dependency on an incomplete task.
- Every implementation task ships its tests in the same task; the four test-first tasks are called out explicitly and must fail before their implementation.
- Four things in this feature are enforced by **absence**, and a disabled control is a failure, not a compromise: no retire action on a mandated category, no field-history affordance on the owner's profile, no revert on a past guide version, no bulk-select in the directory.
- The maintainer key must never enter `frontend/src/services/api.ts`, browser storage, a cookie, a URL, or a default header. T017 exists to make that structural.
- The remote access list is **one field** for provenance, control, concurrency, and history.
- A per-field conflict is a `200` with a mixed outcome map, never a page-level failure, and never discards the staff member's typed value. The Design Direction names this the most likely bug in the feature.
- No migration runs. Pre-feature profiles read as owner-controlled with unrecorded authorship; pre-feature corrections never become values and never seed history.
- **The developer commits** after each task or logical group — agents suggest messages but do not commit (Constitution, Development Workflow). Stop at any checkpoint to validate a story independently.
