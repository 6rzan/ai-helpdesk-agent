# Contract: Requirement Verdict Row Format

**Consumer**: Objective **O-4**, first half — evaluation of the prototype against the
gathered user requirements. Also APU Chapter 5.

**File**: `docs/testing/requirements-traceability.md` — **updated in place**. The file
already exists (11.3 KB) and already maps the IR set; this phase completes it with verdicts
and resolves its two stated limits.

---

## Verdict table contract

Exactly **16 rows** — `FR-1`…`FR-9`, `NFR-1`…`NFR-7` (research.md Decision 2).

| Column | Rules |
|---|---|
| **Requirement** | The IR id and a short restatement. |
| **Verdict** | Exactly one of `Satisfied` / `Partially satisfied` / `Not satisfied`. Never blank (FR-010, SC-001). |
| **Evidence** | ≥ 1 **named** reference — a path, suite, TC/UAT id, screenshot, or dated demo run. Never "tested" or "see tests" (SC-001). |
| **Shortfall reason** | **Required** whenever the verdict is not `Satisfied`. Blank only on `Satisfied` rows (FR-011). |
| **Supporting feature FRs** | Per-feature FR ids beneath this IR parent — evidence, not separate verdicts. |

### Example rows

| Requirement | Verdict | Evidence | Shortfall reason | Supporting feature FRs |
|---|---|---|---|---|
| FR-3 — classify and auto-create ticket with timestamps | Satisfied | `backend/tests/integration/escalation-flow.test.ts`; `docs/testing/benchmark-results.md` (100% accuracy, p90 1.6 s); demo run 2026-xx-xx step 1 | — | 001 FR-003, FR-005 |
| FR-5 — available beyond working hours (24/7 in test env) | *(pending T049)* | `docs/testing/availability-probe-24h.log` | | 001 FR-011 |
| NFR-2 — plain, jargon-free, logically ordered guidance | *(pending UAT)* | `UAT-012`, `UAT-018`; `backend/src/services/llm/prompts/core.ts` | | 003 FR-004 |

Rows marked *(pending)* above are illustrative of sequencing only — **no row may remain
pending at phase end** (SC-001).

---

## Objective coverage table

A **separate table in the same file**. SC-011 requires objective coverage to be reviewed,
not only the requirement list — an unbuilt objective is invisible if only FRs are tracked
(Principle I rationale).

| Column | Rules |
|---|---|
| **Objective** | `O-1`…`O-4`. All four required. |
| **Coverage statement** | How the delivered project satisfies it. Required. |
| **Evidence** | ≥ 1 named reference. |

O-4's own evidence is `docs/testing/requirements-traceability.md` **and**
`docs/testing/usefulness-evaluation.md` — both, since FR-013 makes them distinct
deliverables. This is why the objective table is written **last**: it cannot honestly cite
deliverables that do not yet exist.

---

## Validation rules

- **T1** 16 verdict rows present, zero blanks (FR-010, SC-001).
- **T2** Every verdict row carries ≥ 1 named, **resolvable** evidence reference. A reference
  that does not resolve at phase end is an FR-020 contradiction (SC-012).
- **T3** Every non-`Satisfied` row states its reason openly. Recording a shortfall as
  satisfied, or omitting the row, fails FR-011 — a shorter table is not a better one.
- **T4** All four objectives carry a coverage statement (SC-011).
- **T5** The file's existing caveat — *"TC identifiers cover features 001–003 only"*, because
  the 004 and 005 suites do not carry `TC-` prefixes — MUST be either **closed** (add the
  prefixes and regenerate via `npm --prefix backend run tc-tables`) or **restated as an
  explained, accepted limit**. It may not remain an unexplained gap under FR-010.
- **T6** A committed requirement discovered during UAT to have never been built is recorded
  `Not satisfied` here and **raised immediately** — it is a scope failure, not a defect to
  triage (spec Edge Case 2).
- **T7** Evidence for a demo-machine claim (FR-5 availability, FR-8 remediation) MUST cite a
  demo-machine artifact. An automated suite result is a different claim (Principle IV).
- **T8** This document MUST NOT be presented as also satisfying the perceived-usefulness
  evaluation (FR-013).
