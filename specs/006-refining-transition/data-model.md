# Phase 1 Data Model: Refining & Transition Phase

**These are document entities, not database collections.** This phase adds no Mongoose
schema, no collection, and no migration. Every entity below is a row or record in a
version-controlled Markdown file under `docs/testing/`. The model is specified with the
same rigour as a database schema because these documents are the phase's actual
deliverables — they carry the marks — and because FR-010, FR-014, and SC-007 make
completeness structurally checkable only if the fields are fixed in advance.

Validation rules are drawn from the spec's requirements; each rule names its source.

---

## Entity relationship overview

```text
TesterProfile ──< SessionRecord >── ScenarioScript
                       │
                       └──< Observation ──> Disposition (fix | defer | decline)
                                  │
                                  └── boundaryCrossed (only when declined for scope)

TesterProfile ──< UsefulnessResponse

RequirementVerdict ──> EvidenceReference (≥ 1, named)

ObjectiveCoverage (O-1…O-4) ──> EvidenceReference (≥ 1, named)
```

---

## 1. TesterProfile

**File**: `docs/testing/uat-sessions.md` (roster table at top)
**Cardinality**: 3 minimum (hard floor, FR-005), 3–5 working target.

| Field | Type | Rules |
|---|---|---|
| `pseudonym` | string | Required, unique. Format `T1`, `T2`, … No real name, initials, or handle. |
| `roleType` | enum | `technical` \| `non-technical`. The only occupational detail stored. |
| `supportFamiliarity` | enum | `none` \| `occasional` \| `frequent`. |
| `experienceExercised` | enum | `employee` \| `staff`. |
| `consentRecorded` | boolean | Required `true` before any session record is filed. |

**Validation rules**
- **V1.1** No field may contain information identifying a real person beyond the two
  coarse bands above (FR-005, NFR-5, spec AS-5 / edge case "personal or workplace-identifying detail").
- **V1.2** At least one profile MUST have `experienceExercised = staff` (FR-008).
- **V1.3** Count of profiles MUST be ≥ 3. Fewer is **not** absorbable — it is escalated to
  the supervisor, and the developer MUST NOT be counted as a tester (spec Edge Case 1).
- **V1.4** `consentRecorded` MUST be `true`; a profile without it is not filed
  (research.md Decision 5).

---

## 2. ScenarioScript

**File**: `docs/testing/uat-scenarios.md`
**Written before the first session** — this ordering is itself a requirement (FR-006).
**Cardinality**: ≥ 8 (research.md Decision 6).

| Field | Type | Rules |
|---|---|---|
| `id` | string | Required, unique. Format `SC-01`, `SC-02`, … |
| `situation` | string | The scenario as read to the tester, in the tester's own terms. Contains no system vocabulary that would coach the answer. |
| `targetCategory` | enum | One of the six mandated categories, or `staff-workflow`. |
| `expectedOutcome` | enum | `guided-resolution` \| `escalation` \| `staff-takeover` \| `remediation-approved` \| `safe-refusal`. |
| `role` | enum | `employee` \| `staff`. |

**Validation rules**
- **V2.1** Across the set, every one of the six mandated categories — `password_login`,
  `network`, `printer`, `peripheral`, `slow_performance`, `service_status` — MUST be the
  `targetCategory` of at least one scenario (FR-006, SC-004; category floor per Principle I FR-2).
- **V2.2** At least one scenario MUST have `expectedOutcome = guided-resolution` and at
  least one `expectedOutcome = escalation` (FR-006, SC-004).
- **V2.3** At least one scenario MUST have `role = staff` (FR-008).
- **V2.4** The file's modification date MUST precede the first `SessionRecord.date`
  (FR-006). This is verifiable from git history and is the reason the script is committed
  before sessions rather than written up alongside them.
- **V2.5** A scenario with `expectedOutcome = safe-refusal` (remediation attempted against
  an unregistered target) records a **pass** when refused. It is not a defect
  (spec Edge Case 5, Principle II).

**Coverage matrix** — maintained at the top of the file, updated *during* the session set so
gaps are fillable while testers remain available:

| Category | Scenario | Exercised by | Status |
|---|---|---|---|
| password_login | SC-01 | | ☐ |
| network | SC-02 | | ☐ |
| printer | SC-03 | | ☐ |
| peripheral | SC-04 | | ☐ |
| slow_performance | SC-05 | | ☐ |
| service_status | SC-06 | | ☐ |
| *(guided resolution)* | SC-07 | | ☐ |
| *(escalation)* | SC-08 | | ☐ |

---

## 3. SessionRecord

**File**: `docs/testing/uat-sessions.md`
Relates exactly one `TesterProfile` to exactly one `ScenarioScript`.
**Format**: the project's five-column TC-table layout with a `UAT-` prefix — see
[`contracts/session-record.md`](./contracts/session-record.md).

| Field | Type | Rules |
|---|---|---|
| `uatNo` | string | Required, unique. Format `UAT-001`, … Distinct from generated `TC-` rows. |
| `testerPseudonym` | FK → TesterProfile | Required, must exist in the roster. |
| `scenarioId` | FK → ScenarioScript | Required, must exist in the script. |
| `date` | date | Required. MUST be ≥ the scenario script's commit date (V2.4). |
| `outcome` | enum | `unaided` \| `prompted` \| `not-completed`. Exactly one. |
| `observedBehaviour` | string | What the system actually did, including hesitation and misreads. |
| `testerComment` | string \| null | The tester's own words, generalised for PII before filing. |

**Validation rules**
- **V3.1** `outcome` MUST be exactly one of the three values (FR-007). "Partly" is not a
  value — a scenario needing any facilitator input is `prompted`.
- **V3.2** A scenario blocked by a defect is recorded `not-completed`, the defect is logged
  as an `Observation`, and **the session continues with the remaining scenarios** — it is
  not abandoned (FR-007, spec AS2-3).
- **V3.3** `testerComment` MUST be reviewed and generalised **before** the record is
  committed; raw comments are never committed and then edited, because git history retains
  them (research.md Decision 5, spec Edge Case 8).
- **V3.4** SC-003 gate: `count(outcome = unaided) / count(all) ≥ 0.80`. Computed across the
  whole session set, reported as a figure, not asserted.
- **V3.5** A tester request for unscoped behaviour is **not** recorded here as a defect — it
  becomes an `Observation` classified `out-of-scope` (FR-007, spec AS2-4).

---

## 4. Observation

**File**: `docs/testing/observations.md` — the single triage register.
**Source**: verification (US1), tester sessions (US2), or planning findings.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Required, unique. Format `OBS-01`, … |
| `description` | string | What was noticed. |
| `source` | enum | `verification` \| `uat-session` \| `planning`. Where it came from. |
| `sourceRef` | string \| null | e.g. `UAT-014`, or the demo-path run date. |
| `severity` | enum | `blocking` \| `significant` \| `minor`. Required — no blanks (FR-014). |
| `classification` | enum | `defect` \| `out-of-scope`. |
| `disposition` | enum | `fix` \| `defer` \| `decline`. Required — no blanks (FR-014, SC-007). |
| `reason` | string | Required when `disposition` is `defer` or `decline` (FR-014). |
| `boundaryCrossed` | enum \| null | Required when declined for scope. One of the five named boundaries below. |

**Severity banding** (spec Assumptions):

| Severity | Meaning | Consequence |
|---|---|---|
| `blocking` | A core journey cannot be completed | **Gates submission.** Fixed, or explicitly accepted with written justification (FR-015, SC-006). Never left silently open. |
| `significant` | Completed, but with confusion or a wrong-looking result | Triaged on merit |
| `minor` | Cosmetic or wording | May be declined with a reason |

**Named boundaries** for `boundaryCrossed` (FR-016; enumerated so a decline cites a source
rather than an opinion):

| Value | Source |
|---|---|
| `new-functional-requirement` | FR-016, Principle I |
| `relaxed-safety-control` | FR-016, Principle II |
| `third-account-role` | FR-016, Principle III (locked two-role model) |
| `beyond-registered-endpoints` | FR-016, NFR-3 |
| `admin-console-deferred` | Spec Assumptions |

**Validation rules**
- **V4.1** No observation may exist without both a `severity` and a `disposition` (FR-014, SC-007).
- **V4.2** Every `blocking` item MUST end at `disposition = fix`, or `decline`/`defer`
  carrying a written accepted-risk justification (FR-015, SC-006).
- **V4.3** `classification = out-of-scope` MUST carry a `boundaryCrossed`, and MUST NOT be
  counted as a defect in any reported defect figure (FR-016, spec AS2-4).
- **V4.4** A verification failure is logged here **before** any fix is attempted, so the
  failure stays in the record rather than being silently repaired (FR-004, spec AS1-4).
- **V4.5** A missing *committed requirement* discovered mid-session is **not** an
  observation. It is a scope failure: recorded `not satisfied` in the traceability
  assessment and raised immediately (spec Edge Case 2).

**Pre-seeded from planning** (already found, awaiting disposition):

| id | description | source | severity | classification |
|---|---|---|---|---|
| `OBS-01` | `frontend/src/components/SessionForm.tsx` has a passing test suite and zero production consumers — dead code (Principle VI) with green coverage over unshipped code | `planning` | `minor` | `defect` |
| `OBS-02` | `MyTicketsPage` renders status inline rather than reusing `TicketCard`/`StatusBadge`; employee-facing status wording can drift between two screens (FR-019 risk) | `planning` | `minor` | `defect` |
| `OBS-03` | `docs/testing/demo-path-log.md` (2026-07-09) records a PASS lacking the voice and remediation legs and using `mongodb-memory-server` rather than `rs0`, while 005 T118 claims a passing run with remediation — artifacts disagree | `planning` | `significant` | `defect` |
| `OBS-04` | `docs/handoff.md` (2026-08-19) states four features shipped; 005 shipped 2026-08-21 — stale status record (FR-020) | `planning` | `minor` | `defect` |
| `OBS-05` | Root artifact `No` (0 bytes) — shell-redirection accident, same class as those cleared by 001 T051 | `planning` | `minor` | `defect` |

---

## 5. RequirementVerdict

**File**: `docs/testing/requirements-traceability.md` — **updated in place**, not replaced.
**Format**: see [`contracts/traceability-verdict.md`](./contracts/traceability-verdict.md).
**Cardinality**: exactly 16 — FR-1…FR-9 and NFR-1…NFR-7 (research.md Decision 2).

| Field | Type | Rules |
|---|---|---|
| `requirementId` | string | Required, unique. `FR-1`…`FR-9`, `NFR-1`…`NFR-7`. |
| `verdict` | enum | `satisfied` \| `partially-satisfied` \| `not-satisfied`. **Exactly one.** |
| `evidence` | EvidenceReference[] | **≥ 1**, each naming a file, suite, or artifact. |
| `shortfallReason` | string | Required when `verdict ≠ satisfied` (FR-011). |
| `supportingFeatureFRs` | string[] | Per-feature FR ids beneath this IR parent. Evidence, not verdicts. |

**Validation rules**
- **V5.1** All 16 rows present; **zero blank verdicts** (FR-010, SC-001).
- **V5.2** Every row carries ≥ 1 **named** evidence reference — a path, suite, or artifact,
  never "tested" or "see tests" (FR-010, SC-001).
- **V5.3** A shortfall is stated **openly with its reason**; recording it as satisfied, or
  omitting the row, is a failure of FR-011 — not a tidier document.
- **V5.4** The document's existing caveat that TC identifiers cover features 001–003 only
  MUST be either closed or restated as an explained, accepted limit. It may not remain an
  unexplained gap (research.md Decision 2).

### ObjectiveCoverage — a separate table in the same file

SC-011 requires objective coverage to be reviewed, **not only the requirement list**.

| Field | Type | Rules |
|---|---|---|
| `objectiveId` | enum | `O-1` \| `O-2` \| `O-3` \| `O-4`. All four required. |
| `coverageStatement` | string | Required. How the delivered project satisfies it. |
| `evidence` | EvidenceReference[] | ≥ 1 named. |

- **V5.5** All four objectives carry a statement (SC-011). O-4's own evidence is the two
  deliverables this phase produces — which is why it cannot be written until they exist.

---

## 6. UsefulnessResponse

**File**: `docs/testing/usefulness-evaluation.md`
**Instrument**: [`contracts/usefulness-instrument.md`](./contracts/usefulness-instrument.md).
**Distinct deliverable** from the traceability assessment — FR-013 forbids either standing
in for the other.

| Field | Type | Rules |
|---|---|---|
| `participantPseudonym` | FK → TesterProfile | Required. |
| `ratings` | map<questionId, 1..5> | One rating per instrument question; no blanks. |
| `freeComment` | string \| null | Optional. PII-generalised before filing (V3.3 applies). |

**Reported aggregate** — all three parts are required by FR-012 and SC-005:

| Field | Rule |
|---|---|
| `aggregate` | Mean per question and overall. |
| `spread` | Range or standard deviation. Required — a mean alone does not satisfy FR-012. |
| `participantCount` | Required, stated explicitly. |

**Validation rules**
- **V6.1** All three of aggregate, spread, and count are reported (FR-012, SC-005).
- **V6.2** The instrument's structure MUST be comparable to the IR's original
  requirements-gathering survey — which requires that structure to be **extracted from the
  IR PDF first** (research.md Decision 3). Comparability may not be asserted against an
  untranscribed document.
- **V6.3** With N ≈ 3–5, the report presents descriptive figures and **explicitly declines
  to claim statistical significance**. Stating the limit is FR-011-consistent behaviour.
- **V6.4** This document and `requirements-traceability.md` are two files. Neither may cite
  the other as fulfilling its own purpose (FR-013, spec AS3-4).

---

## 7. EvidenceReference (shared value type)

Used by `RequirementVerdict`, `ObjectiveCoverage`, and closure records.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `test-suite` \| `tc-row` \| `screenshot` \| `document` \| `demo-run` \| `session-record` |
| `ref` | string | A resolvable path, id, or dated run — e.g. `backend/tests/integration/takeover.test.ts`, `UAT-014`, `docs/implementation/screenshots/approval-queue.png`. |

- **V7.1** `ref` MUST resolve to something that exists in the repository at phase end.
  An unresolvable reference is an FR-020 contradiction (SC-012).
- **V7.2** Evidence for a demo-machine claim MUST be a `demo-run` or artifact from the demo
  machine — an automated suite result is a different claim and cannot substitute
  (Principle IV, research.md Decision 1).

---

## State transitions

**Observation lifecycle** — the only entity here with meaningful states:

```text
logged ──> triaged (severity + classification assigned)
              │
              ├──> fix ──────> resolved ──> re-validated (full scenario set)
              ├──> defer ────> reason recorded
              └──> decline ──> reason + boundaryCrossed recorded
```

- No observation may rest in `logged` at phase end (SC-007).
- `blocking` may not rest in `defer`/`decline` without written accepted-risk justification
  (SC-006).
- `re-validated` means the **full** scenario set was re-checked, not only the report that
  prompted the change — refining one tester's confusion can worsen another's path
  (spec Edge Case 6).

**Phase closure gate** — all must hold simultaneously (FR-017, FR-020, FR-021):

1. Automated suites pass (backend + frontend, typecheck, lint).
2. The release-gated demo path completes on the first attempt on the demo machine.
3. The US1 cross-feature journey is re-run and passes **with refinements in place** (AS4-5).
4. Zero deferred evidence items across all features (SC-009).
5. Compliance Debt Register re-verified empty; O-1…O-4 coverage recorded (FR-021, SC-011).
6. No repository document contradicts the delivered state (FR-020, SC-012).
