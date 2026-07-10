<!--
Sync Impact Report
==================
Version change: 1.0.1 → 1.0.2 (PATCH, 2026-07-11): agent-tooling references in
Development Workflow and Governance reworded to be tool-agnostic; no principle,
gate, or obligation changed.
Previous: 1.0.0 → 1.0.1 (PATCH, 2026-07-10): frontend design-skill clause
strengthened — SHOULD (impeccable, taste) → MUST use `frontend-design-pro` (combined
orchestrator). Dependent updates: .specify/extensions.yml created (before_plan /
before_implement hooks), .specify/templates/plan-template.md gained a
"Design Direction (frontend-design-pro)" placeholder section.
Previous: (template) → 1.0.0 (initial ratification)
Modified principles: n/a — first concrete adoption
Added sections:
  - Core Principles I–VII (IR Fidelity; Safety-First Automation; Human-in-the-Loop;
    Test-Backed Evidence; Documentation as a Deliverable; Clean TypeScript Architecture;
    RUP-Aligned Iterative Delivery)
  - Technology Stack & Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none (all template placeholders resolved)
Templates requiring updates:
  - ✅ .specify/templates/tasks-template.md — "tests optional" wording replaced to match
    Principle IV (tests mandatory per feature; safety-critical work test-first)
  - ✅ .specify/templates/plan-template.md — no change needed (generic Constitution Check
    gate is populated per-plan from this document)
  - ✅ .specify/templates/spec-template.md — no change needed (FR/SC structure already
    supports IR traceability required by Principle I)
  - ✅ .specify/templates/checklist-template.md — no change needed
Follow-up TODOs: none
-->

# AI Help Desk Agent Constitution

Project: **Designing Artificial Intelligence Help Desk Agent for Organisational IT Support
Automation** — APU B.Sc. (Hons) Computer Science Final Year Project, Part 2 (FYP).
Student: Taha Fahd Ahmed Mohammed Thabit (TP078281, APU3F2601CS).
Supervisor: Aziah Binti Abdollah. Second Marker: Chong Mien May.
This constitution governs all specification, planning, task generation, and implementation
work performed in this repository, by humans and by AI agents alike.

## Core Principles

### I. IR Fidelity — Scope Is Locked

The approved Investigation Report (IR) and Project Proposal Form (PPF) are the binding
contract for this project. The project title is locked at IR stage and MUST NOT change.

Every feature specification MUST trace to at least one of the IR-derived requirements
below (cite the ID in the spec). These requirements are reproduced here so downstream
speckit commands never depend on re-reading the IR PDF:

**Functional requirements (IR §3.4.5):**
- **FR-1**: Accept user input as text or voice; voice MUST be transcribed to text before
  any analysis (all processing operates on text).
- **FR-2**: Support reporting of at least six issue categories: (a) password/login,
  (b) internet/network connectivity, (c) printer, (d) peripheral devices (keyboard,
  mouse, etc.), (e) slow device performance, (f) basic service status checking.
- **FR-3**: Classify each reported problem into a fixed category and automatically create
  a ticket carrying timestamps and reporter-supplied information.
- **FR-4**: Present guided step-by-step troubleshooting immediately after categorisation.
- **FR-5**: Be available beyond standard working hours (24/7 within the controlled test
  environment).
- **FR-6**: Make ticket status visible in plain messages; every change of handling mode
  (automated / waiting on user / human involved) MUST be reflected without delay.
- **FR-7**: Escalate to human IT staff on complexity, ambiguity, low classification
  confidence, or explicit user preference.
- **FR-8**: Execute only predefined automated remediation (approved scripts, restart of
  approved test nodes) under strict guidelines: permission-governed, continuously logged,
  and only against designated test endpoints.
- **FR-9**: Provide a web-based dashboard where IT staff see tickets, follow progress
  updates, and handle urgent or escalated matters.

**Non-functional requirements (IR §3.4.5):**
- **NFR-1**: Fast responses for common problems; minimise waiting for simple fixes.
- **NFR-2**: Guidance in plain, jargon-free language with logically ordered steps.
- **NFR-3**: Operate inside a secured, isolated test environment; the system MUST NOT
  touch live or production systems.
- **NFR-4**: Human oversight remains possible for critical operations; automation is
  limited to pre-approved functions only.
- **NFR-5**: Data minimisation — collect no unnecessary personal details; access to
  stored logs restricted to approved roles.
- **NFR-6**: AI handles simple tasks; complex cases route to humans (division of labour).
- **NFR-7**: The whole system MUST run on the available hardware (HP Victus 16, Windows
  11) under student-project conditions, with no mandatory external infrastructure.

Features beyond the IR are **enhancements**: permitted only when they strengthen an
IR requirement and never at the expense of completing one. Production deployment,
unrestricted network access, and autonomous action on live infrastructure are
permanently out of scope.

**Rationale**: APU locks FYP titles at IR stage, and markers assess the end-product
against the IR-documented scope. Drift is the primary failure mode this constitution
exists to prevent.

### II. Safety-First Automation (NON-NEGOTIABLE)

The agent follows the AgenticOps pattern (as productised at enterprise scale by Cisco
Cloud Control, June 2026): every automated action is **deterministic, policy-bound,
auditable, and human-supervised**.

- The command whitelist is versioned, reviewable **policy data** (a dedicated policy
  file/collection), never conditions scattered through code.
- The command executor MUST refuse any action not exactly matched by the whitelist;
  refusal is the default path, execution the exception.
- Automated actions run ONLY against designated, isolated test endpoints registered in
  configuration. There is no code path to arbitrary hosts.
- Every executed AND refused action MUST append an immutable audit record: timestamp,
  actor (user/agent/staff), classified intent, exact command, target endpoint, outcome.
- Low model confidence MUST trigger escalation (FR-7), never a guess.
- The agent MUST NOT modify its own policy, whitelist, or endpoint registry at runtime;
  changes are human-made, code-reviewed configuration changes.
- LLM output is untrusted input: any tool call or command derived from model output is
  validated against the whitelist and schema before execution.

**Rationale**: This is the defining architectural constraint of the IR (Abstract, §1.5,
FR-8, NFR-3/NFR-4) and the property markers will probe hardest in the viva. It is also
what survey respondents demanded — bounded automation with human control.

### III. Human-in-the-Loop Division of Labour

The AI handles the six routine categories (FR-2); complex, ambiguous, or risky cases go
to human IT staff — the split preferred by 75.8% of survey respondents.

- Escalation is a **first-class feature** with its own state model, UI, and tests — never
  a bare error path.
- The IT staff dashboard MUST give staff full visibility (tickets, agent actions, audit
  log) and override authority at every stage.
- Handover MUST preserve context: the ticket carries the conversation, classification,
  and any actions already attempted, so users never repeat themselves (a top survey
  frustration).

**Rationale**: The IR positions the agent as workload triage, not staff replacement;
preserving human judgment where risk rises is both the ethical stance and the documented
user expectation.

### IV. Test-Backed Evidence (Chapter 5 Discipline)

- Safety-critical components — whitelist policy engine, command executor, escalation
  logic — MUST be developed test-first (TDD): failing tests exist before implementation.
- Every other feature MUST ship automated tests in the same task; no task is complete
  with untested behaviour.
- Test cases MUST be expressible in the APU Chapter 5 TC-table format (TC-No / input /
  expected output / actual output / Passed-Failed). Test naming and reporting are chosen
  so these tables can be generated, not hand-written after the fact.
- User Acceptance Testing with a minimum of 3 testers (demographics recorded, pseudonyms
  allowed) MUST be performed before final submission.
- The scripted end-to-end demo path (report issue → classify → ticket → guided fix →
  whitelisted remediation on a test endpoint → escalation → dashboard view) is a
  **release gate**: it MUST pass on the demo machine before every supervisor meeting,
  the demo video recording, and the 25-minute live presentation demo.

**Rationale**: APU marks are awarded on documented testing evidence, and the FYP
presentation includes a 25-minute live software demonstration — reliability of the demo
path is worth more than any extra feature.

### V. Documentation as a Deliverable

Moderators only read the documentation; the report carries the marks. Therefore:

- Every implemented feature MUST leave documentation evidence in `docs/` as it is built:
  UI screenshots (Chapter 4 Implementation), named sample-code excerpts (Chapter 4.6),
  TC tables (Chapter 5), and design diagrams — architecture, use case, sequence, ERD/
  schema (Chapter 4.2–4.4) — kept current with the code.
- Academic writing rules apply to all report-bound prose: third person ("the developer",
  never "I"), APA referencing, concise/precise/clear, original wording (Turnitin ≤ 20%).
- Final deliverables the repo must be able to produce at any time: MS Word documentation
  (~10,000 words, ≤ 200 pages incl. appendices, justified, 1.5 spacing), zipped complete
  source code (≤ 1 GB or cloud link), 5–7 minute demonstration video, A3 poster content,
  and appendix materials (PPF, ethics forms, 6 log sheets, Gantt chart, sample code,
  respondent/tester demographics, Turnitin report).

**Rationale**: Sem-2 briefing is explicit — documentation and end-product carry equal
weight, and moderation is documentation-only. Producing evidence continuously avoids a
reconstruction crunch at submission.

### VI. Clean TypeScript Architecture

- TypeScript 5.x in `strict` mode across backend and frontend; no `any` escape hatches
  without a justifying comment.
- Backend: Node.js LTS + Express (REST APIs and webhooks). Frontend: React + Vite +
  Tailwind CSS single-page app (user chat UI + staff dashboard) served for the demo from
  the same machine. Data: MongoDB Community Edition via Mongoose schemas.
- Source files ≤ 500 lines; single-responsibility modules; no dead code.
- All external input — HTTP requests, LLM output, tool arguments, uploaded audio — MUST
  be schema-validated (zod) at the boundary before use.
- Structured logging throughout; audit logging per Principle II is separate from debug
  logging and MUST NOT be disableable in normal operation.
- **LLM access flows through exactly one provider-abstraction module.** Reference
  configuration (reported in the FYP): self-hosted open-source model via Ollama.
  Alternate configurations: developer-supplied API-key or OAuth providers. No module
  besides the abstraction may call a model directly — this keeps the safety layer
  (Principle II) un-bypassable and providers swappable by configuration only.
- Speech-to-text sits behind the same abstraction discipline and MUST offer at least one
  fully local option (voice never has to leave the machine in the reference config).
- No secrets, credentials, or `.env` files in version control; configuration by
  environment with committed `.env.example`.

**Rationale**: The IR commits the project to the Node.js/JavaScript ecosystem, Express,
MongoDB, and self-hosted open-source AI tooling on the HP Victus machine; TypeScript,
validation-at-boundaries, and the single LLM gateway are how that stack stays clean,
safe, and defensible line-by-line in the viva.

### VII. RUP-Aligned Iterative Delivery

Part 2 executes the RUP **Construction** and **Transition** phases declared in IR
Chapter 3, realised as speckit cycles.

- Every feature follows the pipeline: `/speckit-specify` → `/speckit-clarify` (when
  ambiguity exists) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- User stories MUST be independently implementable, testable, and demoable increments
  (MVP-first), so a working demo exists from the earliest iteration onward.
- Priority order follows survey frequency and IR emphasis: password/login → network →
  printer → peripherals & slow performance → service status → constrained remediation →
  dashboard & polish. Core conversational + ticketing foundation precedes all categories.
- Transition-phase activities — user trials, feedback-driven tuning within experimental
  boundaries, and role-specific user guidance drafts — are scheduled work items, not
  afterthoughts.
- Supervisor checkpoints: minimum 3 logged meetings this semester on official log
  sheets, each preceded by a passing demo path (Principle IV).

**Rationale**: RUP is the methodology the IR justifies and markers will expect to see
enacted; speckit cycles are its concrete, auditable implementation in this repository.

## Technology Stack & Constraints

| Concern | Committed choice | Notes |
|---|---|---|
| Language | TypeScript 5.x (strict) | Node.js/JavaScript ecosystem per IR §2.4.2 |
| Backend | Node.js LTS + Express | REST + webhooks; serves built frontend for demo |
| Frontend | React + Vite + Tailwind CSS | Chat UI + IT staff dashboard (FR-9) |
| Database | MongoDB Community + Mongoose | Tickets, conversations, audit log (IR §2.4.5) |
| LLM | Provider abstraction; default self-hosted Ollama | Alternates: own API key / OAuth providers |
| Speech-to-text | Local-capable engine behind abstraction | Voice → text before analysis (FR-1) |
| Agent core | Custom orchestration on open-source tooling | Intent → policy check → tool call → audit; no heavyweight agent framework |
| Testing | Vitest (unit + integration) + supertest | Exports to Chapter 5 TC tables |
| Remediation targets | Registered isolated/virtual test endpoints only | SSH / local script runners; never production (NFR-3) |
| Dev & demo machine | HP Victus 16 — Ryzen 5 8645HS, 16 GB RAM, RTX 4050, Windows 11 | Everything MUST install, run, and demo on this one machine; model sizes chosen to fit |
| Dev environment | VS Code + Git | Per IR §2.4.3 |

Constraints: no mandatory cloud dependency on the core path (reference config is fully
local); model and service choices MUST respect the 16 GB RAM / 6 GB VRAM envelope;
repository layout uses `backend/` + `frontend/` (web application structure) with shared
docs in `docs/` and specs in `specs/`.

## Development Workflow & Quality Gates

- **AI-assisted development is explicitly encouraged** (supervisor's instruction). An AI
  coding agent drives the speckit workflow through locally maintained skill definitions.
  Frontend work MUST use the `frontend-design-pro` skill (the
  combined design orchestrator wrapping impeccable + design-taste-frontend, wired into
  `/speckit-plan` and `/speckit-implement` via `.specify/extensions.yml`); new custom
  skills are welcome when they raise quality or repeatability.
- Quality gates for every feature before it is considered done:
  1. `tsc --noEmit` passes (typecheck),
  2. lint passes,
  3. all tests pass (Principle IV),
  4. the scripted demo path still passes,
  5. documentation evidence captured (Principle V),
  6. Constitution Check in the feature's plan passes or violations are justified in
     Complexity Tracking.
- Changes to safety-layer code (policy engine, executor, escalation) MUST show
  test-first evidence in the plan/tasks (tests referenced before implementation tasks).
- Git: feature branches per speckit convention; meaningful commit messages; **the
  developer performs commits himself** — agents suggest messages but do not auto-commit;
  never commit secrets or generated bulk artifacts.
- Validate at system boundaries; keep files under 500 lines; prefer editing existing
  files over creating new ones; no documentation files created outside `docs/` and
  `specs/` unless explicitly requested.

## Governance

- This constitution supersedes ad-hoc practices, personal preferences, and conflicting
  tool defaults for all work in this repository.
- **Amendments** happen only via `/speckit-constitution`: they MUST update the version
  per semantic versioning (MAJOR: principle removed/redefined or incompatible governance
  change; MINOR: principle/section added or materially expanded; PATCH: clarification or
  wording), refresh the Sync Impact Report, and propagate changes to dependent templates
  in `.specify/templates/`.
- Every `/speckit-plan` MUST evaluate its Constitution Check against Principles I–VII;
  violations proceed only with explicit justification in Complexity Tracking.
- Any change that would breach Principle I (scope) is a **project scope change** and
  additionally requires the supervisor's agreement before implementation.
- Compliance is re-reviewed at each RUP phase gate (end of each Construction iteration
  and before Transition) and before final submission.
- Runtime development guidance for agents lives in repository-local agent instruction
  files; where they conflict, this constitution wins.

**Version**: 1.0.2 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-11
