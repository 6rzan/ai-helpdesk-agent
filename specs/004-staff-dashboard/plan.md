# Implementation Plan: Staff Dashboard & User Accounts

**Branch**: `004-staff-dashboard` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-staff-dashboard/spec.md`

## Summary

Deliver the staff side of the support loop (IR FR-9): user accounts with two roles
(regular / staff), a role-gated web dashboard where staff list, filter, open, take over,
reassign, and resolve tickets with full handover context; automatic surfacing of the
reporter's support profile on escalated tickets; self-service profiles with attributed
staff-appended entries; live chat ⇄ dashboard propagation over the existing SSE bus; and
staff-run Excel bulk import with column mapping, preview, and provisioned credentials.

Technical approach (details in [research.md](research.md)): cookie-backed server-side
sessions in MongoDB with per-request role checks; Node built-in scrypt for password
hashing (zero new native deps); `exceljs` + existing multer for import parsing;
`react-router-dom` v7 for the role-gated SPA shell; conditional atomic updates for
takeover/reassignment races; all new entities as Mongoose schemas with zod boundary
validation.

## Technical Context

**Language/Version**: TypeScript 5.x `strict` (backend and frontend)

**Primary Dependencies**: Backend: Node.js LTS, Express, Mongoose, zod, pino, multer
(existing) + `exceljs` (new). Frontend: React 18 + Vite + Tailwind CSS (existing) +
`react-router-dom` v7 (new). No auth/identity dependency — sessions and scrypt hashing
are hand-rolled thin layers over Node built-ins (research R1/R2).

**Storage**: MongoDB Community via Mongoose — new collections `useraccounts`,
`authsessions`, `supportprofiles`, `staffactionrecords`, `profileimports`; additive
fields on existing `tickets` and `conversations` ([data-model.md](data-model.md))

**Testing**: Vitest + supertest (backend integration per route/flow; frontend component
tests per page), exportable to Chapter 5 TC tables

**Target Platform**: Single demo machine (HP Victus 16, Windows 11); backend serves the
built frontend; browsers on the same machine/LAN

**Project Type**: Web application (existing `backend/` + `frontend/`)

**Performance Goals**: Chat ⇄ dashboard propagation ≤ 5 s (SC-004/SC-008) via existing
SSE push; dashboard-to-takeover flow completable in < 60 s (SC-001); 50-row import
end-to-end < 5 min (SC-007)

**Constraints**: Fully local, no external identity provider or cloud dependency
(NFR-7); data minimisation — profiles hold only support-relevant fields, access
restricted to owner + staff (NFR-5); staff role never self-assignable (FR-002); no
remote-access automation — IDs are display-only reference (feature 005 boundary)

**Scale/Scope**: Single-org demo scale: tens of accounts, hundreds of tickets, ~9 new
routes/pages frontend, ~18 new API endpoints, 5 new + 2 extended data entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| I | IR Fidelity | ✅ PASS | Spec traces to FR-9 (dashboard), FR-6 (status visibility), FR-7 (escalation handling), NFR-4/5/6. Accounts/profiles/import are enhancements that strengthen FR-9/NFR-5 without displacing any IR requirement; scope explicitly excludes remediation (005). |
| II | Safety-First Automation | ✅ PASS | No automated actions on endpoints in this feature. Every staff action appends an attributed StaffActionRecord (audit discipline); credential material is never readable; LLM path untouched. |
| III | Human-in-the-Loop | ✅ PASS | This feature IS the staff-side HITL surface: full visibility (list, detail, history), override authority (take over any open ticket), handover context preserved (conversation + classification + attempted steps on one view). |
| IV | Test-Backed Evidence | ✅ PASS | Access-control middleware (`requireAuth`/`requireStaff`, ownership checks) treated as safety-critical → test-first tasks precede implementation. Every story ships integration tests; TC-table naming maintained; demo path extended with takeover step. |
| V | Documentation as a Deliverable | ✅ PASS | quickstart.md lists the evidence to capture (screenshots, TC tables, ERD/sequence updates) per story; docs land in `docs/` during implementation, not after. |
| VI | Clean TypeScript Architecture | ✅ PASS | strict TS; zod at every new boundary (auth bodies, profile fields, import mapping, uploaded workbook rows); files ≤ 500 lines (dashboard split into per-panel components); sessions/scrypt keep the dependency surface minimal; LLM abstraction untouched. |
| VII | RUP-Aligned Iterative Delivery | ✅ PASS | Feature sits in the declared delivery order (dashboard after voice/troubleshooting). Stories P1→P5 are independently implementable and demoable; P1 alone closes the support loop. |
| VIII | Agent Core & Prompt Discipline | ✅ PASS | Agent loop, tools, prompts unchanged. Reporter-facing notifications reuse the existing plain-language template path; conversation memory schema gains only an optional `accountId`. No prompt-module changes → no classification-regression obligations triggered. |

**Post-Phase-1 re-check**: design artifacts introduce no new violations — no new
projects, no agent-core changes, no external services. Gate holds.

## Project Structure

### Documentation (this feature)

```text
specs/004-staff-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R10
├── data-model.md        # Phase 1 — entities, access rules
├── quickstart.md        # Phase 1 — validation walkthroughs
├── contracts/
│   └── api.md           # Phase 1 — REST + SSE contract
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── user-account.ts        # NEW
│   │   ├── auth-session.ts        # NEW
│   │   ├── support-profile.ts     # NEW
│   │   ├── staff-action.ts        # NEW
│   │   ├── profile-import.ts      # NEW
│   │   ├── ticket.ts              # EXTEND: reporterAccountId, assignee, assignmentHistory
│   │   └── conversation.ts        # EXTEND: accountId
│   ├── services/
│   │   ├── auth/                  # NEW: password (scrypt), session service
│   │   ├── profile/               # NEW: profile + staff-entry service
│   │   ├── import/                # NEW: exceljs parse, mapping, preview, apply
│   │   ├── staff/                 # NEW: roster/suggestion, takeover/reassign
│   │   └── ticket/                # EXTEND: state-machine (human-mode one-way), notifications (new templates)
│   ├── api/
│   │   ├── middleware/            # NEW: require-auth.ts, require-staff.ts (+ existing validate.ts)
│   │   ├── routes/                # NEW: auth.ts, my.ts, staff-tickets.ts, staff-users.ts, staff-imports.ts
│   │   └── sse/event-bus.ts       # EXTEND: staff stream + assignment events
│   └── scripts/                   # NEW: seed-staff.ts (maintainer action)
└── tests/integration/             # NEW suites: auth, access-control (test-first), staff-tickets, takeover-race, profiles, imports, live-updates

frontend/
├── src/
│   ├── App.tsx                    # EXTEND: router + AuthProvider + role guards
│   ├── pages/
│   │   ├── ChatPage.tsx           # EXTEND: requires signed-in account (FR-003)
│   │   ├── LoginPage.tsx          # NEW
│   │   ├── RegisterPage.tsx       # NEW
│   │   ├── MyTicketsPage.tsx      # NEW
│   │   ├── ProfilePage.tsx        # NEW
│   │   ├── SettingsPage.tsx       # NEW (password change)
│   │   └── staff/
│   │       ├── DashboardPage.tsx  # NEW (ticket list)
│   │       ├── TicketDetailPage.tsx # NEW (conversation + context panel)
│   │       ├── UserProfilePage.tsx  # NEW (view/append)
│   │       └── ImportPage.tsx     # NEW (upload → map → preview → apply)
│   ├── components/                # EXTEND shared: StatusBadge, TicketCard; NEW: staff panels, AssigneePicker, ProfilePanel
│   ├── services/
│   │   ├── api.ts                 # EXTEND: credentials:'include' + new endpoints
│   │   └── useEvents.ts           # EXTEND: staff stream support
│   └── lib/types.ts               # EXTEND: account/profile/assignment types
└── tests/pages/                   # NEW page tests per new page
```

**Structure Decision**: Existing web-application layout (`backend/` + `frontend/`)
retained per constitution; all work is additive modules inside it. No new top-level
projects.

## Design Direction (frontend-design-pro)

**Design Read**: Internal IT-staff dashboard plus account/profile surfaces inside an
existing help-desk product, for staff working cases and end users checking their own
tickets, with an earned-familiarity product language (Linear/Stripe-class trust, zero
novelty for novelty's sake), leaning toward the project's existing Tailwind system
(gray neutrals, blue-600 accent) extended with dense data patterns.

**Dials** (product UI, not a landing page — taste-skill §13 defers dashboards to the
product register; taste's engineering directives still govern generated code):

- `DESIGN_VARIANCE: 3` — task surfaces earn trust through predictable structure; staff
  scan the same list dozens of times a day.
- `MOTION_INTENSITY: 2` — 150–250 ms state transitions only (row update flash, panel
  reveal, skeleton→content); no page-load choreography; `prefers-reduced-motion`
  respected.
- `VISUAL_DENSITY: 7` on the staff dashboard (dense table rows, tabular data),
  `4` on user-facing pages (login, profile, my tickets).

**Design system / stack decision**: No component library added — the constitution locks
React + Vite + Tailwind, and the app already has a bespoke component vocabulary
(`StatusBadge`, `TicketCard`, `MessageBubble`). Mode is **redesign–preserve** for shared
components: extend, don't restyle. New staff components follow the impeccable product
register (consistent affordances, full state coverage: default/hover/focus/active/
disabled/loading/error on every interactive element).

**Palette commitment** (existing lock, extended semantically — one accent, whole app):

- Neutrals: existing `gray` scale, light theme (page theme lock: light everywhere;
  dashboard does not go dark while chat is light).
- Accent: `blue-600` for primary actions, selection, links — actions only, never
  decoration.
- Semantic states: `amber` = escalated/attention (already established in chat),
  `emerald` = resolved/success, `red` = errors/destructive confirmation only.
  Escalated rows get an amber left-edge + badge, not a full tinted row.

**Typography plan**: System-ui sans stack (product-register permission; no webfont
added). One family for everything; fixed rem scale, ratio ≈ 1.2 (12.5/14/16/20/24);
`tabular-nums` on ticket numbers, counts, and timestamps; no display fonts in labels or
data.

**Layout strategy** (per surface, not one generic grid):

- **Staff dashboard**: full-width shell, slim top bar (≤ 64 px: brand, nav links,
  availability selector, account menu) → filter/sort toolbar → dense ticket table
  (rows, hairline dividers, no card grid). Escalated tickets pinned in a distinct group
  at top. Empty state teaches ("No open tickets — new reports appear here live").
- **Ticket detail**: two-column ≥ `lg` (conversation transcript left ~60%; right rail:
  reporter profile panel, status/assignment history, action buttons). Collapses to
  single column with the action bar sticky on mobile. Profile absent → explicit
  "No profile on file" panel, never blank fields.
- **Assignment picker**: inline popover (not modal): roster rows with availability dot
  (semantic state — the one permitted dot use), open-case count, suggested default
  preselected, explicit confirm button.
- **Import flow**: single page, three sequential inline steps (upload → map columns via
  select-per-column → preview table with per-row outcome chips) — no wizard modal.
- **User pages** (login/register/profile/settings/my tickets): centered single column,
  `max-w-md`–`max-w-2xl`, labels above inputs, helper text present, errors below inputs.

**Motion plan**: No canonical scroll skeletons (no GSAP/Motion needed) — CSS transitions
only: skeleton loaders shaped like the final table/panels, 200 ms ease on panel/popover
reveal, one-shot background pulse on SSE-updated rows (feedback, motivated), all gated
behind `prefers-reduced-motion`.

**Banned patterns for this feature** (union of both skills + project):

- Modals as first resort (picker = popover; import = inline steps; confirm destructive
  actions inline).
- Decorative motion, page-load orchestration, infinite loops.
- Glassmorphism, gradients, AI-purple, neon glows, pure black/white.
- Display fonts anywhere; em-dashes (`—`) in any UI copy; emoji as icons.
- Spinner-in-content (skeletons instead); placeholder-as-label; ghost buttons failing
  contrast; decorative status dots (availability dot is semantic and the only one).
- Section-inverting themes (light theme lock); second accent color; card grids for the
  ticket list; fake data in seeds ("John Doe", "Acme") — use realistic names.
- Generic empty states ("nothing here") — every empty state says what appears and how.

**Affected shared components + regression risk** (from graphify):

| Shared item | Used by | Risk / rule |
|---|---|---|
| `App.tsx` | whole SPA | Router insertion changes entry; chat must remain default route behaviour for existing tests |
| `ChatPage.tsx` | chat flow + voice tests | Gains auth requirement (FR-003) — keep voice + guidance test suites green |
| `services/api.ts` | all pages | Adds `credentials:'include'` — verify existing endpoints unaffected |
| `services/useEvents.ts` | ChatPage; now dashboard too | Parameterise stream target without breaking existing signature |
| `lib/types.ts` | pages + tests | Additive types only |
| `StatusBadge.tsx`, `TicketCard.tsx` | chat ticket display; reused on my-tickets/dashboard | Extend variants; do not restyle existing states |
| `SessionForm.tsx` | ChatPage entry | Superseded by account sign-in; retire only after auth path proven |
| Backend `state-machine.ts`, `notifications.ts`, `event-bus.ts` | entire ticket flow (001–003 tests) | Additive transitions/events only; full regression suite must stay green |

**Planned build sequence**: `craft → critique → polish → audit` (per page group, staff
dashboard first), enforced again at `/speckit-implement` by the `before_implement` hook.

## Complexity Tracking

No constitution violations — table not required. (Dependency additions are limited to
`exceljs` and `react-router-dom`, both justified in research R3/R5; auth deliberately
avoids new dependencies per R1/R2.)
