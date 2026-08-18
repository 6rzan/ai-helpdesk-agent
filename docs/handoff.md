# Project Handoff

**Project**: AI Help Desk Agent — B.Sc. (Hons) Computer Science FYP, Asia Pacific University
**Last updated**: 2026-08-19
**Branch**: `main` (all work is committed to `main` directly)

This document records what has been delivered, the verified state of the codebase, and
what a person picking the project up next should do. It complements the per-feature
specs in `specs/` rather than replacing them.

---

## 1. Where the project has reached

Four features are specified, implemented, and merged. Feature 004 is the most recent
and is the "new feature" this handoff covers in detail.

| Feature | Title | Tasks | State |
|---|---|---|---|
| 001 | Conversational & Ticketing Foundation | 50 / 51 | Shipped — 1 task deferred by decision (see §5) |
| 002 | Voice Input | 34 / 34 | Shipped |
| 003 | Guided Troubleshooting | 46 / 48 | Shipped — 2 evidence-capture tasks open (see §5) |
| 004 | Staff Dashboard & User Accounts | 97 / 97 | **Shipped and complete** |

No feature 005 has been specified yet. Per the project's working agreement, the
system-wide refining/UAT/polish phase is specified only after **all** features have
shipped — it is deliberately not an early spec. Per-feature tests remain mandatory
and are in place for everything above.

---

## 2. Feature 004 — what was delivered

Feature 004 is the largest feature to date. It introduced the account model and the
entire staff-facing side of the product.

### Accounts and roles

The system has **exactly two account roles**, as mandated by FR-001:

| Role | Obtained by | Grants |
|---|---|---|
| `user` | Automatic on registration. `POST /auth/register` hardcodes the role and ignores anything in the request body. | Chat, own ticket history, own support profile, account settings |
| `staff` | The maintainer-run `npm run seed:staff` script **only**. | Everything `user` has, plus the full `/staff` workspace |

There is **no admin role**, and this is a deliberate design decision, not an oversight.
Spec checklist item CHK007 (`specs/004-staff-dashboard/checklists/requirements.md:61`)
specifically tested whether the "administrative/maintainer action" that grants the staff
role might leak into becoming an undeclared third role, and resolved that it must not:
the maintainer is a seed-script action, not an in-app role.

Separately, there is a **maintainer surface** at `/api/admin/*` for category and guide
administration, inherited from feature 003. It is a different axis entirely — a shared
`MAINTAINER_KEY` request header, not an account, not a session, and unable to read
tickets or alter roles. The routes are not mounted at all when `MAINTAINER_KEY` is unset.
`research.md:159-166` records the rationale: keep administrative action off the web attack
surface for now; an admin UI may grow in feature 005+ if it is ever needed.

Sessions are opaque server-side tokens in an HTTP-only cookie. Every authenticated
request re-reads the account, so role revocation and password resets take effect on the
next action. Changing a password invalidates all other sessions for that account.

### Employee self-service

- Personal ticket history at `/tickets`, scoped to the signed-in account, with detail
  view and a dedicated SSE stream (`/my/events`).
- Self-service support profile at `/profile` — remote-access tool IDs, location,
  hardware notes — surfaced to staff on escalated tickets.
- Account settings at `/settings` for password changes.

### Staff workspace

- Dashboard at `/staff` with status/category filters, sorting, and a separate escalated
  group.
- Ticket detail with transcript, classification context, status history, permitted
  transitions, and the reporter's profile when one exists.
- Atomic takeover of unassigned escalations, and explicit reassignment. The suggested
  assignee is **advisory only** — assignment always requires deliberate confirmation.
- Availability controls (`available` / `busy` / `away`) and a roster exposing
  availability and open-case counts.
- Staff-appended profile notes and corrections that never overwrite what the employee
  entered.
- Initial-password reset that immediately revokes the target account's sessions.
- Excel (`.xlsx`) user import: upload → column mapping → dry-run preview → transactional
  apply.
- Every staff action is written to an append-only `StaffActionRecord` audit trail.

---

## 3. Verified state

All quality gates were run on 2026-08-19 and pass:

| Gate | Result |
|---|---|
| Backend typecheck (`tsc --noEmit`) | PASS |
| Backend lint (ESLint) | PASS — no issues |
| Backend Vitest | PASS — 38 files, **217 tests** |
| Frontend typecheck | PASS |
| Frontend Vitest | PASS — **81 tests** |

Reproduce with `npm run typecheck && npm run lint && npm test` in `backend/`, then
`npm run typecheck && npm test` in `frontend/`.

Note: the backend suite excludes `tests/benchmark/` by default; run those separately
with `npm run test:benchmark`.

Role and access control specifically are covered by:

- `backend/tests/integration/access-control.test.ts` — session and role gating
- `backend/tests/integration/my-tickets.test.ts` — own-ticket isolation between accounts
- `backend/tests/integration/test-support-guard.test.ts` — test-only routes absent outside `test`/`demo`

---

## 4. Environment requirements a newcomer will trip over

**MongoDB must be replica-set capable.** The Excel Import *Apply* step runs inside a
MongoDB transaction, which standalone `mongod` does not support. A standalone server
returns MongoDB error code 20 by design — this is not a bug. Run the documented
single-node `rs0` setup (see README → Prerequisites) and confirm
`db.hello().isWritablePrimary` prints `true` before starting the backend. Ordinary chat
and dashboard flows work fine on a standalone database; only Import Apply requires the
replica set.

**LLM runtime is optional for development.** Set `LLM_PROVIDER=mock` for a deterministic
provider with no external dependency. The local reference setup uses LM Studio serving
`qwen2.5-7b-instruct` at `http://127.0.0.1:1234/v1` via `LLM_PROVIDER=openai_compat`.

**Staff accounts cannot be created through the UI.** Use
`npm run seed:staff -- <email> "<Display Name>"` in `backend/`. The generated initial
password is written to the backend log.

---

## 5. Outstanding items

Three tasks remain open across features 001 and 003. All three are **documentation and
manual-evidence capture** — no code is missing, and no automated gate is failing.

| Task | What it needs |
|---|---|
| 001 T049 | Run the 24-hour availability probe (`backend/scripts/availability-probe.ts`) unattended on the demo machine and record the log in `docs/testing/`. Deferred by explicit decision on 2026-07-11 — to be run before final submission. |
| 003 T046 | Capture chat screenshots of a guided flow to resolution and to escalation, for Chapter 4. The sequence diagram and TC tables portions of this task are already done. |
| 003 T047 | Walk the five `quickstart.md` scenarios manually on the demo machine. The automated gates portion is done and green. |

These need a live demo machine and a browser session; they cannot be completed from a
headless environment.

---

## 6. Suggested next steps

1. **Decide feature 005 scope.** Nothing is specified beyond 004. Run `/speckit-specify`
   once the scope is chosen.
2. **Clear the three evidence tasks** (§5) during the next session on the demo machine —
   they gate final submission, not development.
3. **Refining phase** — system-wide testing, UAT, and polish — is specified only after
   all features have shipped.

---

## 7. Orientation for whoever picks this up

- Architecture, endpoint list, configuration, and troubleshooting are in
  [`../README.md`](../README.md) — it was verified against the code on 2026-08-19 and is
  accurate as of this handoff.
- Per-feature specs, plans, tasks, and API contracts are under `specs/`.
- Design diagrams and test traceability are under `docs/design/` and `docs/testing/`.
