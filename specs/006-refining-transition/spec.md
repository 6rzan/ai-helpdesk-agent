# Feature Specification: Refining & Transition Phase

**Feature Directory**: `specs/006-refining-transition`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "admin UI" — redirected during specification. Principle VII
names the refining/Transition phase as the next increment and forbids specifying ahead of
it without supervisor agreement; the developer chose to specify this phase first and
revisit the admin UI afterwards (see Assumptions).

**Traces to**: Objectives O-1, O-2, O-3, **O-4** (primary); IR FR-1…FR-9 and NFR-1…NFR-7
(as the subjects of verification); Constitution Principles IV (Test-Backed Evidence),
V (Documentation as a Deliverable), VII (RUP-Aligned Iterative Delivery, item 6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The System Is Verified End to End and Every Deferred Evidence Item Is Closed (Priority: P1)

The developer runs the complete system on the demo machine and walks a single continuous
journey that crosses everything built so far — report an issue by voice, get it
classified, receive guided troubleshooting, escalate to staff, have staff take it over,
and run a whitelisted remediation against a test endpoint. Alongside this, every piece of
evidence that earlier features deferred because it needed a live machine is finally
captured: the 24-hour availability probe, the outstanding chat and remediation
screenshots, and the manual quickstart walkthrough.

**Why this priority**: Nothing else in this phase is trustworthy until the system is
confirmed working as one product rather than five separately-tested features. Testers
cannot be put in front of a build that has not passed its own gate, and the evaluation in
US3 would be measuring an unverified system. This story alone makes the project
submittable with Chapter 4 and Chapter 5 evidence intact.

**Independent Test**: Fully testable by running the release-gated demo path on the demo
machine and confirming it completes on the first attempt, then confirming no deferred
evidence item remains open in any feature's task list.

**Acceptance Scenarios**:

1. **Given** the demo machine with the documented replica-set database and a local model
   running, **When** the full cross-feature journey is walked in one continuous run,
   **Then** every stage completes without restarting the system or hand-editing data, and
   the run is recorded with its date and outcome.
2. **Given** the deferred evidence items carried by features 001, 003, and 005, **When**
   the phase's verification work completes, **Then** each item has produced its artifact
   in `docs/` and is marked closed in its owning feature.
3. **Given** the release-gated demo path, **When** it is run before any tester session,
   **Then** it passes on the first attempt; if it does not, tester sessions do not begin
   until it does.
4. **Given** a stage of the journey that fails during verification, **When** the failure
   is diagnosed, **Then** it is recorded as a defect with its severity before any fix is
   attempted, so the failure remains visible in the record rather than being silently
   repaired.

---

### User Story 2 - Real Testers Use the System and Their Experience Is Recorded (Priority: P2)

At least three people who did not build the system are each given a set of realistic
help-desk scenarios to attempt unaided. Their background is recorded under a pseudonym,
what they were asked to do is written down before they start, and what actually happened —
including where they hesitated, misread guidance, or gave up — is captured as they work.
At least one tester works through the IT staff side rather than the employee side.

**Why this priority**: User Acceptance Testing with a minimum of three testers is a
mandatory pre-submission deliverable, and it needs calendar time to recruit people —
making it the longest-lead item in the phase. It also produces the raw material that US3's
perceived-usefulness measurement and US4's refinements both depend on.

**Independent Test**: Fully testable by confirming that three or more completed session
records exist, each naming its tester pseudonym, demographics, scenarios attempted, and
per-scenario outcome.

**Acceptance Scenarios**:

1. **Given** a recruited tester and a written scenario script, **When** the tester attempts
   each scenario without facilitator help, **Then** each scenario is recorded as completed
   unaided, completed with prompting, or not completed, along with the tester's own
   comments.
2. **Given** the six mandated issue categories, **When** the UAT sessions are complete as a
   set, **Then** every category has been reported by at least one tester, and at least one
   guided resolution and at least one escalation have been exercised.
3. **Given** a tester who encounters a defect mid-session, **When** the defect blocks the
   scenario, **Then** the scenario is recorded as not completed, the defect is logged with
   its severity, and the session continues with the remaining scenarios rather than being
   abandoned.
4. **Given** a tester who asks for behaviour the system was never scoped to provide,
   **When** the request is recorded, **Then** it is captured as an out-of-scope observation
   with a note of which requirement boundary it falls outside, and is not treated as a
   defect.
5. **Given** every tester record, **When** the records are stored, **Then** they contain no
   information identifying a real person beyond the coarse demographic bands agreed for
   the study.

---

### User Story 3 - The Prototype Is Evaluated Against Its Requirements and Its Perceived Usefulness (Priority: P3)

Two distinct evaluations are produced. The first walks every requirement the project
committed to and states plainly whether the delivered system satisfies it, partly
satisfies it, or does not — each verdict pointing at the evidence that supports it. The
second asks participants to judge how useful the prototype would be for reducing
repetitive IT support workload, using a question set structured like the original survey
so the answers can be compared against the requirements-gathering data.

**Why this priority**: This is Objective O-4, a graded project objective with nothing
delivered against it today, and it cannot be honestly produced until the system has been
verified (US1) and used by real people (US2). It is the single largest gap between the
current repository and a complete submission.

**Independent Test**: Fully testable by confirming two separate documents exist — one
requirement-by-requirement assessment covering every committed requirement with no blank
verdicts, and one participant-judgement report with aggregate figures.

**Acceptance Scenarios**:

1. **Given** the full set of committed functional and non-functional requirements, **When**
   the traceability assessment is complete, **Then** every requirement carries exactly one
   verdict and at least one named piece of supporting evidence, with no requirement left
   unaddressed.
2. **Given** a requirement the delivered system does not fully satisfy, **When** it is
   assessed, **Then** the shortfall is stated openly with its reason, rather than being
   recorded as satisfied or quietly omitted.
3. **Given** the participants who took part, **When** the perceived-usefulness measurement
   is reported, **Then** it presents both an aggregate result and the spread of responses,
   and states how many participants contributed.
4. **Given** both evaluations, **When** they are filed, **Then** each stands as its own
   deliverable and neither is presented as fulfilling the other's purpose.

---

### User Story 4 - Feedback Is Acted On Within the Project's Boundaries (Priority: P4)

The defects and friction points gathered from verification and tester sessions are sorted
by how badly they hurt, and the ones worth fixing are fixed. Wording is clarified where
testers misread it, ordering is adjusted where testers got lost, and genuine faults are
repaired. Requests that would grow the system beyond what it committed to build, weaken a
safety control, or add a new kind of account are recorded and declined rather than
implemented.

**Why this priority**: Refinement is only meaningful once there is real feedback to refine
against, so it necessarily follows US1 and US2. It is also the phase's main drift risk —
tester enthusiasm is the most likely source of unplanned scope growth this late in the
project — which is why its boundaries are written as requirements rather than left to
judgement.

**Independent Test**: Fully testable by confirming every logged defect and observation has
a recorded disposition, that every declined item states its reason, and that the automated
test suites and the demo path still pass after the final change.

**Acceptance Scenarios**:

1. **Given** the full list of defects and observations, **When** triage completes, **Then**
   each carries a severity and a decision to fix, defer, or decline, and no item is left
   without a disposition.
2. **Given** a defect that blocks a tester from completing a core journey, **When** it is
   triaged, **Then** it is either fixed before submission or explicitly accepted with a
   written justification — never left silently open.
3. **Given** a proposed change that would add a new capability, relax a safety control, or
   introduce a third kind of account, **When** it is assessed, **Then** it is declined and
   recorded as an out-of-scope observation with the boundary it crosses named.
4. **Given** any change made during refinement, **When** it is complete, **Then** the
   automated suites pass and the release-gated demo path still completes on the demo
   machine.
5. **Given** the end of the refinement work, **When** the phase closes, **Then** the
   verified journey from US1 is re-run and passes with the refinements in place.

---

### User Story 5 - Each Kind of User Has Written Guidance (Priority: P5)

Short written guidance is produced for each way a person interacts with the system: the
employee reporting a problem, the IT staff member working the queue and approving
remediation, and the maintainer editing categories and guides. Each explains what that
person can do and how to do it, in the plain language the project committed to.

**Why this priority**: Guidance is a named deliverable of this phase and supports the
submission, but it documents behaviour that already exists and can be written last without
blocking anything else. It is also the piece most likely to need rewriting if US4 changes
wording or ordering, so writing it earlier would waste effort.

**Independent Test**: Fully testable by giving the guidance to a person unfamiliar with the
system and confirming they can complete that role's primary task using only the written
material.

**Acceptance Scenarios**:

1. **Given** the two account roles and the maintainer surface, **When** the guidance set is
   complete, **Then** each has its own document covering the actions available to it.
2. **Given** a person who has not used the system, **When** they follow the employee
   guidance only, **Then** they can report an issue and reach either a resolution or an
   escalation without further help.
3. **Given** the guidance documents, **When** they are reviewed against the running system,
   **Then** no instruction describes a screen, action, or option that does not exist.

---

### Edge Cases

- **Fewer than three testers can be recruited in time.** The phase cannot close: three is
  a floor, not a target. The shortfall must be escalated to the supervisor rather than
  absorbed by counting the developer as a tester.
- **A tester session reveals a committed requirement was never actually built.** It is
  recorded as not satisfied in the traceability assessment and raised immediately, because
  a missing requirement is a scope failure rather than a defect to triage.
- **The local model is unavailable during a tester session.** The session proceeds and the
  degraded behaviour is observed as designed — the user is told the assistant is degraded
  and the request escalates. This is treated as a scenario worth recording, not a session
  to abandon.
- **The demo machine's database is not running in its replica-set configuration.** Any
  operation requiring atomicity fails by design; the session is halted and restarted once
  the documented configuration is in place, rather than recording a false defect.
- **A tester attempts remediation against something outside the registered test
  endpoints.** The refusal is the correct outcome and is recorded as a passed safety
  scenario, not a defect.
- **Refinement of one tester's confusion makes another tester's path worse.** Changes are
  re-validated against the full scenario set, not only against the report that prompted
  them.
- **Two evidence artifacts disagree about what the system does.** The repository is the
  authority; the stale document is corrected before the phase closes.
- **A tester's comments contain personal or workplace-identifying detail.** It is removed
  or generalised before the record is filed.

## Requirements *(mandatory)*

### Functional Requirements

**System-wide verification (US1)**

- **FR-001**: The phase MUST exercise the complete cross-feature journey — voice or text
  intake, classification, ticket creation, guided troubleshooting, escalation, staff
  takeover, and whitelisted remediation against a registered test endpoint — in one
  continuous run, not only as separate per-feature suites. (O-2, O-3, IR FR-1…FR-9)
- **FR-002**: The release-gated demo path MUST pass on the demo machine before the first
  tester session begins and again after the final refinement is applied. (Principle IV)
- **FR-003**: Every evidence item deferred by an earlier feature MUST be captured and
  closed within this phase, and each MUST leave its artifact in `docs/`. This covers the
  24-hour availability probe (001 T049), the guided-flow chat screenshots (003 T046), the
  manual quickstart walkthrough (003 T047), and the remediation implementation screenshots
  (005 T119). (Principle V)
- **FR-004**: Any failure observed during verification MUST be recorded as a defect with a
  severity before a fix is attempted, so that the failure remains part of the record.

**User Acceptance Testing (US2)**

- **FR-005**: UAT MUST be conducted with at least three testers who did not build the
  system, with each tester's demographics recorded; pseudonyms are permitted and no
  identifying detail beyond agreed demographic bands may be stored. (Principle IV, NFR-5)
- **FR-006**: The scenario script MUST be written before the first session and MUST, across
  the session set, cover all six mandated issue categories, at least one guided resolution,
  and at least one escalation. (IR FR-2, FR-4, FR-7)
- **FR-007**: Each scenario attempt MUST be recorded with what the tester was asked to do,
  whether they completed it unaided, completed it with prompting, or did not complete it,
  and any comment the tester offered.
- **FR-008**: At least one tester MUST exercise the IT staff workspace rather than the
  employee-facing experience. (IR FR-9)
- **FR-009**: Records MUST be expressible in the project's established test-case table
  format so they feed the testing chapter without being rewritten. (Principle IV)

**Objective-4 evaluation (US3)**

- **FR-010**: A requirements traceability assessment MUST record, for every committed
  functional and non-functional requirement, exactly one verdict — satisfied, partially
  satisfied, or not satisfied — together with at least one named piece of supporting
  evidence. No requirement may be left without a verdict. (O-4)
- **FR-011**: A shortfall against any requirement MUST be stated openly with its reason
  rather than recorded as satisfied or omitted. (O-4)
- **FR-012**: Perceived usefulness for reducing repetitive IT support workload MUST be
  measured from participants using an instrument structured comparably to the original
  requirements-gathering survey, and reported with an aggregate result, the spread of
  responses, and the number of participants. (O-4)
- **FR-013**: The traceability assessment and the perceived-usefulness evaluation MUST
  exist as two distinct deliverables; neither may be presented as satisfying the other.
  (Principle IV)

**Feedback-driven refinement (US4)**

- **FR-014**: Every defect and observation gathered in this phase MUST carry a severity and
  a recorded disposition of fix, defer, or decline; declined and deferred items MUST state
  why.
- **FR-015**: Any defect that blocked a tester from completing a core journey MUST be
  either resolved before submission or explicitly accepted with written justification.
- **FR-016**: Refinements MUST NOT introduce a new functional requirement, relax any safety
  control, alter the locked two-role account model, or extend automated action beyond
  registered test endpoints. Anything that would MUST be declined and recorded as an
  out-of-scope observation naming the boundary it crosses. (Principles I, II, III, NFR-3)
- **FR-017**: After any refinement, the automated test suites and the release-gated demo
  path MUST pass before the phase advances. (Principle IV)

**Guidance and project record (US5 and phase closure)**

- **FR-018**: Written guidance MUST exist for the employee role, the IT staff role, and the
  maintainer surface, each covering the actions available to it in plain, jargon-free
  language. (NFR-2)
- **FR-019**: Guidance MUST NOT describe any screen, action, or option that does not exist
  in the running system.
- **FR-020**: At phase end, no document in the repository may describe a delivery state
  that the repository contradicts; status records known to be stale MUST be brought current.
  (Principle V)
- **FR-021**: At phase end, the Compliance Debt Register MUST be re-verified as empty, and
  objective coverage O-1 through O-4 MUST be reviewed rather than only the requirement
  list. (Governance)

### Key Entities

- **Tester Profile**: A participant in acceptance testing. Attributes: pseudonym, coarse
  demographic band (role type, familiarity with IT support), which role's experience they
  exercised. Holds no personally identifying detail.
- **Scenario Script**: A realistic task a tester is asked to attempt, written before
  sessions begin. Attributes: identifier, the situation given to the tester, the issue
  category it targets, the outcome it is expected to reach.
- **Session Record**: What happened when one tester attempted one scenario. Attributes:
  tester pseudonym, scenario identifier, date, completion outcome (unaided / prompted /
  not completed), observed behaviour, tester comment. Relates one Tester Profile to one
  Scenario Script.
- **Observation**: Anything noticed during verification or a session that may warrant
  action. Attributes: description, source, severity, classification as defect or
  out-of-scope request, disposition (fix / defer / decline), reason for the disposition,
  and — where declined for scope — the boundary it crosses.
- **Requirement Verdict**: One committed requirement's assessed state. Attributes:
  requirement identifier, verdict, supporting evidence reference, and stated reason where
  the verdict is not "satisfied".
- **Usefulness Response**: One participant's judgement of the prototype's usefulness for
  reducing repetitive support workload. Attributes: participant pseudonym, per-question
  rating, optional free comment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every committed functional and non-functional requirement carries a verdict
  backed by named evidence — complete coverage with zero blanks.
- **SC-002**: At least three testers complete the scenario script, with demographics
  recorded for every one of them.
- **SC-003**: At least 80% of scripted scenario attempts are completed by testers without
  facilitator intervention.
- **SC-004**: Every one of the six mandated issue categories is exercised by at least one
  tester, and both a guided resolution and an escalation occur at least once across the
  session set.
- **SC-005**: The perceived-usefulness measurement is reported with an aggregate result,
  the spread of responses, and the participant count.
- **SC-006**: Every defect that blocked a tester from completing a core journey is resolved
  or carries a written accepted-risk justification — none left silently open.
- **SC-007**: Every logged observation has a recorded disposition; none is left untriaged.
- **SC-008**: The release-gated demo path completes on the first attempt on the demo
  machine, both before tester sessions and after the final refinement.
- **SC-009**: Zero evidence items remain deferred across all features at phase end.
- **SC-010**: A person unfamiliar with the system completes their role's primary task using
  only the written guidance, verified with at least one participant per role covered.
- **SC-011**: The Compliance Debt Register is empty at phase end, and each of the four
  project objectives has a recorded coverage statement.
- **SC-012**: No repository document contradicts the delivered state of the system at phase
  end.

## Assumptions

- **This is the final increment before submission.** No new product capability is specified
  within this phase; its output is verification, evidence, evaluation, bounded refinement,
  and guidance.
- **The admin UI is deferred beyond this phase.** On 2026-08-27 the developer chose to
  specify this phase ahead of an admin UI, keeping Principle VII's ordering intact. The
  scope preferred for that future feature is a full maintainer console **including
  remediation policy editing**. That preference is recorded here so it is not lost, with a
  standing flag: browser-based editing of the remediation whitelist or endpoint registry
  conflicts with the requirement that policy changes be human-made **and code-reviewed**,
  and that conflict must be resolved — by narrowing the scope or by amending the governing
  principle with supervisor agreement — before that feature is specified.
- **Testers are recruited from the developer's own contacts** and take part under
  pseudonyms. Three to five testers is the working target, with three as the hard floor and
  at least one exercising the IT staff workspace.
- **The perceived-usefulness instrument is a short rating-scale questionnaire** mirroring
  the structure of the original requirements-gathering survey, so the two are comparable.
  It is administered to the acceptance testers and may be extended to additional
  respondents if available.
- **All sessions run on the project's designated demo machine** with the documented
  replica-set database configuration and a locally served model, since results must
  reflect the environment the project commits to running on.
- **"Within experimental boundaries" means the controlled test environment**: no live or
  production system is touched, and automated action remains limited to registered test
  endpoints throughout.
- **Severity banding for triage** distinguishes blocking (a core journey cannot be
  completed), significant (completed but with confusion or a wrong-looking result), and
  minor (cosmetic or wording). Blocking items gate submission; minor items may be declined
  with a reason.
- **Evidence is written to `docs/`** alongside the material already there, extending the
  existing testing and implementation records rather than starting a parallel set.
- **The existing project status record is known to be stale** — it predates the most recent
  shipped feature — and bringing it current is part of this phase's closure work rather
  than a separate task.
