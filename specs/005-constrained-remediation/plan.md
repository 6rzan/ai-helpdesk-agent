# Implementation Plan: Constrained Automated Remediation

**Branch**: `005-constrained-remediation` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-constrained-remediation/spec.md`

## Summary

The agent gains the ability to execute a small, fixed set of pre-approved diagnostic and
remedial commands over SSH against registered isolated test containers, and only those. This
is the sole deliverer of **FR-8**, completes the automated half of **O-3**, and makes
**NFR-4** substantive rather than vacuous. It also adds the **FR-9 / IR §1.5** performance
metrics surface and closes both Compliance Debt Register entries.

Technical approach, in the order the safety argument runs:

1. **Policy as committed data.** The whitelist and the endpoint registry are two JSON files
   in git, zod-validated at startup and frozen. No code path writes them, which makes FR-005
   architectural rather than disciplinary.
2. **A default-deny policy engine** that is the only caller of the executor. Matching is
   exact on action id, every argument, and target endpoint.
3. **An SSH executor** built on `ssh2`, which takes host and port as structured parameters,
   so there is no command line for an unregistered host to appear in. Host keys are pinned.
   Connect and command timeouts are bounded.
4. **Tiered authorisation.** Read-only diagnostics run on the reporter's explicit in-chat
   consent. State-changing actions additionally require a named staff member's approval,
   obtained through a dashboard queue, before anything runs.
5. **An append-only action trail** recording every executed *and* refused action, enforced by
   the absence of any write path, by throwing Mongoose hooks, and by tests.
6. **A bounded plan → act → observe loop** with a registered tool set, activated because
   Principle VIII's staging clause fires the moment side-effecting tools exist. The loop is
   scoped to the moments where an action applies and does not replace the shipped
   deterministic pipeline.
7. **Staff surfaces**: approval queue, audit view, kill switch, and the metrics summary.
8. **An ordered provider fallback chain** mirroring the shipped speech-to-text chain,
   closing CD-1.

All decisions and their rejected alternatives are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.5 in `strict` mode, Node.js 20 LTS.

**Primary Dependencies**: Existing — Express 4, Mongoose 8, zod 3, pino, React 18, Vite 5,
Tailwind 3, `@phosphor-icons/react`. New — `ssh2` (+ `@types/ssh2`) on the backend only. No
new frontend dependency, and specifically no charting library (research R12).

**Storage**: MongoDB Community 7 as a single-node replica set `rs0`, via Mongoose. Two new
collections (`approvalRequests`, `actionRecords`) plus one singleton
(`remediationSettings`). The action policy and endpoint registry are **not** in the database:
they are committed JSON under `backend/src/policy/`, read once at startup (research R3).

**Testing**: Vitest plus supertest on the backend with `mongodb-memory-server` and the `mock`
LLM provider; Vitest plus Testing Library on the frontend. The executor is tested against a
stubbed SSH transport, so the suite needs neither containers nor a running model. Test names
export to the APU Chapter 5 TC-table format via the existing `tc-tables` script.

**Target Platform**: Windows 11 demo machine (HP Victus 16, Ryzen 5 8645HS, 16 GB RAM, RTX
4050). Test endpoints are Linux containers on Docker Desktop with the WSL2 backend.

**Project Type**: Web application — `backend/` (Express REST plus SSE) and `frontend/`
(React SPA), the existing repository layout.

**Performance Goals**: a read-only diagnostic completes inside the 15 s command bound and in
practice within a few seconds; the approval queue and metrics surface render at demo scale
without a loading state that outlasts a page transition; SSE updates for approval and
execution state arrive without a manual reload.

**Constraints**: everything installs, runs, and demonstrates on the single demo machine
inside its 16 GB RAM / 6 GB VRAM envelope while the local model is loaded (NFR-7); no
mandatory cloud dependency; no runtime mutation of policy, registry, or audit trail; nothing
touches a live or production system (NFR-3).

**Scale/Scope**: demo scale. Two or more registered endpoints, nine policy entries (six
read-only, three state-changing), hundreds of tickets, five new or extended frontend surfaces,
and two new backend collections.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1. Result: **PASS**, no violations.*

| Principle | Assessment |
|---|---|
| **I. IR Fidelity** | The spec cites FR-8 (sole deliverer), O-3 (completes it), FR-9 and IR §1.5 (metrics), FR-4, FR-7, NFR-3, NFR-4, NFR-6. Nothing here is an enhancement beyond the IR; the metrics surface is inside FR-9's stated scope, not beyond it. No title or scope change. **Pass.** |
| **II. Safety-First Automation** | Whitelist is versioned reviewable policy data in git, not conditions in code (R3). The executor refuses anything not exactly matched; refusal is the default path (FR-002). Actions run only against registry endpoints, and the `ssh2` structured API means there is no command line for an arbitrary host to enter (R2). Every executed and refused action appends an immutable record (data-model §5). Low confidence escalates (FR-015). No runtime path modifies policy, registry, or trail (FR-005, contracts "Not exposed"). Model output is schema-validated then policy-matched before execution (FR-006). **Pass on all seven clauses.** |
| **III. Human-in-the-Loop** | Escalation remains first-class and is the destination for every refusal, failure, timeout, cap, and decline. Staff retain full visibility and override authority, and gain the approval queue and kill switch. **No new role**: approving staff act in the existing `staff` role, and policy and registry changes are maintainer actions performed outside the application. The two-role model is untouched. **Pass.** |
| **IV. Test-Backed Evidence** | The policy engine, executor, and escalation logic are safety-critical and are developed **test-first**; `tasks.md` must order their failing tests before their implementation. Every other task ships tests in the same task. Remediation joins the release-gated demo path (SC-008, quickstart "Release gate"). **Pass, with a binding obligation on `/speckit-tasks`.** |
| **V. Documentation as a Deliverable** | Chapter 4 evidence: screenshots of the approval queue, audit view, kill switch, and metrics surface; sample-code excerpts for the policy engine and executor; updated architecture, sequence, and ERD diagrams for the new collections and the plan→act→observe loop. Chapter 5: TC tables from the new suites. Evidence tasks needing the live demo machine (container walkthrough, screenshots) may be deferred by dated decision but must be tracked in this feature. **Pass.** |
| **VI. Clean TypeScript Architecture** | Strict TypeScript, no `any` without justification. Every boundary zod-validated: HTTP requests, the two policy files at load, tool arguments, and model output. Structured logging separate from the audit trail, which is not disableable. Files stay under 500 lines, which forces extraction from `DashboardPage.tsx` (9.3K) and `TicketDetailPage.tsx` (13.3K) rather than inflation. LLM access still flows through the single provider abstraction; the chain is added *inside* it as a `ChainedLlmProvider` implementing the existing interface, so no module gains a direct model call. No secrets in version control: SSH keys live in a git-ignored `.keys/`, paths come from env, `.env.example` is updated. **Pass.** |
| **VII. RUP-Aligned Iterative Delivery** | `005` is the next feature in the recorded remaining order, and nothing is being specified ahead of it. The six user stories are independently implementable, testable, and demoable, ordered so the safety spine (US1) and the refusal guarantee (US2) precede any state-changing power (US3). The refining/Transition phase remains unspecified until every feature ships. **Pass.** |
| **VIII. Agent Core & Prompt Engineering** | **The staging clause activates here.** The bounded plan → act → observe loop with a hard per-turn cap and escalation on cap or no-progress is delivered (R5, FR-011, FR-012). Every model capability is a registered tool with a zod schema and an accurate description, and every state-changing tool maps 1:1 onto a policy entry ([contracts/tools.md](contracts/tools.md)). Conversation memory is already persisted per thread in MongoDB. The ordered provider fallback chain is delivered (R4). Prompt modules stay versioned and layered; the new per-tool usage instructions are co-located with tool definitions, and prompt changes must keep the classification and guardrail regression tests green. **Pass, and the staged obligations are now met rather than deferred.** |

**Compliance Debt**: this feature closes **both** open register entries.

| Entry | Closed by | Closing evidence required before the entry is struck |
|---|---|---|
| **CD-1** — ordered provider fallback chain | FR-024, research R4 | `ChainedLlmProvider` in `backend/src/services/llm/`, plus tests proving fall-through on first-provider failure, unchanged single-provider behaviour, and preserved visible degradation with escalation on total failure. The existing `degradation.test.ts` must still pass. |
| **CD-2** — FR-8 constrained automated remediation | The whole feature | The policy engine, endpoint registry, executor, tool registry, and audit trail exist with passing tests, and the whitelisted-remediation leg of the demo path passes on the demo machine. |

Per the Governance rule in constitution v1.2.0, neither entry is struck on intent. Striking
them is a `/speckit-constitution` amendment made **after** the closing tests exist, and
`tasks.md` must carry that as an explicit final task.

## Design Direction

Produced at planning time. Full text:
[DESIGN-DIRECTION.md](DESIGN-DIRECTION.md). The pre-implementation gate re-validates it.

**Design Read**: a safety and oversight layer added to an existing internal IT product UI, for
IT staff authorising and auditing machine actions under time pressure and for an employee in
chat being asked to consent to something a machine will do to a computer. Trust-first,
evidence-first, in the app's existing React + Vite + Tailwind idiom.

**Dials**: DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 6, inherited from feature 004.

**Design system**: dashboards, dense product UI, and data tables sit outside landing-page
design conventions, whose conventional answer would be Fluent, Carbon, Atlassian, or Polaris.
That answer is **overridden by the constitution**, which locks the stack and forbids a new
design-system package. The product register governs process and critique instead. Single light
theme (Page Theme Lock), existing palette, `@phosphor-icons/react` only.

Load-bearing decisions carried into the build:

- **A refusal is not an error and must not be red.** Refusing an out-of-whitelist request is
  Principle II working correctly. Refused, declined, and expired are neutral grey. Red is
  reserved for an approved action that ran and failed.
- **Read-only versus state-changing is never carried by colour alone.** Icon plus written
  label on every action record, so the distinction survives greyscale printing into Chapter 4.
- **One action-record component**, with a fixed field order, rendered in the chat, the ticket
  history, the approval queue, and the audit view. This is what makes the trail a single thing
  to point at in the viva.
- **Append-only must be visible, not merely true.** No edit, delete, or overflow affordance
  anywhere in the audit view, including disabled ones.
- **No optimistic UI on any authorisation or execution state.** Nothing renders as approved,
  running, or done until the server says so.
- **Consent is not a quick reply.** `QuickReplies.tsx` is a casual pill row; consenting to a
  machine changing state gets its own bounded block.
- **Kill switch is asymmetric**: off is one click, on requires confirmation, and a persistent
  banner shows while remediation is disabled.
- **Metrics without a chart library**: stat tiles plus labelled bar rows backed by real text
  values. The data-visualisation conventions apply before that code is written.

**Shared-component regression risk** (from graphify): `lib/types.ts`, `services/api.ts`,
`services/useEvents.ts`, `DashboardPage.tsx`, `TicketDetailPage.tsx`, `ChatPage.tsx`,
`StatusBadge.tsx`, `EscalationNotice.tsx`, `QuickReplies.tsx`, `RouteGuards.tsx`, `App.tsx`.
`StatusBadge` must **not** absorb action-outcome states: ticket status and action outcome stay
separate vocabularies.

**Build sequence**: `craft → critique → layout → colorize → typeset → polish → audit`, then
the final pre-flight check, then the mechanical detector on changed files.

## Project Structure

### Documentation (this feature)

```text
specs/005-constrained-remediation/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0 output
├── data-model.md           # Phase 1 output
├── quickstart.md           # Phase 1 output
├── DESIGN-DIRECTION.md     # design direction, produced at planning time
├── contracts/
│   ├── api.md              # HTTP + SSE contract
│   └── tools.md            # Model-facing tool registry contract
├── checklists/
└── tasks.md                # /speckit-tasks output, not created here
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── policy/
│   │   ├── action-policy.json          # NEW - the whitelist (FR-001)
│   │   ├── test-endpoints.json         # NEW - endpoint registry (FR-003)
│   │   ├── policy-schema.ts            # NEW - zod schemas for both files
│   │   └── policy-loader.ts            # NEW - load, validate, freeze at startup
│   ├── models/
│   │   ├── action-record.ts            # NEW - append-only audit (FR-009/010)
│   │   ├── approval-request.ts         # NEW - staff approval queue (FR-004a/b)
│   │   ├── remediation-settings.ts     # NEW - kill switch singleton (FR-008)
│   │   ├── staff-action.ts             # EXTEND - new action + target values
│   │   └── enums.ts                    # EXTEND - outcome + refusal vocabularies
│   ├── services/
│   │   ├── remediation/
│   │   │   ├── policy-engine.ts        # NEW - default-deny matcher, sole executor caller
│   │   │   ├── executor.ts             # NEW - ssh2 transport, bounded timeouts
│   │   │   ├── audit-service.ts        # NEW - append-only writes
│   │   │   ├── approval-service.ts     # NEW - lifecycle, lazy expiry, atomic decide
│   │   │   └── availability-service.ts # NEW - global + per-endpoint enable state
│   │   ├── agent/
│   │   │   ├── agent-loop.ts           # NEW - bounded plan/act/observe (FR-011/012)
│   │   │   └── tools/                  # NEW - registered tools, 1:1 with policy entries
│   │   ├── metrics/
│   │   │   └── metrics-service.ts      # NEW - on-demand aggregation (FR-023)
│   │   ├── llm/
│   │   │   ├── chained-provider.ts     # NEW - ordered fallback chain (CD-1)
│   │   │   └── factory.ts              # EXTEND - build the chain
│   │   └── conversation/
│   │       └── conversation-engine.ts  # EXTEND - blanket refusal becomes policy decision
│   ├── api/routes/
│   │   ├── staff-approvals.ts          # NEW
│   │   ├── staff-actions.ts            # NEW - audit trail, read-only by construction
│   │   ├── staff-remediation.ts        # NEW - kill switch
│   │   ├── staff-metrics.ts            # NEW
│   │   └── tickets.ts                  # EXTEND - consent + per-ticket actions
│   └── config/index.ts                 # EXTEND - new env schema entries
├── test-endpoints/                     # NEW - compose file, image context, reset + key scripts
└── tests/
    ├── unit/                           # policy matching, argument validation, loop bounds
    └── integration/                    # authorisation tiers, audit immutability, metrics, chain

frontend/
├── src/
│   ├── components/
│   │   ├── ActionRecordCard.tsx        # NEW - the one action-record atom
│   │   ├── ConsentBlock.tsx            # NEW - in-chat consent, not a quick reply
│   │   ├── ActionOutcomeBadge.tsx      # NEW - separate vocabulary from StatusBadge
│   │   └── staff/
│   │       ├── ApprovalQueue.tsx       # NEW
│   │       ├── AuditTrail.tsx          # NEW
│   │       ├── MetricsSummary.tsx      # NEW
│   │       └── RemediationControls.tsx # NEW - kill switch + disabled banner
│   ├── pages/
│   │   ├── DashboardPage.tsx           # EXTEND - queue entry point + metrics band
│   │   ├── TicketDetailPage.tsx        # EXTEND - actions in the existing timeline
│   │   └── ChatPage.tsx                # EXTEND - consent + plain-language reporting
│   ├── services/
│   │   ├── api.ts                      # EXTEND - new endpoints
│   │   └── useEvents.ts                # EXTEND - new SSE event types
│   └── lib/types.ts                    # EXTEND - action, approval, endpoint, metrics types
└── tests/
```

**Structure Decision**: the existing `backend/` + `frontend/` web-application layout is kept
unchanged, per the constitution's repository-layout constraint. No new top-level directory is
introduced: the container definitions live under `backend/test-endpoints/` because they are
environment artifacts serving the backend's executor, and the policy files live under
`backend/src/policy/` so they are shipped, reviewed, and version-controlled with the code that
enforces them.

Both large existing pages are already near the 500-line ceiling. `TicketDetailPage.tsx` (13.3K)
and `DashboardPage.tsx` (9.3K) must have their timeline and list sections **extracted into
components before** this feature's additions land, not after.

## Complexity Tracking

No Constitution Check violations. This section is intentionally empty.

Two items are recorded here as deliberate additions rather than violations, because a reviewer
will reasonably ask about both:

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| `ssh2` dependency | FR-020 requires SSH-reached container endpoints, and O-3 names SSH explicitly | Spawning the `ssh.exe` binary means assembling a command line, which is precisely the injection surface FR-003 and FR-006 exist to eliminate |
| Container runtime as a new prerequisite | FR-020 requires isolated, resettable endpoints distinct from the demo machine | Running an SSH server on the demo machine itself would make the host its own test endpoint, which NFR-3 and the spec's assumptions forbid |
