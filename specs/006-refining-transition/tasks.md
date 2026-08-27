# Tasks: Refining & Transition Phase

**Input**: Design documents from `/specs/006-refining-transition/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are MANDATORY for every feature (Constitution Principle IV). This phase
adds one new script (`backend/scripts/demo-path.ts`), which ships with its own unit test in
Phase 2. Refinement edits (Phase 6) are gated by the full existing suites, and any edit that
lands in `backend/src/services/llm/prompts/` additionally re-runs the classification and
guardrail regression sets before it merges (Principle VIII).

**Organization**: Tasks are grouped by user story so each story can be completed and
verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1…US5)
- Exact file paths are given in every task

## Path Conventions

Web application (`backend/` + `frontend/`). This phase adds **no source directory**. Its
deliverables land in the existing `docs/testing/`, `docs/implementation/screenshots/`, and a
new `docs/guidance/` tree, plus one new script under `backend/scripts/`.

## Phase-wide constraints (FR-016 — read before any task in Phase 6)

Refinement MUST NOT add a functional requirement, relax a safety control, alter the locked
two-role account model, or extend automated action beyond registered test endpoints. Nothing
under `backend/src/policy/` is touched this phase. No restyle: no palette, type-scale,
spacing-system, or component-shape change (plan.md § Design Direction).

---

## Phase 1: Setup (Demo-Machine Environment Contract)

**Purpose**: Prove the demo machine matches the environment the phase's evidence claims.
All evidence originates here (NFR-7). A session run outside this contract is discarded, not
scored (contracts/session-record.md C8).

- [X] T001 Verify MongoDB is running as the documented single-node replica set on the demo machine: `mongosh --eval "rs.status().ok"` returns `1`; record the result in `docs/testing/demo-environment-check.md`
- [X] T002 [P] Verify LM Studio is serving `qwen2.5-7b-instruct` over `openai_compat`: `curl http://127.0.0.1:1234/v1/models`; record model id and provider config in `docs/testing/demo-environment-check.md`
- [X] T003 [P] Verify every endpoint listed in `backend/src/policy/test-endpoints.json` is reachable from the demo machine and record reachability per endpoint in `docs/testing/demo-environment-check.md`
- [X] T004 Install dependencies on the demo machine: `npm --prefix backend ci && npm --prefix frontend ci`
- [X] T005 [P] Run backend baseline gates and record pass counts in `docs/testing/demo-environment-check.md`: `npm --prefix backend run typecheck && npm --prefix backend run lint && npm --prefix backend test`
- [X] T006 [P] Run frontend baseline gates and record pass counts in `docs/testing/demo-environment-check.md`: `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test`

**Checkpoint**: Environment contract verified and a pre-refinement baseline recorded, so a
Phase 6 regression is detectable against a number rather than a memory.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the three things every user story depends on — the repeatable demo path,
the single triage register, and the survey structure the usefulness instrument must match.
Plus the one wall-clock item that cannot be compressed.

**⚠️ CRITICAL**: No tester session may be scheduled until T007–T009 exist and T014 has
passed (FR-002). No usefulness questionnaire may be administered until T012 is complete
(research.md Decision 3, V6.2).

- [X] T007 Create `backend/scripts/demo-path.ts` as a single re-runnable script covering all seven legs in one continuous run — voice-or-text intake → classification → ticket creation → guided troubleshooting → escalation → staff takeover → whitelisted remediation against a **registered** test endpoint — with no restart and no hand-edited data between stages; it writes a timestamped PASS/FAIL log per leg into `docs/testing/demo-path-runs/` (research.md Decision 1)
- [X] T008 Register the script as `"demo-path": "tsx scripts/demo-path.ts"` in the `scripts` block of `backend/package.json`, alongside the existing `availability-probe` entry
- [X] T009 Add `backend/tests/unit/demo-path.test.ts` asserting the script declares all seven legs, fails the run when any leg is skipped, and writes a well-formed log file (Principle IV — the script ships with its test)
- [X] T010 [P] Create the single triage register `docs/testing/observations.md` with the mandatory columns from data-model.md §4 (`id`, `description`, `source`, `sourceRef`, `severity`, `classification`, `disposition`, `reason`, `boundaryCrossed`), the severity banding table, and the five named boundaries; seed it with `OBS-01`…`OBS-05` from data-model.md, each awaiting disposition
- [X] T011 [P] Extract the original requirements-gathering survey's scale type, number of points, anchors, relevant question stems, and respondent count from the IR PDF (`TAHA_FAHD_AHMED_MOHAMMED_THABIT_MR_TP078281_APU3F2601CS_CS.pdf`, repository root) into the "Original survey structure" table of `specs/006-refining-transition/contracts/usefulness-instrument.md`
- [X] T012 Reconcile the provisional Q1–Q6 and staff S1–S2 question set against the extracted structure in `specs/006-refining-transition/contracts/usefulness-instrument.md`, adjusting scale points and anchors to match the original; record any deliberate divergence with its reason (FR-012, V6.2)
- [X] T013 [P] Start the unattended 24-hour availability probe on the demo machine — `npm --prefix backend run availability-probe` with `PROBE_EMAIL`/`PROBE_PASSWORD` set per the 2026-08-25 repair — writing to `docs/testing/availability-probe-24h.log`. **Start this on day one**: it is a wall-clock dependency with no way to compress it (research.md Decision 7)
  - Started 2026-08-26T19:47:58Z (25 hourly attempts; T017 finalises the log after it completes). A stale probe account left over from an earlier repair-verification run (created 2026-08-24, incompatible with a fresh `PROBE_PASSWORD`) blocked attempt 1 with a 409 on first try — deleted the stale account, reset the log, restarted; attempt 1/25 now Passed.
  - **Restarted 2026-08-27T06:54:06Z.** The demo machine rebooted at 2026-08-27T06:39Z, killing the probe after attempt 11/25 (11/11 Passed, covering only a 10-hour span 2026-08-26T19:47Z → 2026-08-27T05:47Z). SC-006 requires the window to be 24 hours, so a partial window cannot close it. The interrupted run is preserved at `docs/testing/availability-probe-24h.interrupted-2026-08-27.log`; the fresh 25-attempt window began at 2026-08-27T06:54:06Z and completes ~2026-08-28T06:54Z. The machine must stay up for that window or the run restarts again.
  - **Restarted again 2026-08-27T07:48:39Z.** The demo machine rebooted a second time sometime after attempt 1/25 of the previous restart (Docker Desktop, MongoDB, LM Studio, and the backend dev server were all found stopped; no process survived). A single-Passed-attempt run cannot evidence anything, so the interrupted log is preserved at `docs/testing/availability-probe-24h.interrupted-2026-08-27b.log` and a fresh 25-attempt window began at 2026-08-27T07:48:39Z, completing ~2026-08-28T07:48Z. **Two reboots in one day have now each destroyed an in-progress window** — this is an environment-stability risk outside this script's control; if it recurs, T017 stays open until a 24-hour span survives one uninterrupted.

**Checkpoint**: The demo path is a single artifact, every observation has one place to live,
the instrument is comparable to the original, and the 24-hour clock is running.

---

## Phase 3: User Story 1 - The System Is Verified End to End and Every Deferred Evidence Item Is Closed (Priority: P1) 🎯 MVP

**Goal**: Confirm the system works as one product rather than five separately-tested
features, and close every piece of evidence an earlier feature deferred.

**Independent Test**: Run the release-gated demo path on the demo machine and confirm it
completes on the first attempt, then confirm no deferred evidence item remains open in any
feature's task list.

**⚠️ Sequencing**: T021 and T022 (screenshot capture) are the one part of this story that
must wait — capture them **after** Phase 6 refinement settles, or they will show
pre-refinement wording and contradict the shipped system under FR-019/FR-020 (research.md
Decision 7). Everything else in this phase runs now, and the demo path passing is what
unblocks Phase 4.

### Verification run

- [X] T014 [US1] Run the release-gated demo path — run **1 of 2** required by FR-002 — via `npm --prefix backend run demo-path` on the demo machine; it MUST complete on the **first attempt**. Commit the generated log under `docs/testing/demo-path-runs/`. If it does not pass, tester sessions do not begin (spec AS1-3, SC-008). Run 1 of 2: `docs/testing/demo-path-runs/2026-08-27T04-58-25-974Z.md` — PASS, all 7 legs, first clean attempt after fixing five real bugs surfaced while getting the script itself working (see T015). Run 2 of 2 is required later, after Phase 6 refinement.
- [X] T015 [US1] For any failure observed during T014, add a row to `docs/testing/observations.md` with `source = verification`, its `sourceRef` (the dated run), and a severity **before** any fix is attempted, so the failure stays in the record (FR-004, V4.4). Logged as OBS-06..OBS-10 (all `disposition: fix`, severity recorded pre-fix): Windows `isMainModule` guard bug, a reporter-scoped ticket-list race across re-runs, fixed dialogue text tripping the category-keyword duplicate-detection bail-out, the same duplicate-check left unanswered by the script, and a print-queue-status.sh verification-logic bug in the test-node-b fixture (plus a Windows `ssh-keyscan` PATH/KEX tooling issue in `reset.ps1`'s host-key capture step).
- [X] T016 [US1] Walk the full cross-feature journey by hand on the demo machine in one continuous run and record the date, each stage's outcome, and the run's overall verdict in `docs/testing/demo-path-runs/` (FR-001, spec AS1-1). Walked by hand through the browser UI on 2026-08-27T07:11:06Z–07:19:25Z against the real stack (`rs0`, LM Studio `qwen2.5-7b-instruct`, the registered Test Node B endpoint), producing ticket HD-0053: `docs/testing/demo-path-runs/2026-08-27T07-11-06Z-manual.md` — **PASS, all 7 legs**. The consent → staff-approval → explicit-confirmation chain held at every gate; the agent never executed a state-changing action on its own. Two employee-facing UI defects surfaced at the consent step and are filed as OBS-11 (internal action description leaking into chat copy, minor) and OBS-12 (duplicated "Waiting on IT staff to approve" message, significant), both with severity recorded before any fix per T015's rule (FR-004, V4.4). Neither blocked a stage, so neither gates this run.

### Deferred-evidence closure — 001 T049 and 003 T047

- [ ] T017 [US1] On completion of the 24-hour window started in T013, finalise `docs/testing/availability-probe-24h.log` with the attempt/success counts and the window's start and end timestamps (FR-003, closes 001 T049)
- [ ] T018 [US1] Mark T049 `[X]` in `specs/001-conversational-ticketing-foundation/tasks.md`, citing `docs/testing/availability-probe-24h.log` as its artifact
- [X] T019 [US1] Run all five `specs/003-guided-troubleshooting/quickstart.md` scenarios manually on the demo machine and record each walkthrough's outcome in `docs/testing/quickstart-walkthroughs-003.md` (FR-003, closes 003 T047) — all five PASS; found and fixed two real defects along the way (OBS-13: FR-005's `stepAttempts` silently dropped the resolving "worked" step; OBS-14: `conversation-engine.ts` had no per-conversation reply serialization, letting concurrent reports race and quote ticket references that never persisted). See `docs/testing/quickstart-walkthroughs-003.md` for full evidence.
- [X] T020 [US1] Mark T047 `[X]` in `specs/003-guided-troubleshooting/tasks.md`, citing `docs/testing/quickstart-walkthroughs-003.md` as its artifact

### Deferred-evidence closure — 003 T046 and 005 T119 (⚠ run AFTER Phase 6)

- [ ] T021 [US1] Capture guided-flow chat screenshots into `docs/implementation/screenshots/` — one flow to resolution and one flow to escalation — then mark T046 `[X]` in `specs/003-guided-troubleshooting/tasks.md` (FR-003)
- [ ] T022 [US1] Capture the eight named remediation screens into `docs/implementation/screenshots/` — consent block, action result in chat, approval queue, approval confirmation, audit view with filters, per-ticket action history, kill switch with the disabled banner, and the metrics surface including its no-data state — then mark T119 `[X]` in `specs/005-constrained-remediation/tasks.md` (FR-003)
- [ ] T023 [US1] Verify zero unchecked task boxes remain across all five earlier features: `grep -rn "^- \[ \] T" specs/00{1,2,3,4,5}-*/tasks.md` returns no output; record the check in `docs/testing/demo-environment-check.md` (SC-009, quickstart S2)

**Checkpoint**: The system is verified as one product on the demo machine, the demo path has
passed once, and — once T021/T022 land after Phase 6 — zero evidence items remain deferred.

---

## Phase 4: User Story 2 - Real Testers Use the System and Their Experience Is Recorded (Priority: P2)

**Goal**: At least three people who did not build the system attempt realistic help-desk
scenarios unaided, with what actually happened captured as they work.

**Independent Test**: Confirm three or more completed session records exist, each naming its
tester pseudonym, demographics, scenarios attempted, and per-scenario outcome.

**⚠️ Blocked by**: T014 (the demo path must have passed) and T012 (the instrument must be
reconciled before it is administered).

### Scenario script — written and committed before any session (FR-006, V2.4)

- [ ] T024 [US2] Write `docs/testing/uat-scenarios.md` with at least eight scenarios (`SC-01`…`SC-08`+) per data-model.md §2 — one per mandated category (`password_login`, `network`, `printer`, `peripheral`, `slow_performance`, `service_status`), one forcing a guided resolution to completion, one forcing an escalation — each carrying `id`, `situation` (in the tester's own terms, coaching no answer), `targetCategory`, `expectedOutcome`, and `role`
- [ ] T025 [US2] Add staff-side scenarios to `docs/testing/uat-scenarios.md` covering ticket takeover, approving a remediation, and a `safe-refusal` attempt against an unregistered target (V2.3, V2.5)
- [ ] T026 [US2] Add the category × exercised-by-tester coverage matrix to the top of `docs/testing/uat-scenarios.md` (research.md Decision 6, SC-004)
- [ ] T027 [US2] Commit `docs/testing/uat-scenarios.md` **before** the first session so git history shows the script pre-dates every session date (FR-006, V2.4)

### Sessions

- [ ] T028 [US2] Recruit 3–5 testers and file the roster table at the top of `docs/testing/uat-sessions.md` per contracts/session-record.md — pseudonym (`T1`, `T2`, …), `roleType`, `supportFamiliarity`, `experienceExercised`, `consentRecorded` — with at least one row set to `staff` (FR-005, FR-008, V1.2, V1.3). The developer is never a row
- [ ] T029 [US2] Read the consent line from `specs/006-refining-transition/contracts/usefulness-instrument.md` to each tester before their session and set `consentRecorded = yes` in the `docs/testing/uat-sessions.md` roster (V1.4)
- [ ] T030 [US2] Run the employee-role sessions on the demo machine, one scenario at a time, without facilitator help unless the tester stalls (FR-007)
- [ ] T031 [US2] Run the staff-workspace session with the tester whose `experienceExercised = staff`, covering takeover, approval, and the safe-refusal scenario (FR-008)
- [ ] T032 [US2] Record every attempt as a `UAT-` row in `docs/testing/uat-sessions.md` using the five-column TC-table layout plus the Comment column, with exactly one outcome value — `Passed (unaided)` / `Passed (prompted)` / `Failed (not completed)` (FR-007, FR-009, C1)
- [ ] T033 [US2] Update the coverage matrix in `docs/testing/uat-scenarios.md` **during** the session set, so a category gap can still be assigned to the next tester while testers remain available (SC-004)
- [ ] T034 [US2] Administer the reconciled questionnaire from `specs/006-refining-transition/contracts/usefulness-instrument.md` to each tester immediately after their session and record raw per-question ratings, keyed to pseudonym, in `docs/testing/usefulness-evaluation.md` (FR-012, U5)

### Record hygiene and set-level checks

- [ ] T035 [US2] Review and generalise every tester comment in `docs/testing/uat-sessions.md` and every free-text answer in `docs/testing/usefulness-evaluation.md` for personal or workplace-identifying detail **before** the files are committed — git history retains raw text (V3.3, C3, NFR-5)
- [ ] T036 [US2] Log every session-derived defect, friction point, and out-of-scope request as a row in `docs/testing/observations.md` with `source = uat-session` and its `sourceRef` UAT id; a request for never-scoped behaviour is classified `out-of-scope`, not a `Failed` row (C6, V3.5)
- [ ] T037 [US2] Note beside any response in `docs/testing/usefulness-evaluation.md` whose session hit a degraded local model, since it plausibly depresses Q1/Q2 for reasons unrelated to design (U6, spec Edge Case 3)
- [ ] T038 [US2] Compute `Passed (unaided)` ÷ all rows over `docs/testing/uat-sessions.md` and record the figure in that file; it must be ≥ 0.80 and is **reported as a figure, not asserted** (SC-003, C5, V3.4)
- [ ] T039 [US2] Verify the coverage matrix in `docs/testing/uat-scenarios.md` shows all six mandated categories exercised plus at least one guided resolution and at least one escalation across the session set (SC-004, V2.1, V2.2)

**Checkpoint**: Three or more testers have completed the script, the records are filed and
PII-clean, and the raw usefulness responses exist for Phase 5 to aggregate.

---

## Phase 5: User Story 3 - The Prototype Is Evaluated Against Its Requirements and Its Perceived Usefulness (Priority: P3)

**Goal**: Produce the two Objective-4 deliverables — a requirement-by-requirement assessment
and a participant-judgement report — as two distinct documents.

**Independent Test**: Confirm two separate documents exist — one covering every committed
requirement with no blank verdicts, and one participant-judgement report with aggregate
figures.

**⚠️ Blocked by**: US1 (evidence must exist to cite) and US2 (participants must have used
the system).

### Traceability assessment

- [ ] T040 [US3] Update `docs/testing/requirements-traceability.md` **in place** with exactly 16 verdict rows — `FR-1`…`FR-9` and `NFR-1`…`NFR-7` — each carrying exactly one verdict (`Satisfied` / `Partially satisfied` / `Not satisfied`) and at least one **named** evidence reference; never "tested" or "see tests" (FR-010, SC-001, T1, T2)
- [ ] T041 [US3] State the shortfall reason openly on every non-`Satisfied` row in `docs/testing/requirements-traceability.md`; recording a shortfall as satisfied or omitting the row fails FR-011 (T3)
- [ ] T042 [US3] Add the `supportingFeatureFRs` column entries in `docs/testing/requirements-traceability.md`, listing the per-feature `FR-xxx` ids beneath each IR parent as evidence rather than as separate verdicts (research.md Decision 2)
- [ ] T043 [US3] Cite a demo-machine artifact — not an automated suite result — as the evidence for FR-5 (availability) and FR-8 (remediation) rows in `docs/testing/requirements-traceability.md` (T7, V7.2, Principle IV)
- [ ] T044 [US3] Resolve the file's existing caveat in `docs/testing/requirements-traceability.md` that "TC identifiers cover features 001–003 only": either add `TC-` prefixes to the 004/005 test titles and regenerate with `npm --prefix backend run tc-tables`, or restate it as an explained, accepted limit. It may not remain an unexplained gap (T5, V5.4)
- [ ] T045 [US3] Verify every evidence reference in `docs/testing/requirements-traceability.md` resolves to something that exists in the repository; an unresolvable reference is an FR-020 contradiction (V7.1, T2, SC-012)

### Perceived-usefulness evaluation

- [ ] T046 [US3] Complete `docs/testing/usefulness-evaluation.md` with the mean per question and an overall mean across Q1–Q6, the range **and** standard deviation per question, and the participant count stated explicitly next to every aggregate figure (FR-012, SC-005, V6.1)
- [ ] T047 [US3] Report Q3 and Q6 individually in `docs/testing/usefulness-evaluation.md`, not only inside a rolled-up mean — they are the two questions that speak directly to the O-4 construct (U3)
- [ ] T048 [US3] State the sample-size limit explicitly in `docs/testing/usefulness-evaluation.md`: at N ≈ 3–5 the report presents descriptive figures only and makes no inferential claim; give raw counts beside any percentage (U1, U2, V6.3)
- [ ] T049 [US3] Add the one-sentence note to `docs/testing/usefulness-evaluation.md` recording that a validated instrument (TAM / SUS / UMUX-LITE) was considered and rejected in favour of comparability with the project's own prior survey (U7, research.md Decision 3)
- [ ] T050 [US3] Verify `docs/testing/requirements-traceability.md` and `docs/testing/usefulness-evaluation.md` each stand alone and neither cites the other as fulfilling its own purpose (FR-013, T8, V6.4)

### Objective coverage — written last

- [ ] T051 [US3] Add the objective coverage table to `docs/testing/requirements-traceability.md` with a coverage statement and at least one named evidence reference for each of `O-1`…`O-4`, citing both Objective-4 deliverables under O-4. Write this **after** T046–T050, since it cannot honestly cite deliverables that do not yet exist (SC-011, V5.5, T4)

**Checkpoint**: Both Objective-4 deliverables exist, are complete, and are distinct.

---

## Phase 6: User Story 4 - Feedback Is Acted On Within the Project's Boundaries (Priority: P4)

**Goal**: Triage every defect and observation, fix what is worth fixing, and decline what
crosses a boundary — with the record showing both.

**Independent Test**: Confirm every logged defect and observation has a recorded
disposition, every declined item states its reason, and the automated suites and demo path
still pass after the final change.

**⚠️ FR-016 binds every task in this phase.** Re-read the phase-wide constraints above
before the first edit.

### Triage

- [ ] T052 [US4] Assign a severity (`blocking` / `significant` / `minor`), a classification (`defect` / `out-of-scope`), and a disposition (`fix` / `defer` / `decline`) to every row in `docs/testing/observations.md`; no row may rest without all three (FR-014, SC-007, V4.1)
- [ ] T053 [US4] State a reason on every `defer` or `decline` row in `docs/testing/observations.md`, and name one of the five boundaries (`new-functional-requirement`, `relaxed-safety-control`, `third-account-role`, `beyond-registered-endpoints`, `admin-console-deferred`) on every `out-of-scope` decline (FR-014, FR-016, V4.3)
- [ ] T054 [US4] Record an explicit disposition for `OBS-01` in `docs/testing/observations.md` — `frontend/src/components/SessionForm.tsx` is dead code with a green test suite (Principle VI breach) — choosing delete / wire up / accept with reason, and apply the chosen action (plan.md § Complexity Tracking)
- [ ] T055 [US4] Record an explicit disposition for `OBS-02` in `docs/testing/observations.md` — `frontend/src/pages/MyTicketsPage.tsx` renders status inline rather than reusing `TicketCard`/`StatusBadge`, so employee-facing status wording can drift between two screens (FR-019 risk)

### Bounded refinement

- [ ] T056 [US4] Apply the copy, microcopy, and step-ordering fixes dispositioned `fix` to the specific files under `frontend/src/` that testers demonstrably misread, changing wording and ordering only — no palette, type-scale, spacing, component-shape, or motion change (NFR-2, plan.md § Design Direction)
- [ ] T057 [US4] Apply any wording fix that belongs to the agent's own language to the relevant module under `backend/src/services/llm/prompts/` (`core.ts`, `classification.ts`, `guidance.ts`, `tools.ts`) rather than to UI strings, since NFR-2's plain-language guarantee is produced there
- [ ] T058 [US4] Repair the genuine functional defects dispositioned `fix` in their owning files under `backend/src/` or `frontend/src/`, each shipping or refreshing its automated test in the same task (Principle IV)
- [ ] T059 [US4] Resolve or explicitly accept with written justification every `blocking` item in `docs/testing/observations.md`; none may be left silently open (FR-015, SC-006, V4.2)

### Regression gates

- [ ] T060 [US4] **Principle VIII gate** — if any file under `backend/src/services/llm/prompts/` changed in T057, run `npm --prefix backend test -- classification` and `npm --prefix backend test -- escalation` and confirm both pass before the change merges; a prompt regression is a real regression (quickstart S6)
- [ ] T061 [US4] **Shared-component gate** — re-validate against the **full** scenario set in `docs/testing/uat-scenarios.md`, not only the report that prompted the change, if any of `frontend/src/components/ActionRecordCard.tsx`, `ActionOutcomeBadge.tsx`, `AppNav.tsx`, `RouteGuards.tsx`, `StatusBadge.tsx`, or `MetricsSummary.tsx` changed; a `StatusBadge` change also requires checking `frontend/src/pages/MyTicketsPage.tsx` (spec Edge Case 6, `OBS-02`)
- [ ] T062 [US4] Run the mechanical design detector once, over **only** the files refinement actually touched — not the untouched app, where findings no tester flagged are out of scope this phase (plan.md § Planned build sequence)
- [ ] T063 [US4] Run `graphify update .` from the repository root after the final frontend or backend edit to keep `graphify-out/` current
- [ ] T064 [US4] Audit the phase diff for boundary crossings with `git diff --stat <phase-start>..HEAD` and confirm in `docs/testing/observations.md` that no new route, screen, or navigation entry was added, no file under `backend/src/policy/` changed, no third account role or HTTP promotion path exists, and no endpoint registry entry was added beyond the registered test endpoints (FR-016, quickstart S6)

### Closing gates — FR-017

- [ ] T065 [US4] Re-run the full automated gates and confirm all green: `npm --prefix backend run typecheck && npm --prefix backend run lint && npm --prefix backend test` and `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test` (FR-017, quickstart S7)
- [ ] T066 [US4] Run the release-gated demo path — run **2 of 2** required by FR-002 — via `npm --prefix backend run demo-path` on the demo machine; it MUST complete on the **first attempt** with refinements in place. Commit the generated log under `docs/testing/demo-path-runs/` (SC-008, quickstart S7)
- [ ] T067 [US4] Re-walk the US1 cross-feature journey by hand with the refinements in place and record its outcome in `docs/testing/demo-path-runs/` (spec AS4-5)
- [ ] T068 [US4] Verify `docs/testing/observations.md` has zero rows without a disposition and zero `blocking` rows without a fix or a written accepted-risk justification (SC-006, SC-007, quickstart S5)

**Checkpoint**: Every observation is dispositioned, the refinements are in, both suites and
the demo path are green — and Phase 3's T021/T022 screenshots may now be captured.

---

## Phase 7: User Story 5 - Each Kind of User Has Written Guidance (Priority: P5)

**Goal**: Short written guidance for each way a person interacts with the system, in the
plain language the project committed to.

**Independent Test**: Give the guidance to a person unfamiliar with the system and confirm
they can complete that role's primary task using only the written material.

**⚠️ Blocked by**: Phase 6. Writing before refinement settles guarantees rework, and a late
label change in `AppNav` or `StatusBadge` silently invalidates guidance already written
(research.md Decision 9).

- [ ] T069 [P] [US5] Write `docs/guidance/employee-guide.md` covering reporting an issue by voice or text, reading the classification and ticket, following guided troubleshooting, checking ticket status, and reaching an escalation — in plain, jargon-free language (FR-018, NFR-2)
- [ ] T070 [P] [US5] Write `docs/guidance/staff-guide.md` covering the dashboard and metrics surface, working the queue, taking over an escalated ticket, reading the audit trail, approving a remediation, and using the kill switch (FR-018, IR FR-9)
- [ ] T071 [P] [US5] Write `docs/guidance/maintainer-guide.md` covering category and guide administration through the `MAINTAINER_KEY` request-header surface, describing it explicitly as a shared-secret header and **not** as a third account role (FR-018, Principle III locked model)
- [ ] T072 [US5] Walk all three files in `docs/guidance/` screen by screen against the running system on the demo machine and correct every instruction that describes a screen, action, or option that does not exist (FR-019, quickstart S8)
- [ ] T073 [US5] Have at least one unfamiliar person per role covered complete that role's primary task using only the written material, and record the outcome per role in `docs/testing/uat-sessions.md` (SC-010)

**Checkpoint**: All three guidance documents exist, match the running system, and have been
person-checked.

---

## Phase 8: Polish & Phase Closure

**Purpose**: Bring every stale record current and re-verify the governance gates. The
repository is the authority — where two artifacts disagree, the stale document is corrected,
not the repository (spec Edge Case 7).

- [ ] T074 [P] Bring `docs/handoff.md` current: it is dated 2026-08-19 and states four features are specified, but feature 005 shipped 2026-08-21 and this phase has since run (FR-020, `OBS-04`)
- [ ] T075 [P] Add a dated note to `docs/testing/demo-path-log.md` recording that the 2026-07-09 entry is superseded by the generated logs in `docs/testing/demo-path-runs/`, and that it lacked the voice and remediation legs and used `mongodb-memory-server` rather than the `rs0` replica set. Retain the old entry rather than deleting it (`OBS-03`, research.md Decision 10)
- [ ] T076 [P] Re-verify the status prose in `README.md` against the delivered state and update it, including the How to use, configuration, and roadmap sections for anything this phase changed
- [ ] T077 [P] Remove the three 0-byte shell-redirection artifacts from the repository root — `No`, `Filled`, and `will` — the same class as those cleared by 001 T051 (`OBS-05`, research.md Decision 10)
- [ ] T078 Regenerate `docs/testing/tc-tables.md` from the final test run with `npm --prefix backend run tc-tables` so the Chapter 5 tables match the post-refinement suites
- [ ] T079 Re-verify the Compliance Debt Register in `.specify/memory/constitution.md` is empty at phase end and record the check in `docs/testing/requirements-traceability.md` (FR-021, SC-011)
- [ ] T080 Sweep the repository for any document describing a delivery state the repository contradicts — `docs/`, `README.md`, `AGENTS.md`, and every `specs/*/tasks.md` — and correct each one found (FR-020, SC-012, quickstart S9)
- [ ] T081 Walk all nine quickstart scenarios in `specs/006-refining-transition/quickstart.md` (S1–S9) and confirm every checkbox passes; record the closure verdict in `docs/testing/demo-environment-check.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately on the demo machine
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2. T014 gates Phase 4. T021/T022 wait for Phase 6
- **US2 (Phase 4)**: Depends on T012 (instrument reconciled) and T014 (demo path passed)
- **US3 (Phase 5)**: Depends on US1 (evidence to cite) and US2 (participants and responses)
- **US4 (Phase 6)**: Depends on US1 and US2 (there must be real feedback to refine against)
- **US5 (Phase 7)**: Depends on US4 (guidance written before refinement guarantees rework)
- **Polish (Phase 8)**: Depends on all stories

### The two hard sequencing rules

1. **The 24-hour probe (T013) starts on day one** and runs in parallel with everything
   else. It is a wall-clock dependency that cannot be compressed.
2. **Screenshots (T021, T022) are captured last**, after Phase 6 settles. Capturing them
   earlier produces evidence that contradicts the shipped system under FR-019/FR-020.

### Story Dependencies

- **US1 (P1)**: Independent once Phase 2 completes. Delivers the submittable Chapter 4/5
  evidence on its own
- **US2 (P2)**: Needs US1's demo path to have passed — testers may not be put in front of an
  unverified build (FR-002)
- **US3 (P3)**: Needs both US1 and US2. Cannot be honestly produced before either
- **US4 (P4)**: Needs US1 and US2 for its input; re-runs US1's gate as its own exit gate
- **US5 (P5)**: Needs US4 settled so the guidance describes final wording

### Parallel Opportunities

- T002, T003 run in parallel after T001; T005 and T006 run in parallel after T004
- T010, T011, and T013 run in parallel — different files, no shared dependency
- T013 (the 24-hour probe) runs in parallel with **all** of Phases 3–7
- T069, T070, T071 are three separate guidance files and run in parallel
- T074, T075, T076, T077 touch four different files and run in parallel
- Within Phase 4, T034 (questionnaire) follows each session immediately rather than being
  batched at the end — a tester who has left cannot be re-surveyed

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch the three independent foundational tasks together:
Task: "Create docs/testing/observations.md seeded with OBS-01…OBS-05"
Task: "Extract original survey structure from the IR PDF into contracts/usefulness-instrument.md"
Task: "Start the unattended 24-hour availability probe on the demo machine"
```

## Parallel Example: Phase 7 Guidance

```bash
# Three separate files, no shared state:
Task: "Write docs/guidance/employee-guide.md"
Task: "Write docs/guidance/staff-guide.md"
Task: "Write docs/guidance/maintainer-guide.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — prove the environment contract
2. Complete Phase 2: Foundational (CRITICAL — the demo path script blocks everything)
3. Complete Phase 3: User Story 1, except the two screenshot tasks
4. **STOP and VALIDATE**: quickstart S1 and S2 pass
5. At this point the project is submittable with Chapter 4 and Chapter 5 evidence intact —
   this is what makes US1 the MVP

### Incremental Delivery

1. Setup + Foundational → the demo path is a single artifact and the probe clock is running
2. Add US1 → the system is verified end to end (MVP)
3. Add US2 → real testers have used it and their experience is on record
4. Add US3 → both Objective-4 deliverables exist
5. Add US4 → feedback is acted on, and the demo path passes a second time
6. Add US5 → every role has guidance that matches the running system
7. Polish → every stale record is current and the governance gates are re-verified

### Solo Execution Note

This phase is executed by one developer, so the parallel markers indicate tasks that do not
block each other rather than tasks for separate people. The one genuinely concurrent item is
T013 — the 24-hour probe runs unattended while Phases 3–7 proceed.

---

## Notes

- `[P]` tasks touch different files and have no dependency on each other
- The `[Story]` label maps each task to its user story for traceability
- This phase adds **no new functional requirement**. An item that would is declined and
  recorded as an out-of-scope observation naming the boundary it crosses (FR-016)
- A remediation refusal against an unregistered target is a **passed safety scenario**, not
  a defect (spec Edge Case 5, Principle II)
- A session run without the `rs0` replica set is halted and restarted, not scored — its rows
  are discarded rather than filed as false defects (contracts/session-record.md C8)
- The developer performs all commits; no AI attribution in any commit, document, or
  published artifact (Constitution § Development Workflow)
</content>
</invoke>
