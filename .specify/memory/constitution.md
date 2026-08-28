<!--
Sync Impact Report
==================
Version change: 1.3.0 → 1.4.0 (MINOR, 2026-08-28): a seventh Construction increment is
declared. Feature 007 (Maintainer Admin Console & Staff-Authoritative Account Editing)
was specified on 2026-08-28 while 006 was still in progress, which Principle VII's
remaining-order clause permits only with supervisor agreement. That agreement was given
and recorded on 2026-08-28 (gate condition G1) covering the specification, plan, and
tasks as well as the implementation; this amendment is gate condition G2, and follows G1
rather than preceding it, so the constitution never runs ahead of the decision it records.
Modified principles:
  - VII. RUP-Aligned Iterative Delivery — three changes. (a) `006` is stated in the
    delivery record as **in progress**, not shipped: 30 of its 89 tasks are complete and
    the remainder are UAT sessions with recruited testers, demo-machine screen capture,
    and the 24-hour availability window — none of which a code change can close.
    Recording it as shipped would have been the stale-plan failure this principle already
    names. (b) `007` is declared as increment 7 with its requirement tracing (FR-2 and
    FR-9 enhanced; NFR-5 extended to two new staff-only surfaces). (c) The clause naming
    the refining phase "next and last" is reconciled: refining remains the **final**
    phase, but it is no longer the only remaining one, and the conditions under which an
    increment may be declared alongside it are now stated rather than implied.
Added sections: none. No new principle; the existing delivery record is extended.
Removed sections: none.
Templates:
  - `.specify/templates/plan-template.md` — no change needed. Its Constitution Check
    already routes a Principle I enhancement through Complexity Tracking, which is the
    mechanism that produced gate conditions G1 and G2 for this very feature.
  - `.specify/templates/spec-template.md`, `.specify/templates/tasks-template.md` — no
    change needed; nothing mandatory was added or removed.
Other artifacts:
  - `specs/007-admin-console-account-editing/spec.md` § Risks and
    `docs/testing/observations.md` § Feature 007 gate records carry the dated G1 and G2
    records this amendment is the constitutional half of.
Follow-up TODOs: none. The Compliance Debt Register remains empty.
Previous: 1.2.0 → 1.3.0 (MINOR, 2026-08-21): feature 005 (Constrained Automated
Remediation) shipped, with its closing evidence gathered during the T117 quickstart
validation pass. Both Compliance Debt Register entries are struck — the register is now
empty, satisfying the "MUST be empty before final submission" clause ahead of Transition.
Modified principles:
  - VII. RUP-Aligned Iterative Delivery — `005` moved from "Remaining order" into the
    delivery record as shipped; "Remaining order" now names only the refining/Transition
    phase.
  - VIII. Agent Core & Prompt Engineering — the staging clause is restated in the past
    tense: the plan→act→observe loop, the registered-tool registry, and the ordered LLM
    provider fallback chain are now the delivered, tested form, not a staged aspiration.
    The provider-abstraction bullet's "outstanding" cross-reference to the register is
    removed since CD-1 is closed.
Struck (Compliance Debt Register):
  - CD-1 (ordered LLM provider fallback chain) — closed by `ChainedLlmProvider`
    (`backend/src/services/llm/chained-provider.ts`), `backend/tests/unit/chained-provider.test.ts`,
    and the unchanged, still-passing `backend/tests/integration/degradation.test.ts`.
  - CD-2 (constrained automated remediation, FR-8) — closed by the full policy engine,
    endpoint registry, executor, tool registry, and audit-trail suites (26 unit and
    integration test files, all passing on a clean run against `backend/vitest.config.ts`),
    and the T118 release-gated demo path completing its remediation leg on the demo
    machine. The T117 validation pass that gathered this evidence also found and fixed an
    unrelated test-isolation gap (the real `.env`'s `LLM_PROVIDERS`/`REMEDIATION_ENABLED`/
    `REMEDIATION_SSH_KEY_PATH` leaking into `vitest` runs via `dotenv`'s default
    no-override behaviour) so the suites' pass state is now reproducible rather than
    environment-dependent; see `backend/vitest.config.ts` and
    `backend/tests/unit/config.test.ts`.
Templates:
  - No change needed — the plan-template's Constitution Check and Compliance Debt clause
    already handle an empty register (a plan with nothing to close simply states so).
Other artifacts:
  - Register history retained inline below the (now empty) active table, per this
    project's own "keep the breach visible and dated" principle for debt entries —
    closing a debt is a fact worth keeping on record, not erasing.
Follow-up TODOs: none — the Compliance Debt Register is empty ahead of the refining/
Transition phase, as Governance requires before final submission.
Previous: 1.1.1 → 1.2.0 (MINOR, 2026-08-19): amendment brings the constitution
back in line with the delivered system after features 001–004 shipped, and records two
standing Principle VIII obligations as tracked compliance debt rather than leaving the
repository silently in breach.
Modified principles:
  - I. IR Fidelity — IR §1.4 Objectives (O-1…O-4) added as first-class traceable IDs
    alongside the FR/NFR set; FR-2 clarified (the six categories are a permanent floor,
    not a closed set — categories are maintainer-editable data); FR-9 extended with the
    IR §1.5 dashboard scope wording ("tickets alongside performance metrics").
  - III. Human-in-the-Loop — new locked "Account role model" subsection: exactly two
    account roles (user, staff), staff granted only by the maintainer seed script, and
    the MAINTAINER_KEY surface is explicitly not a third role (resolves spec 004 CHK007
    permanently so later features cannot reintroduce an admin role by drift).
  - IV. Test-Backed Evidence — release-gate demo path restated as the capability that
    actually exists today, with the remediation leg becoming gate-bearing when FR-8
    ships; Objective-4 evaluation (against gathered requirements and perceived
    usefulness) added as an explicit deliverable distinct from the 3-tester UAT.
  - VI. Clean TypeScript Architecture — reference LLM configuration corrected to the
    setup actually in use (LM Studio via openai_compat on the demo machine; Ollama and
    mock also supported); no obligation changed.
  - VII. RUP-Aligned Iterative Delivery — priority order replaced with the delivery
    record as executed (001 foundation → 002 voice → 003 guided troubleshooting, all six
    categories → 004 staff dashboard & accounts) plus the remaining order (005
    constrained remediation → refining/Transition); the "refining phase is specified only
    after all features ship" working agreement is now written down.
  - VIII. Agent Core & Prompt Engineering — agent-core obligations staged: the
    plan→act→observe loop and the registered-tool registry bind from the first
    side-effecting tool (FR-8, feature 005); until then the deterministic pipeline is
    the compliant form. The ordered provider fallback chain is unchanged as an
    obligation but is now named in the Compliance Debt Register with a due feature.
Added sections:
  - "Compliance Debt Register" — the two known unmet MUSTs, with evidence and due dates.
Removed sections: none
Templates:
  - ✅ .specify/templates/plan-template.md — UPDATED: Constitution Check now names
    Principles I–VIII explicitly and gains a "Compliance Debt" clause requiring each plan
    to state whether it closes a register entry, and with what evidence.
  - ✅ .specify/templates/tasks-template.md — UPDATED: the upstream "Tests are OPTIONAL"
    wording (and the three "(OPTIONAL - only if tests requested)" section headers) contradicted
    Principle IV and had silently returned despite the v1.0.0 report claiming it fixed. Now
    states tests are mandatory, safety-critical work is test-first, and prompt-module changes
    refresh the classification/guardrail regression tests (Principle VIII).
  - ✅ .specify/templates/spec-template.md — no change needed (FR/SC structure already
    carries the IR traceability Principle I requires; O-IDs cite the same way)
  - ✅ .specify/templates/checklist-template.md — no change needed
Other artifacts:
  - ⚠ README.md — status prose predates this amendment; refresh when feature 005 is
    specified (no factual conflict with this constitution today)
  - ✅ docs/handoff.md — already records the same delivery state and open evidence tasks
  - ✅ .specify/extensions.yml — unchanged; no constitution hooks registered
Follow-up TODOs: none
Previous: 1.1.0 → 1.1.1 (PATCH, 2026-07-11): Principle VII delivery order amended —
voice input slotted after "service status" and before "constrained remediation".
Previous: 1.0.2 → 1.1.0 (MINOR, 2026-07-11): new Principle VIII (Agent Core & Prompt
Engineering Discipline) added, distilled from two external references supplied by the
developer:
  - asgeirtj/system_prompts_leaks (production system-prompt archive) → layered,
    versioned, regression-tested prompt modules; prompt-injection data/instruction
    separation; prompt safety complements (never replaces) code-level enforcement.
  - Moh4696/build-ai-agents-free (minimal agent-construction curriculum) → explicit
    bounded plan→act→observe loop, schema+description tool registry, persistent
    per-thread conversation memory, ordered provider fallback chain, hosted-provider
    data-retention caution.
Previous: 1.0.1 → 1.0.2 (PATCH, 2026-07-11): agent-tooling references in Development
Workflow and Governance reworded to be tool-agnostic.
Previous: 1.0.0 → 1.0.1 (PATCH, 2026-07-10): frontend design-skill clause strengthened
to MUST use `frontend-design-pro`; `.specify/extensions.yml` created.
Previous: (template) → 1.0.0 (initial ratification, 2026-07-07)
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

**Project objectives (IR §1.4)** — the criteria the project is ultimately marked
against. Every objective MUST be satisfied before final submission; features exist to
serve them, not the reverse:

- **O-1**: Identify high-frequency, low-risk organisational IT support issues suitable
  for automation, via literature review and survey-based requirements gathering with at
  least 30 participants.
- **O-2**: Design and develop a prototype that accepts voice or text input, performs
  speech-to-text where required, classifies incidents, and creates support tickets
  automatically for the selected issue categories.
- **O-3**: Implement guided troubleshooting **and** limited predefined automated actions
  — constrained execution of approved diagnostic or remedial commands (for example via
  SSH or local scripts) — for routine password, network, printer, peripheral, and
  service-status requests, within a controlled test environment.
- **O-4**: Evaluate the prototype against the gathered user requirements and against
  perceived usefulness for reducing repetitive IT support workload, while preserving
  escalation to human IT staff for unsuitable or complex cases.

**Functional requirements (IR §3.4.5):**
- **FR-1**: Accept user input as text or voice; voice MUST be transcribed to text before
  any analysis (all processing operates on text).
- **FR-2**: Support reporting of at least six issue categories: (a) password/login,
  (b) internet/network connectivity, (c) printer, (d) peripheral devices (keyboard,
  mouse, etc.), (e) slow device performance, (f) basic service status checking. These six
  are a permanent **floor**, not a closed set: categories are stored as data and may be
  extended or edited by a maintainer, but the six mandated categories MUST always exist
  and MUST keep their classification behaviour.
- **FR-3**: Classify each reported problem into a category and automatically create a
  ticket carrying timestamps and reporter-supplied information.
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
  updates, and handle urgent or escalated matters. Per IR §1.5, the dashboard's scope is
  "key tickets alongside performance metrics" — a metrics/monitoring surface is part of
  this requirement, not an enhancement beyond it.

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
exists to prevent. Objectives are reproduced alongside the FRs because an unbuilt
objective (notably O-3's automated-action half and O-4's evaluation) is invisible if only
functional requirements are tracked.

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

**Interim state (until FR-8 ships)**: no execution capability exists anywhere in the
codebase, and the conversation engine actively classifies remediation requests and
refuses them. That total refusal is the compliant form of this principle today; the
whitelist, executor, and endpoint registry above become binding obligations the moment
the first command can be executed.

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

**Account role model (locked)**: the system has **exactly two account roles** —

- `user`: granted automatically on registration; the registration endpoint MUST hardcode
  the role and ignore any role supplied by the client.
- `staff`: granted **only** by the maintainer-run seed script. No HTTP endpoint, of any
  kind, may promote an account.

There is no admin role and no third role. The `MAINTAINER_KEY` surface for category and
guide administration is a shared-secret request header on a different axis entirely — not
an account, not a session, unable to read tickets or alter roles, and not mounted at all
when the key is unset. Any future feature that would introduce a third role, or let a
request promote an account, is a **scope change** under Principle I and requires
supervisor agreement. (This resolves spec 004 checklist item CHK007 permanently.)

**Rationale**: The IR positions the agent as workload triage, not staff replacement;
preserving human judgment where risk rises is both the ethical stance and the documented
user expectation. The role model is locked because privilege surfaces grow by accident,
and NFR-5 makes role-restricted access to stored records a graded requirement.

### IV. Test-Backed Evidence (Chapter 5 Discipline)

- Safety-critical components — whitelist policy engine, command executor, escalation
  logic — MUST be developed test-first (TDD): failing tests exist before implementation.
- Every other feature MUST ship automated tests in the same task; no task is complete
  with untested behaviour.
- Test cases MUST be expressible in the APU Chapter 5 TC-table format (TC-No / input /
  expected output / actual output / Passed-Failed). Test naming and reporting are chosen
  so these tables can be generated, not hand-written after the fact.
- **User Acceptance Testing** with a minimum of 3 testers (demographics recorded,
  pseudonyms allowed) MUST be performed before final submission.
- **Objective-4 evaluation** is a separate, additional deliverable from UAT: the
  prototype MUST be evaluated against the gathered user requirements (a traceability
  assessment: each IR FR/NFR against delivered behaviour) **and** against perceived
  usefulness for reducing repetitive IT support workload (a measured participant
  judgement, comparable to the IR's survey instrument). Neither substitutes for the
  other, and O-4 is not satisfied until both exist in `docs/`.
- The scripted end-to-end demo path is a **release gate**: it MUST pass on the demo
  machine before every supervisor meeting, the demo video recording, and the 25-minute
  live presentation demo. The gate covers the capability that exists at that time —
  currently: report issue (voice or text) → classify → ticket → guided fix → escalation →
  staff dashboard view and takeover. When FR-8 ships, whitelisted remediation on a test
  endpoint joins the gated path and MUST NOT be demonstrated outside it.

**Rationale**: APU marks are awarded on documented testing evidence, and the FYP
presentation includes a 25-minute live software demonstration — reliability of the demo
path is worth more than any extra feature. O-4 is called out explicitly because an
evaluation objective is easy to mistake for "we ran the tests".

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
- Evidence tasks that require the live demo machine (availability probes, screenshot
  capture, manual scenario walkthroughs) MAY be deferred by explicit, dated decision, but
  MUST be tracked as open tasks in the owning feature and cleared before submission.

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
- All external input — HTTP requests, LLM output, tool arguments, uploaded audio,
  uploaded spreadsheets — MUST be schema-validated (zod) at the boundary before use.
- Structured logging throughout; audit logging per Principle II is separate from debug
  logging and MUST NOT be disableable in normal operation.
- **LLM access flows through exactly one provider-abstraction module.** Supported
  providers: a local OpenAI-compatible server (`openai_compat`), Ollama (`ollama`), and a
  deterministic `mock` provider for tests and offline development. The reference
  configuration reported in the FYP is fully local: LM Studio serving
  `qwen2.5-7b-instruct` over `openai_compat` on the demo machine. No module besides the
  abstraction may call a model directly — this keeps the safety layer (Principle II)
  un-bypassable and providers swappable by configuration only.
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
- **Delivery record (Construction, as executed):**
  1. `001` Conversational & Ticketing Foundation — FR-1 (text), FR-2, FR-3, FR-5, FR-6,
     FR-7 — shipped.
  2. `002` Voice Input — the FR-1 voice path, speech-to-text feeding the existing
     pipeline unchanged — shipped.
  3. `003` Guided Troubleshooting — FR-4, delivered across all six mandated categories in
     one increment (deterministic versioned guides plus maintainer category/guide
     administration) — shipped.
  4. `004` Staff Dashboard & User Accounts — FR-9, plus accounts, the two-role model,
     self-service profiles, assignment, and NFR-5 role-restricted access — shipped.
  5. `005` Constrained Automated Remediation — FR-8, the half of Objective O-3 that
     activates NFR-4 in substance rather than vacuously (policy engine, endpoint
     registry, executor, tool registry, audit trail, staff approval and kill-switch
     control) — shipped.
- **In progress:**
  6. `006` Refining / Transition — system-wide testing, the Objective-4 evaluation
     (Principle IV), UAT with at least 3 testers, feedback-driven tuning within
     experimental boundaries, and role-specific user guidance drafts. **In progress, not
     shipped**: its convergence and defect work is done, and its remaining tasks are the
     ones no code change can close — UAT sessions with recruited testers, demo-machine
     screen capture, and the completion of the 24-hour availability window. It is stated
     here as in progress rather than moved into the delivery record, because a delivery
     record that overstates is the stale-plan failure this principle exists to prevent.
  7. `007` Maintainer Admin Console & Staff-Authoritative Account Editing — **enhancement
     increment**, not a new objective. Requirement tracing: **FR-2 enhanced** (the
     maintainer category and guide administration delivered in `003` becomes reachable
     through a screen instead of hand-crafted requests carrying two custom headers);
     **FR-9 enhanced** (staff gain authoritative, attributed, per-field editing of a
     user's location, hardware, and remote-access details, plus a directory reaching any
     account rather than only reporters of an open ticket); **NFR-5 extended** (the
     account directory and the profile-field routes are two new surfaces the
     role-restricted access rule must cover, tested by refusal rather than asserted).
     No new objective, no third role, no new safety surface: Principle III's locked
     two-role model is untouched, and the maintainer remains a shared-secret header on a
     different axis with no account and no session.
- The refining phase is the **final** phase and MUST NOT be declared complete until every
  feature has shipped. It is a system-wide phase, not an early increment; specifying it
  sooner produces polish work against a moving target. Per-feature tests remain mandatory
  throughout (Principle IV) and are never deferred into this phase.
- **Declaring an increment alongside the refining phase.** Nothing may be specified ahead
  of the refining phase without supervisor agreement. Where agreement is given, three
  conditions bind, and `007` is the first increment to have been declared under them:
  1. The agreement MUST be dated and recorded in the repository, not only spoken, and it
     MUST state explicitly whether it covers the artifacts already produced or only the
     implementation that follows them. An increment specified before agreement has
     artifacts that need covering, and an agreement silent on them leaves the breach
     unaddressed while appearing to resolve it.
  2. The increment MUST enhance an existing IR requirement rather than introduce a new
     one (Principle I), and MUST NOT consume the refining phase's Objective-4 evaluation
     or UAT time — enhancements are permitted "never at the expense of completing" an IR
     requirement.
  3. This constitution MUST be amended to declare the increment **after** the agreement,
     never before. An undeclared increment leaves the delivery record disagreeing with
     the repository; a declaration made first would put the constitution ahead of a
     decision that had not yet been taken.
  If agreement is refused, the increment's artifacts are withdrawn or parked by dated
  decision rather than left specified and unimplemented.
- Transition-phase activities are scheduled work items, not afterthoughts.
- Supervisor checkpoints: minimum 3 logged meetings this semester on official log
  sheets, each preceded by a passing demo path (Principle IV).

**Rationale**: RUP is the methodology the IR justifies and markers will expect to see
enacted; speckit cycles are its concrete, auditable implementation in this repository.
The delivery record replaces the original forecast order because the forecast diverged
from what was built (guided troubleshooting shipped for all six categories at once, and
the dashboard preceded remediation), and a stale plan is worse evidence than an accurate
history. The same reasoning governs how `006` and `007` are recorded above: an increment
is listed at the status it actually holds, and a seventh increment declared alongside the
refining phase is written into the record with the conditions that permitted it, so a
reader can audit the decision rather than infer it.

### VIII. Agent Core & Prompt Engineering Discipline

The agent's anatomy and its prompts are engineered artifacts held to the same standards
as code.

**Agent core (loop, tools, memory, providers):**

- **Staging clause (resolved).** The loop and tool-registry obligations below bound from
  the moment the first **side-effecting tool** existed — that is, with FR-8 (feature
  005), now shipped. Before then, a deterministic classification-and-guidance pipeline
  that called the model for interpretation only, and exposed no tools, was the compliant
  form: with no tool to select, a tool-selection loop would have been ceremony without a
  safety function. The obligations below are now the delivered, tested form, not a
  future aspiration — see `backend/src/services/agent/`. The memory, provider, and
  prompt obligations bound from the start and were never staged.
- Now that tools exist, the agent core MUST implement an explicit **plan → act → observe**
  loop: the model plans, at most one policy-checked tool call executes per step, and the
  observed result feeds the next step. The loop MUST enforce a hard iteration cap per
  user turn; hitting the cap or detecting no progress triggers escalation (FR-7), never a
  silent retry.
- Every capability exposed to the model MUST be a **registered tool** with a zod schema
  and a natural-language description. Descriptions are load-bearing interface — the
  model selects tools by reading them — so they MUST stay accurate and version-controlled.
  Side-effecting tools map 1:1 onto Principle II whitelist policy entries.
- Conversation memory MUST be **persisted per conversation/thread ID in MongoDB** —
  never RAM-only — so context survives restarts and transfers intact onto the ticket at
  escalation (Principle III handover).
- The provider abstraction (Principle VI) MUST implement an **ordered fallback chain**
  (the speech-to-text path already models this via a provider list, and the LLM path now
  mirrors it via `ChainedLlmProvider`). Total provider failure MUST degrade visibly: the
  user is told the assistant is degraded and the request escalates to staff — it MUST
  NOT error silently. No module may hardcode a single provider. *Both halves — the
  ordered chain and the visible degradation on total failure — are implemented and
  tested (CD-1, closed).*
- When a hosted (non-local) provider is configured, prompts MUST be treated as
  potentially retained by that provider: only ticket-necessary information may be sent
  (NFR-5), and the reference configuration keeps all inference local.

**Prompt engineering (modelled on documented production assistants):**

- System prompts are **versioned repository artifacts** — dedicated prompt modules under
  backend source — never inline string literals scattered through code. Every prompt
  change is code-reviewed and traceable in git history.
- Prompts follow the layered structure of production assistants: (1) identity/persona
  layer (help-desk role; plain, jargon-free tone per NFR-2), (2) safety layer (refusal
  rules, out-of-scope handling, escalation triggers), (3) per-tool usage instructions
  co-located with tool definitions, (4) output-format layer. Mode-specific variants
  (classification, guided troubleshooting, escalation summary) MUST branch from the
  shared core, never fork it.
- Prompt-level safety instructions **complement but never replace** code-level
  enforcement (Principle II): the whitelist and schema validation remain the actual
  guarantee. User messages and any retrieved content MUST be delimited as data inside
  prompts and never concatenated as instructions (prompt-injection defence).
- Prompt changes are **regression-tested**: the classification test set and guardrail
  tests (refusal and escalation behaviours) MUST pass before a prompt change merges.
  A prompt regression is a real regression — Principle IV applies in full.

**Rationale**: A bounded agent loop, described tools, persistent per-thread memory, and
provider fallback are the minimum viable anatomy of a working agent (per the
build-ai-agents-free curriculum, Moh4696/build-ai-agents-free); layered, versioned,
testable prompt modules are how every production assistant documented in the
system-prompt archive (asgeirtj/system_prompts_leaks) manages the same problems at
scale. Adopting both keeps the agent demonstrable on the demo machine, defensible
line-by-line in the viva, and safe under Principle II. The staging clause exists so the
constitution states an obligation the codebase can actually be measured against at each
point in its life, rather than a permanent, unenforced aspiration.

## Technology Stack & Constraints

| Concern | Committed choice | Notes |
|---|---|---|
| Language | TypeScript 5.x (strict) | Node.js/JavaScript ecosystem per IR §2.4.2 |
| Backend | Node.js LTS + Express | REST + SSE + webhooks; serves built frontend for demo |
| Frontend | React + Vite + Tailwind CSS | Chat UI + IT staff dashboard (FR-9) |
| Database | MongoDB Community + Mongoose | Tickets, conversations, accounts, audit records (IR §2.4.5) |
| LLM | Single provider abstraction | `openai_compat` (reference: LM Studio + qwen2.5-7b-instruct), `ollama`, `mock` |
| Speech-to-text | Local-capable engine behind abstraction, provider list | Voice → text before analysis (FR-1) |
| Agent core | Deterministic pipeline today; bounded plan→act→observe loop from FR-8 | Intent → policy check → tool call → observe → audit; iteration-capped; no heavyweight agent framework (Principle VIII) |
| Prompts | Versioned, layered prompt modules in repo | Persona / safety / per-tool / format layers; mode variants share one core; regression-tested (Principle VIII) |
| Testing | Vitest (unit + integration) + supertest | Exports to Chapter 5 TC tables; benchmarks run separately |
| Remediation targets | Registered isolated/virtual test endpoints only | SSH / local script runners; never production (NFR-3) |
| Dev & demo machine | HP Victus 16 — Ryzen 5 8645HS, 16 GB RAM, RTX 4050, Windows 11 | Everything MUST install, run, and demo on this one machine; model sizes chosen to fit |
| Dev environment | VS Code + Git | Per IR §2.4.3 |

Constraints:

- No mandatory cloud dependency on the core path (the reference configuration is fully
  local); model and service choices MUST respect the 16 GB RAM / 6 GB VRAM envelope.
- Repository layout uses `backend/` + `frontend/` (web application structure) with shared
  docs in `docs/` and specs in `specs/`.
- **MongoDB MUST be replica-set capable** on the demo machine. Multi-document
  transactions — used by the Excel import apply step, and by any future operation needing
  atomicity — are unavailable on a standalone `mongod`. The documented single-node `rs0`
  setup is part of the environment contract, not an optional extra.

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
  never commit secrets or generated bulk artifacts. Authorship is the developer's alone:
  no AI co-authorship trailers and no AI attribution in commits, documentation, or any
  other published artifact.
- Validate at system boundaries; keep files under 500 lines; prefer editing existing
  files over creating new ones; no documentation files created outside `docs/` and
  `specs/` unless explicitly requested.

## Compliance Debt Register

Known, accepted gaps between this constitution's obligations and the codebase. Each entry
MUST name its evidence and the feature that closes it. Adding an entry is not a way to
avoid an obligation — it is a way to keep the breach visible and dated. This register is
reviewed at every phase gate (see Governance) and MUST be empty before final submission.

**Active entries**: none.

**Closed entries** (kept on record — a closed debt is a fact worth keeping, not erasing):

| # | Obligation | Evidence of gap (as raised) | Closed by | Closing evidence | Raised | Closed |
|---|---|---|---|---|---|---|
| CD-1 | Principle VIII — the LLM provider abstraction MUST implement an ordered fallback chain | `backend/src/services/llm/factory.ts` selected exactly one provider from `LLM_PROVIDER` and returned it; there was no chain. Visible degradation on total failure *was* implemented and covered by `backend/tests/integration/degradation.test.ts`. The speech-to-text path already modelled the intended shape via `STT_PROVIDERS`. | Feature 005 | `ChainedLlmProvider` (`backend/src/services/llm/chained-provider.ts`), `backend/tests/unit/chained-provider.test.ts` (fall-through on first-provider failure, unchanged single-provider behaviour), and `backend/tests/integration/degradation.test.ts` unchanged and still passing. | 2026-08-19 | 2026-08-21 |
| CD-2 | Principle I / O-3 — constrained automated remediation (FR-8) | No policy engine, endpoint registry, executor, or tool registry existed; `backend/src/services/conversation/conversation-engine.ts` refused remediation requests by design, and specs 001, 003, and 004 each deferred FR-8 explicitly. NFR-4 was therefore satisfied only vacuously. | Feature 005 | The policy engine, endpoint registry, executor, tool registry, and audit trail (`backend/src/policy/`, `backend/src/services/remediation/`, `backend/src/services/agent/`), with 26 unit and integration test files passing on a clean run (`policy-schema`, `policy-loader`, `policy-engine`, `executor`, `audit-service`, `audit-immutability`, `audit-trail-view`, `tools-registry`, `agent-loop`, `availability-service`, `config`, `chained-provider`, `degradation`, `degraded-model-remediation`, and the full `remediation-*` integration suite), plus the T118 release-gated demo path completing its whitelisted-remediation leg on the demo machine (SC-008, Principle IV). | 2026-08-19 | 2026-08-21 |

## Governance

- This constitution supersedes ad-hoc practices, personal preferences, and conflicting
  tool defaults for all work in this repository.
- **Amendments** happen only via `/speckit-constitution`: they MUST update the version
  per semantic versioning (MAJOR: principle removed/redefined or incompatible governance
  change; MINOR: principle/section added or materially expanded; PATCH: clarification or
  wording), refresh the Sync Impact Report, and propagate changes to dependent templates
  in `.specify/templates/`.
- Every `/speckit-plan` MUST evaluate its Constitution Check against Principles I–VIII;
  violations proceed only with explicit justification in Complexity Tracking.
- A feature that closes a Compliance Debt Register entry MUST say so in its plan, and the
  entry is struck only when the closing evidence exists (a test or code reference), never
  on intent alone.
- Any change that would breach Principle I (scope) is a **project scope change** and
  additionally requires the supervisor's agreement before implementation.
- Compliance is re-reviewed at each RUP phase gate (end of each Construction iteration
  and before Transition) and before final submission. The review MUST cover the
  Compliance Debt Register and O-1 through O-4 objective coverage, not only the FR list.
- Runtime development guidance for agents lives in repository-local agent instruction
  files; where they conflict, this constitution wins.

**Version**: 1.4.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-08-28
