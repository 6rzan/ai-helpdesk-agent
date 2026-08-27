# Implementation Plan: Refining & Transition Phase

**Branch**: `006-refining-transition` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-refining-transition/spec.md`

## Summary

This is the RUP **Transition** increment: the project's last phase before submission. It
ships no new product capability. Its output is (1) one continuous cross-feature
verification run on the demo machine, (2) closure of every evidence item earlier features
deferred, (3) User Acceptance Testing with at least three external testers, (4) the two
Objective-4 deliverables — a requirements traceability assessment and a perceived-usefulness
measurement, (5) bounded refinement driven by that feedback, and (6) role-specific written
guidance.

The technical approach is deliberately conservative. The single largest delivery risk is
**not** the tester logistics — it is that the "release-gated demo path" the whole phase
gates on (FR-002, SC-008) currently exists only as a hand-driven `curl` sequence whose last
full log (`docs/testing/demo-path-log.md`, 2026-07-09) predates both the voice leg and the
remediation leg it must now cover. That path has to run **twice** and pass **first time**
on both occasions. So the first work item of this phase is to make the demo path a single
repeatable, re-runnable artifact covering all legs, before any tester is scheduled.
Everything else in the phase depends on that artifact existing.

## Technical Context

**Language/Version**: TypeScript 5.x, `strict` — unchanged. No new runtime code is planned;
only bounded refinement edits under FR-016.

**Primary Dependencies**: Existing only — Node.js LTS + Express, Mongoose, React + Vite +
Tailwind, Vitest + supertest, LM Studio serving `qwen2.5-7b-instruct` over `openai_compat`.
No dependency is added by this phase.

**Storage**: MongoDB Community via Mongoose. **The demo machine must run the documented
single-node replica set `rs0`** — not `mongodb-memory-server`, which the 2026-07-09 demo-path
log actually used. Transactional steps (Excel import apply) fail by design without it.

**Testing**: Vitest (backend + frontend) and supertest for automated suites; `npm --prefix
backend run tc-tables` regenerates `docs/testing/tc-tables.md` from test names matching
`TC-\d+`. UAT session records are **human** records and cannot flow through that generator —
they are authored by hand in the same TC-table column format (see research.md, Decision 4).

**Target Platform**: HP Victus 16 (Ryzen 5 8645HS, 16 GB RAM, RTX 4050, Windows 11) — the
single designated demo machine. All sessions and all evidence originate here (NFR-7).

**Project Type**: Web application (`backend/` + `frontend/`). This increment is
process- and evidence-led rather than code-led.

**Performance Goals**: No new goals. Existing gates are preserved and re-verified, not
re-tuned: SSE status propagation ≤ 2 s (observed 109 ms), classifier p90 1.6 s at 100%
benchmark accuracy. A refinement that moves either is a regression, not an improvement.

**Constraints**: FR-016 is the binding constraint — no new functional requirement, no
relaxed safety control, no third account role, no automated action beyond registered test
endpoints. Evidence is written into the existing `docs/` tree, not a parallel set. At least
3 testers (hard floor), at least 1 exercising the staff workspace. No personally
identifying detail beyond agreed demographic bands (NFR-5).

**Scale/Scope**: 16 IR-level requirements (FR-1…FR-9, NFR-1…NFR-7) receive verdicts, plus
coverage statements for objectives O-1…O-4. 3–5 testers × ~8 scenarios. 6 mandated issue
categories, all of which must be exercised. Existing surface under refinement: 13 pages,
21 components, 4 prompt modules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see below.*

| Principle | Verdict | Basis |
|---|---|---|
| **I. IR Fidelity** | **PASS** | Adds no capability. Traces O-1…O-4 and IR FR-1…FR-9 / NFR-1…NFR-7 as the *subjects of verification*. FR-016 writes the anti-drift rule into the requirements themselves rather than leaving it to judgement. |
| **II. Safety-First Automation** | **PASS** | No change to policy data, executor, endpoint registry, or audit path. A tester attempting remediation against an unregistered target must be **refused** — the spec correctly records that as a *passed safety scenario*, not a defect. FR-016 forbids relaxing a control to smooth a tester's path. |
| **III. Human-in-the-Loop** | **PASS (with a recorded governance flag)** | The locked two-role model is untouched; FR-016 forbids a third. The admin UI is deferred beyond this phase. **Flag carried forward, not resolved here**: the preferred future admin console includes remediation-policy editing, which conflicts with Principle II's "changes are human-made, code-reviewed configuration changes". That conflict must be resolved — by narrowing scope or amending the principle with supervisor agreement — *before* that feature is specified. |
| **IV. Test-Backed Evidence** | **PASS** | This phase is largely the discharge of Principle IV: UAT ≥ 3 testers, the O-4 dual deliverable, and the release gate run before the first session and after the last refinement. |
| **V. Documentation as Deliverable** | **PASS** | Principle V permits dated deferral of demo-machine evidence only if tracked and cleared before submission. FR-003 is that clearing: 001 T049, 003 T046, 003 T047, 005 T119 — all four confirmed still open. |
| **VI. Clean TypeScript Architecture** | **PASS (with one live breach to disposition)** | Refinement edits must preserve `strict`, ≤ 500-line files, and "no dead code". **`frontend/src/components/SessionForm.tsx` currently has a passing test suite and zero production consumers** — a standing breach of the no-dead-code clause, and green coverage over unshipped code. Logged as an observation for explicit disposition (§Complexity Tracking), not silently deleted. |
| **VII. RUP-Aligned Iterative Delivery** | **PASS** | This is Principle VII item 6, correctly timed: all of 001–005 have shipped, so the system-wide phase is no longer specified against a moving target. Deferring the admin UI keeps the ordering intact. |
| **VIII. Agent Core & Prompt Engineering** | **PASS (conditional gate — see below)** | **Live risk:** US4 permits wording refinement, and the agent's plain-language tone (NFR-2) is produced by prompt modules at `backend/src/services/llm/prompts/{core,classification,guidance,tools}.ts` — not by UI strings. Any tester-driven wording change that lands in a prompt module is a **prompt change**, so `backend/tests/unit/classification.test.ts` and the guardrail/escalation suites MUST pass before it merges. A prompt regression is a real regression. |

**Compliance Debt**: The register is **empty** (both CD-1 and CD-2 closed 2026-08-21). This
phase therefore closes no entry. FR-021 requires it be **re-verified empty at phase end**,
together with recorded coverage statements for O-1…O-4 — objective coverage, not only the
requirement list. Nothing in this plan may add an entry; an item that would is out of scope
under FR-016 and gets declined.

**Post-Phase-1 re-check**: PASS, unchanged. The Phase 1 design adds only documents and
record formats under `docs/` and `specs/006-refining-transition/`. It introduces no runtime
module, no endpoint, no collection, and no dependency, so no principle's surface moves. The
two conditional items (VI dead code, VIII prompt-regression gate) are carried into
`quickstart.md` as explicit gates rather than left as prose.

## Project Structure

### Documentation (this feature)

```text
specs/006-refining-transition/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── session-record.md          # UAT session record + TC-table column mapping
│   ├── traceability-verdict.md    # Requirement verdict row format
│   └── usefulness-instrument.md   # Perceived-usefulness question set + scoring
├── checklists/
│   └── requirements.md  # Pre-existing
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/            # routes, middleware, sse
│   ├── models/
│   ├── policy/         # whitelist policy data + engine (untouched this phase)
│   ├── services/
│   │   ├── agent/      # plan → act → observe loop
│   │   ├── conversation/
│   │   ├── llm/prompts/  # core | classification | guidance | tools  ← Principle VIII gate
│   │   └── remediation/
│   ├── scripts/        # seed-guides, seed-staff
│   └── server.ts
├── scripts/            # availability-probe.ts, tc-tables.ts
└── tests/              # unit | integration | benchmark

frontend/
├── src/
│   ├── components/     # 15 shared + 6 staff-scoped
│   ├── pages/          # 8 user-facing + 5 staff
│   ├── context/  services/  lib/
└── tests/

docs/                   # ← the phase's primary output surface
├── design/             # architecture, erd, sequence-diagrams
├── implementation/     # sample-code, screenshots/
└── testing/            # tc-tables, demo-path-log, requirements-traceability,
                        #   benchmark-results, feature-004-uat
```

**Structure Decision**: The existing `backend/` + `frontend/` web-application layout is
retained unchanged — this phase adds no source directory. Its deliverables land in the
existing `docs/testing/` and `docs/implementation/` trees, **extending** the records already
there rather than starting a parallel set (per the spec's Assumptions). Specifically:
UAT records, the traceability assessment, and the usefulness report join `docs/testing/`;
the four deferred evidence artifacts join `docs/testing/` and `docs/implementation/screenshots/`;
role guidance is new material in `docs/`. Refinement edits, when they occur, touch existing
files in `frontend/src/` and possibly `backend/src/services/llm/prompts/` — the latter
triggering the Principle VIII regression gate.

## Design Direction (frontend-design-pro)

**Scope note — this is a refinement charter, not a design brief.** Feature 006 ships no
new UI. Its only frontend surface is (a) bounded wording/ordering refinement driven by
tester feedback (US4, FR-014…FR-017), (b) UI screenshots as deferred evidence (FR-003),
and (c) guidance that must match real screens (FR-019). A palette/typography/motion plan
is deliberately **not** issued here: inventing one would be new design work, which FR-016
forbids and the phase's own assumption ("no new product capability") rules out.

### Design Read

*Reading this as: a verification-and-refinement pass over an existing multi-role support
product (employee chat + IT staff workspace), for an examiner and three unfamiliar
testers, with a plain-language trust-first language, leaning toward preserving the shipped
system exactly and changing only what a tester demonstrably misread.*

### Dials — preserve-mode

| Dial | Value | Justification |
|---|---|---|
| `DESIGN_VARIANCE` | **match existing (no change)** | Taste-skill "redesign — preserve" row. Variance is a property of the shipped UI; 006 has no mandate to move it. |
| `MOTION_INTENSITY` | **match existing (no change)** | The usual "+1" preserve bonus is suppressed: added motion during a UAT phase would invalidate the before/after comparison the evaluation depends on. |
| `VISUAL_DENSITY` | **match existing (no change)** | Density changes would alter task-completion timings that SC-003 measures. |

Constitution NFR-2 (plain, jargon-free, logically ordered guidance) is the one axis that
*is* live this phase — it is what US4 refinements are permitted to move.

### Design system / stack decision

No new system. The project is an existing React + TypeScript SPA (react-router,
`@phosphor-icons/react`, hand-rolled components — no third-party design system).
Taste-skill §2.A explicitly does not apply: introducing Fluent/Carbon/shadcn now would be a
rewrite, not a refinement. Impeccable's context probe returned `NO_PRODUCT_MD` and routes
this to its **scoped-fix** path, which does not require the new-surface flow. `/impeccable
init` remains available but is not a blocker and is not recommended mid-phase.

### What refinement MAY change

- Copy and microcopy where a tester demonstrably misread it (NFR-2).
- Step ordering within an existing flow where a tester got lost.
- Error, empty, and degraded-state wording — including the degraded-model notice the spec's
  edge cases expect testers to encounter.
- Genuine functional defects logged under FR-014.

### What refinement MUST NOT change (banned this phase)

Union of both skills' bans plus phase-specific ones; the phase-specific bans bind harder:

- **No restyle.** No palette, type-scale, spacing-system, or component-shape changes.
- **No new motion**, no added transitions, no "polish" animation passes.
- **No new screens, routes, or navigation entries** — a new screen is a new functional
  requirement (FR-016).
- **No relaxing a safety control** to smooth a tester's path — the remediation refusal is a
  *passing* scenario, not a UX defect.
- **No third account role**, no maintainer console (deferred beyond this phase).
- Standing craft bans apply to any touched markup: no glassmorphism-by-default, no gradient
  text, no emoji-as-icons, no AI-purple default, no em-dashes in UI copy.

### Affected shared components + regression risk

Verified by import-graph fan-in across `frontend/src`. Wording changes to these reach more
than one screen, so each edit is re-validated against the **full** scenario set, not only
the report that prompted it.

| Component | Consumers | Risk |
|---|---|---|
| `ActionRecordCard` | `ChatPage`, `staff/AuditTrail`, `TicketTimeline` | **Highest.** Spans employee chat, staff audit trail, and ticket detail. One wording change lands in all three, and the staff-side audit copy is itself FR-003 evidence for feature 005. |
| `ActionOutcomeBadge` | via `ActionRecordCard` (all three above) | Transitive; outcome vocabulary is quoted in remediation evidence. |
| `AppNav`, `RouteGuards` | `App.tsx` — every authenticated route | Global. A label change alters every role's navigation and every guidance document under FR-018/FR-019. |
| `StatusBadge` | via `TicketCard` → `ChatPage` | Status vocabulary appears in guidance; must stay in step with backend status values. |
| `MetricsSummary` | via `MetricsBand` → `DashboardPage` | Staff-only; low blast radius. |

**Two findings to log as US4 observations** (not defects to fix silently):

1. **`MyTicketsPage` renders ticket status and list rows inline** instead of reusing
   `TicketCard`/`StatusBadge`. Employee-facing status wording therefore lives in two places
   that can drift. If a tester misreads status wording, fixing only `StatusBadge` leaves
   `MyTicketsPage` stale — and FR-019 then fails, because guidance would describe wording
   one screen does not show. Check both whenever status copy moves.
2. **`SessionForm` has a passing test suite and zero production consumers.** See
   Complexity Tracking.

### Planned build sequence

The standard `craft → critique → polish → audit` does not run — there is nothing to craft.
The applicable sequence is:

`audit (on evidence screens, before screenshots) → critique (only surfaces a tester flagged)
→ minimal copy/order fix → re-validate full scenario set → detect`

Run the mechanical detector once, at the end, over only the files refinement actually
touched. Do **not** run it across the untouched app: findings on shipped code that no tester
flagged are out of scope this phase and would invite exactly the drift FR-016 guards
against. After any frontend edit, run `graphify update .`.

## Complexity Tracking

> Filled because the Constitution Check raised two items that must not be resolved silently.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **`SessionForm.tsx` is dead code with a green test suite** — breaches Principle VI ("no dead code") and mildly inflates the test-file count cited as Chapter 5 evidence. | Not "needed" — it is a pre-existing breach this phase surfaced. It is carried into triage as a logged observation under FR-014 so it receives an explicit, recorded disposition (delete / wire up / accept with reason). | Silently deleting it during refinement was rejected: FR-004 and FR-014 require failures and observations to stay visible in the record rather than being quietly repaired. Discovering it at viva instead is the worse outcome. |
| **Prompt modules are in scope for wording refinement** — a UI-copy change may actually belong in `services/llm/prompts/`, pulling Principle VIII's regression obligation into a phase framed as "no code changes". | NFR-2's plain-language guarantee is produced by the prompt layer, so genuine tester confusion about agent wording can only be fixed there. Excluding prompts would make some US4 feedback unfixable. | Treating prompt edits as ordinary copy edits was rejected: Principle VIII makes a prompt regression a real regression, so the classification and guardrail suites gate every such change. This is recorded as a gate in `quickstart.md`, not left to memory. |
