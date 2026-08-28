# Implementation Plan: Maintainer Admin Console & Staff-Authoritative Account Editing

**Branch**: `007-admin-console-account-editing` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-admin-console-account-editing/spec.md`

## Summary

Two capabilities that already exist without a usable surface, and one that does not exist yet:

1. **A maintainer console** (US1) — a screen for the category and guide administration that today is
   reachable only by hand-crafting requests with two custom headers. It adds **no new maintainer
   power**; it makes the mandated "categories may be extended or edited by a maintainer" behaviour
   (IR FR-2) demonstrable in a live walkthrough. New backend work is limited to an enabled-status
   probe, sign-in throttling, and refused-attempt records.
2. **Staff-authoritative profile editing** (US2) — staff set a user's location, hardware
   specification, and remote access identifiers so the saved value **becomes** the profile's value,
   replacing the current arrangement where a staff correction sits beside a stale owner value. Each
   field gains provenance (who set it, when) and a controller (owner or staff), with per-field
   history, per-field release, and per-field conflict detection.
3. **An account directory** (US3) — staff reach any account by name or email, not only reporters of a
   ticket they can see.

**Technical approach**: the console is a route outside the application shell that clients the existing
`guide-admin-service.ts` through per-request maintainer headers; no session, no token, no third role.
Profile authority is modelled by separating **authorship** from **control** on each field, so
releasing a field back to the owner does not falsify who wrote its value. History lives in its own
append-only collection so it can be staff-only by routing rather than by projection. Concurrency is
per field, keyed on each field's `setAt`, so a save applies the fields nobody else touched and refuses
only the one that moved. No migration runs: profiles written before this feature read as
owner-controlled with unrecorded authorship rather than being given an invented author.

Full reasoning in [research.md](research.md); shapes in [data-model.md](data-model.md) and
[contracts/api.md](contracts/api.md); validation in [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.x, `strict` mode, backend and frontend (Principle VI)

**Primary Dependencies**: Backend — Node.js LTS, Express, Mongoose, zod, supertest. Frontend — React
18, Vite 5, Tailwind 3, react-router-dom 7, `@phosphor-icons/react`.
**No new dependency is added by this feature**, frontend or backend (Design Direction).

**Storage**: MongoDB Community via Mongoose, single-node replica set `rs0`. One existing collection
extended (`SupportProfile`), two new collections (`ProfileFieldHistory`, `MaintainerSignInAttempt`),
one existing collection gaining two enum values (`StaffActionRecord`). No migration.

**Testing**: Vitest + supertest (backend), Vitest + Testing Library (frontend). Test-first for the
sign-in throttle and the role refusals; same-task tests elsewhere (Principle IV, `research.md` R13).

**Target Platform**: HP Victus 16 demo machine, Windows 11. Backend serves the built frontend for the
demo; no external infrastructure (NFR-7).

**Project Type**: Web application — `backend/` + `frontend/`, existing structure.

**Performance Goals**: No new performance surface. Directory search is a single indexed-adjacent query
over a demo-scale account set; field history is read on demand behind a disclosure, never on the
profile's first paint. NFR-1 (fast responses for common problems) is untouched — nothing here sits on
the chat path.

**Constraints**: Console holds the maintainer key in memory only (FR-014). Field history is never
returned to an account owner (FR-018). No endpoint promotes an account or creates a maintainer session
(Principle III). Files ≤ 500 lines. All external input zod-validated at the boundary.

**Scale/Scope**: 3 user stories, 35 functional requirements, 11 success criteria. Roughly 4 new
frontend routes/surfaces (console sign-in, console category list/detail, directory, and the reworked
staff profile page), 1 reworked owner surface, and 15 endpoint rows in `contracts/api.md` — 7
maintainer (6 existing handlers plus the new `/status` probe), 6 staff (the new directory, the
existing profile read and note-append, and 3 new field routes), and 2 owner (`GET`/`PUT
/api/my/profile`, both existing and modified). Only **5 are genuinely new**: `/status`, the
directory, and the three field routes.

**No `NEEDS CLARIFICATION` remain.** The spec's five clarifications (2026-08-28) settled the
behavioural questions; `research.md` R1–R13 settle the technical ones. R15 records two **governance**
items that are not technical unknowns and are handled as gate conditions below.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design. Result: **PASS with two recorded
pre-implementation gate conditions** (Principle I supervisor agreement, Principle VII amendment).
Neither blocks planning; both block implementation.*

### Principle I — IR Fidelity (scope is locked) ⚠️ **GATE CONDITION**

The spec traces to FR-2, FR-9, FR-7, NFR-2, and NFR-5, and positions itself as an **enhancement that
strengthens existing IR requirements**. The case is real on its own terms: FR-2 mandates that
categories "may be extended or edited by a maintainer", and today that capability has no surface a
marker can see exercised; FR-9's dashboard gains a directory and trustworthy profile values that
FR-7's escalation context depends on. No IR requirement is weakened and no objective is deferred.

**But the framing is a judgement call, and the developer directed the work while explicitly
acknowledging it is not in the IR objectives.** Constitution Governance: *"Any change that would
breach Principle I (scope) is a project scope change and additionally requires the supervisor's
agreement before implementation."*

**Gate condition G1**: supervisor agreement MUST be sought and its outcome recorded before
implementation begins. Recorded in Complexity Tracking. This is not a planning blocker — the plan
documents what would be built — and it is not a decision this plan can make on the supervisor's
behalf.

**Second Principle I obligation**: enhancements are "permitted only when they strengthen an IR
requirement and **never at the expense of completing one**." Feature 006 (refining/Transition) carries
the Objective-4 evaluation and UAT, both of which are IR obligations. This feature is sequenced after
006 and must not consume its time. Recorded as a risk in the spec and re-stated here.

### Principle II — Safety-First Automation ✅ **PASS, not engaged**

No remediation, no command execution, no policy, no endpoint registry, no tool. Nothing in this
feature can cause a machine action. The whitelist, executor, and audit trail are untouched.

Two audit-discipline patterns are **borrowed** from this principle rather than governed by it:
`ProfileFieldHistory` and `MaintainerSignInAttempt` are append-only with no update or delete path in
any role, matching how 005 treats action records.

### Principle III — Human-in-the-Loop / locked role model ✅ **PASS, and load-bearing**

The locked two-role model is the constraint this feature is most likely to be *thought* to breach, so
the compliance is stated explicitly:

- **No third role is introduced.** The maintainer remains "a shared-secret request header on a
  different axis entirely — not an account, not a session, unable to read tickets or alter roles, and
  not mounted at all when the key is unset."
- **No endpoint promotes an account.** Staff gain the ability to edit profile *fields*, not roles.
  `contracts/api.md` names role promotion in its deliberately-absent list.
- **No session is created for the maintainer.** `data-model.md` §7 records that the Maintainer Session
  entity has no persistent representation at all.
- The console is named `/maintainer`, not `/admin`, precisely because the constitution states "There
  is no admin role and no third role" and a path called `/admin` invites the wrong reading
  (`research.md` R1).
- Escalation context improves: FR-7 handover carries a profile whose values are now authoritative and
  attributed.

### Principle IV — Test-Backed Evidence ✅ **PASS**

- **Test-first** for the sign-in throttle and refused-attempt record (an authentication control on a
  shared secret, and the substance of SC-011), and for the non-staff refusals on the directory and
  profile routes (SC-006 claims 100%, and a 100% claim needs a test that fails when the guard is
  removed). `research.md` R13.
- Same-task tests for everything else; no task ships untested behaviour.
- Test names chosen so `docs/testing/tc-tables.md` rows are generated, not hand-written.
- The scripted demo path is a release gate and is exercised as quickstart Scenario 10 — this feature
  changes the reporter profile shown at escalation, so the gate is genuinely at risk and is checked.
- UAT: SC-008 requires three testers completing a maintainer task and a staff correction task unaided.
  That runs under `docs/testing/uat-scenarios.md`, not as a developer walkthrough.

### Principle V — Documentation as a Deliverable ✅ **PASS, with tracked recapture**

This feature **invalidates existing evidence**, which is a documentation obligation rather than an
optional tidy-up. `research.md` R14 inventories eight artifacts: three feature-004 UAT screenshots of
the profile surfaces, two `requirements-traceability.md` rows, the profile steps in
`uat-scenarios.md`, the roles ERD, and 004's FR-012 text.

Recapture requires the demo machine, which Principle V permits deferring by dated decision **provided
it is tracked as an open task in the owning feature**. It will be tracked in `tasks.md`, not assumed.

### Principle VI — Clean TypeScript Architecture ✅ **PASS, with two watch items**

- TypeScript strict throughout; no `any`.
- All new input zod-validated at the HTTP boundary, including the staff field-write path, which brings
  the staff write under the same limits the owner write already enforces (`data-model.md` §3.5).
- No secrets in version control; the two new settings ship in `.env.example` with committed defaults.
- **Watch item 1 — the 500-line rule.** `frontend/src/pages/staff/UserProfilePage.tsx` (7.4K) gains
  four behaviours and `frontend/src/pages/ProfilePage.tsx` (3.8K, currently one dense JSX expression)
  must be restructured. Both need extraction **before** the additions, not after. The Design Direction
  names the components to extract.
- **Watch item 2 — one caller for the maintainer key.** The shared `request()` in
  `frontend/src/services/api.ts` sets `credentials: "include"` on every call. The maintainer key must
  never enter it (`research.md` R3). A separate thin caller is a structural guarantee; a convention
  is not.

### Principle VII — RUP-Aligned Iterative Delivery ⚠️ **GATE CONDITION**

The delivery record's "Remaining order" ends at item 6, the refining/Transition phase, and states
"This is the next phase; nothing may be specified ahead of it without supervisor agreement."

- **Ordering**: this feature is sequenced **after** 006, not ahead of it. The spec's assumption treats
  006 as the phase that precedes this one, satisfying the ordering rule's intent.
- **But no seventh increment is declared**, so as things stand the delivery record will not match what
  was built.

**Gate condition G2**: the constitution MUST be amended via `/speckit-constitution` to name increment
7 with its requirement tracing, and to reconcile it with the clause naming the refining phase as the
next and last. A MINOR version bump. Recorded in Complexity Tracking.

The three user stories are independently implementable, testable, and demoable, as Principle VII
requires: US1 depends on nothing in US2 or US3; US2 stands alone for users who have tickets; US3 is a
smaller slice that depends on nothing in US1.

### Principle VIII — Agent Core & Prompt Engineering ✅ **PASS, not engaged, with one guard**

No change to the agent loop, the tool registry, conversation memory, the provider chain, or any prompt
module. No new tool. No model call is added by this feature.

**One guard**: creating or editing a category changes its `classificationDescription`, which feeds
classification. That is **data**, not a prompt change — the prompt modules are untouched — but the
classification regression test set is the thing that would notice if a console operation degraded
classification. Quickstart Scenario 9 checks that all six mandated categories still classify after a
full sequence of console operations, and the existing classification tests must stay green.

### Compliance Debt

**This feature closes no Compliance Debt Register entry.** The register's Active entries are empty and
this feature adds none. No entry is struck.

### Post-Phase-1 re-evaluation

Re-checked after `data-model.md`, `contracts/api.md`, and `quickstart.md` were written. **No new
violation surfaced.** Two design decisions were made specifically to keep principles satisfied rather
than to work around them:

- Field history in its own collection makes FR-018's staff-only rule a routing property instead of a
  projection rule one careless `view()` edit can break (Principle VI, NFR-5).
- `MaintainerSignInAttempt` has **no field for the supplied key**, so FR-035's prohibition is
  structural rather than a rule someone must remember (Principle VI boundary discipline).

## Project Structure

### Documentation (this feature)

```text
specs/007-admin-console-account-editing/
├── plan.md                # This file
├── spec.md                # Feature specification (clarified 2026-08-28)
├── research.md            # Phase 0 — R1..R15
├── data-model.md          # Phase 1 — entities, provenance/control model, migration (none)
├── quickstart.md          # Phase 1 — 10 validation scenarios mapped to AS/SC
├── DESIGN-DIRECTION.md    # frontend-design-pro output; summarised below
├── contracts/
│   └── api.md             # Phase 1 — endpoints, per-field outcome map, absent endpoints
├── checklists/            # Existing
└── tasks.md               # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── middleware/
│   │   │   └── maintainer-auth.ts        # MODIFIED: throttle check before key comparison
│   │   └── routes/
│   │       ├── admin-guides.ts           # MODIFIED: step-level guide errors (FR-013) only
│       │                             #   the /maintainer namespace move lives in app.ts
│   │       ├── maintainer-status.ts      # NEW: unauthenticated enabled probe, always mounted
│   │       ├── staff-accounts.ts         # NEW: account directory
│   │       ├── staff-users.ts            # MODIFIED: field write, release, history routes
│   │       └── my.ts                     # MODIFIED: per-field control check on owner write
│   ├── models/
│   │   ├── support-profile.ts            # MODIFIED: fieldState sub-documents
│   │   ├── profile-field-history.ts      # NEW: append-only field history
│   │   ├── maintainer-signin-attempt.ts  # NEW: append-only refused attempts
│   │   └── staff-action.ts               # MODIFIED: profile_edit, profile_release
│   ├── services/
│   │   ├── profile/
│   │   │   ├── profile-service.ts        # MODIFIED: provenance in view(); per-field writes
│   │   │   ├── profile-field-service.ts  # NEW: control transfer, history append, conflict check
│   │   │   └── account-directory-service.ts  # NEW
│   │   ├── maintainer/
│   │   │   └── signin-throttle-service.ts    # NEW: derive count, record refusal
│   │   └── guidance/
│   │       └── guide-admin-service.ts    # MODIFIED only if step-level errors need it (R12)
│   ├── config/index.ts                   # MODIFIED: two throttle settings
│   └── app.ts                            # MODIFIED: /api/maintainer namespace (replacing
│                                         #   /api/admin), always-on /status mount, directory mount
└── tests/
    ├── unit/                             # throttle (test-first), provenance, control transitions
    └── integration/                      # per-field conflict, directory, access control, history

frontend/
├── src/
│   ├── App.tsx                           # MODIFIED: /maintainer outside AppLayout; directory route
│   ├── components/
│   │   ├── AppNav.tsx                    # MODIFIED: directory link. NO maintainer link
│   │   ├── ProfilePanel.tsx              # MODIFIED: provenance bylines on ticket detail
│   │   └── profile/
│   │       ├── ProfileField.tsx          # NEW: value, byline, control state, conflict state
│   │       └── FieldHistoryDisclosure.tsx  # NEW: staff-only, collapsed by default
│   ├── pages/
│   │   ├── ProfilePage.tsx               # MODIFIED: restructured; read-only locked fields
│   │   ├── maintainer/
│   │   │   ├── MaintainerConsolePage.tsx # NEW: shell, sign-in, three refusal states
│   │   │   ├── CategoryListPage.tsx      # NEW
│   │   │   └── GuideEditor.tsx           # NEW: numbered steps, inline step-level errors
│   │   └── staff/
│   │       ├── UserProfilePage.tsx       # MODIFIED: extract first, then add authority
│   │       └── AccountDirectoryPage.tsx  # NEW
│   ├── services/
│   │   ├── api.ts                        # MODIFIED: profile/directory calls. NOT the key
│   │   └── maintainerApi.ts              # NEW: per-request key+name caller, separate from request()
│   └── lib/types.ts                      # MODIFIED: FieldState, history, directory entry
└── tests/                                # pages + components, mirroring existing suites

docs/                                     # Evidence recapture per research.md R14
```

**Structure Decision**: the existing `backend/` + `frontend/` web-application structure, unchanged. No
new top-level directory and no second build target — the spec's assumption is that both surfaces live
inside the existing web application, and NFR-7 plus the Principle IV demo gate both argue against a
second thing to start. The maintainer console is a **route** in the existing SPA, separated
structurally by being mounted outside `AppLayout`.

## Design Direction (frontend-design-pro)

Produced by the mandatory `before_plan` hook. Full text in
[DESIGN-DIRECTION.md](DESIGN-DIRECTION.md); the binding decisions:

**Design Read**: two surfaces with different audiences in one product UI — a sparse, explicit
maintainer control room, and a profile system where every field now has an author and a controller.
**Dials**: DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 6 (staff and console) / 4 (owner
profile) — inherited from 004 and 005.

**Stack**: no new design system, no new dependency, no new theme, `@phosphor-icons/react` only.
Single light theme including the console (Page Theme Lock).

**Load-bearing rules** (the ones most likely to be got wrong):

- **Console separation is structural, not chromatic** — its own route outside `AppLayout`, no
  `AppNav`, no link to it from anywhere in the app. This is how FR-015 is enforced rather than
  promised. No dark "admin" theme.
- **A locked field is not a warning** — never amber or red, and **never a disabled input**. FR-022
  forbids an input that silently does nothing; locked fields render as read-only text with a plain
  one-sentence explanation on the field itself, because control is per field and a page banner cannot
  say which.
- **Per-field conflict renders per field** — no page-level "save failed" when two of three fields
  saved, and the staff member's typed value is not discarded. Named as the most likely bug in the
  feature.
- **Absence is the design**, in four places: no retire control on mandated categories, no field-history
  affordance on the owner's profile, no revert on a past guide version, no bulk-select in the
  directory. Absent, not disabled.
- **Provenance is a byline, not a badge** — muted one-line text, identical wording and placement on the
  owner profile, the staff profile, and the ticket-detail `ProfilePanel`. `StatusBadge.tsx` must not
  absorb it.
- **Three distinct console refusal states** — wrong key, administration off (no form rendered at all),
  and cooling-off. Conflating any two is a design failure. No feedback that narrows the key.
- **The remote access list is one field** — its byline, lock, and release sit on the fieldset, never on
  individual entries.
- **No optimistic UI** on a save, a lock, or a release.

**Shared-component regression risk**: 12 modules, highest being `lib/types.ts` (shape change reaches
every consumer), `ProfilePage.tsx` (owner-facing regression), `ProfilePanel.tsx` (silent staleness on
ticket detail — easy to miss because the spec talks about profile *pages*), and `services/api.ts` (the
key must not enter the shared caller).

**Build sequence**: `craft → critique → layout → colorize → typeset → polish → audit`, then the taste
pre-flight check, then the mechanical detector over changed frontend files. Enforced at
`/speckit-implement` by the `before_implement` hook.

## Complexity Tracking

No constitutional violation requires justification. The two rows below are **pre-implementation gate
conditions** raised by the constitution's own Governance section and by the spec's Risks — recorded
here because that is where a `/speckit-plan` reader looks for them.

| Item | Why it exists | What must happen before implementation |
|---|---|---|
| **G1 — Principle I / Governance: supervisor agreement** | The developer directed this feature on 2026-08-28 while acknowledging it is not in the IR objectives. It is framed as strengthening FR-2 and FR-9, which is the only basis Principle I permits, but the framing is a judgement call. Governance requires supervisor agreement before implementing a scope change. | Seek supervisor agreement; record the outcome and its date in the spec and in the log sheet, whichever way it goes. Implementation does not start first. |
| **G2 — Principle VII: delivery record amendment** | The constitution's remaining-order list ends at increment 6 (refining/Transition) and states nothing may be specified ahead of it. A seventh increment is not declared, so the delivery record would not match what was built. | Run `/speckit-constitution` to add increment 7 with its requirement tracing and reconcile the "next phase" clause. MINOR bump, Sync Impact Report refreshed. |

| Deliberate design cost | Why needed | Simpler alternative rejected because |
|---|---|---|
| Authorship stored separately from control on each field | FR-023 + AS10 require a released field to stay editable by the owner while FR-017 still names the staff member who set its value | Deriving control from `setBy.kind` cannot represent a released field without falsifying authorship |
| Field history in its own collection rather than embedded | FR-018 retains every previous value with no cap; FR-018 also makes history staff-only | An embedded array grows unbounded toward the 16 MB document limit and is loaded on every profile read, including two surfaces that must never receive it |
| Per-field concurrency tokens and a per-field outcome map | FR-029 and the clarification require fields nobody touched to save normally in the same attempt | A document-level version refuses the whole save, which the clarification explicitly rejects |
| A second HTTP caller on the frontend for maintainer requests | FR-014 and FR-015 — the shared `request()` sends credentials on every call | A convention that "we won't put the key in the shared helper" is not enforceable; a separate caller is |

## Phase status

| Phase | Status | Output |
|---|---|---|
| Pre-plan hook | Complete | `DESIGN-DIRECTION.md` (frontend-design-pro, plan mode) |
| Phase 0 — Research | Complete | `research.md` (R1–R15; no `NEEDS CLARIFICATION` remain) |
| Phase 1 — Design & Contracts | Complete | `data-model.md`, `contracts/api.md`, `quickstart.md` |
| Constitution Check (post-design) | Pass, 2 gate conditions | This section |
| Phase 2 — Tasks | Not started | `/speckit-tasks` |
