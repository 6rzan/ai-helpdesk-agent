# Contract: UAT Session Record Format

**Consumer**: APU FYP Chapter 5 (Testing). Rows must paste into the report without being
rewritten (FR-009).

**Producer**: The developer, by hand, during and immediately after each tester session.
**Not** the `tc-tables` generator — see "Why this is hand-authored" below.

**File**: `docs/testing/uat-sessions.md`

---

## Column contract

The project's established test-case table is five columns. UAT records use the same five so
they are format-compatible with the generated `TC-` tables:

| Column | Source field | Content |
|---|---|---|
| **TC-No** | `uatNo` | `UAT-001`, `UAT-002`, … — the `UAT-` prefix is load-bearing (see below) |
| **Input** | `scenarioId` + situation | The scenario id and a one-line restatement of what the tester was asked to do |
| **Expected Output** | `ScenarioScript.expectedOutcome` | What the script said should happen |
| **Actual Output** | `observedBehaviour` | What the system actually did, including hesitation, misreads, and where the tester gave up |
| **Passed/Failed** | `outcome` | `Passed (unaided)` \| `Passed (prompted)` \| `Failed (not completed)` |

A sixth **Comment** column carries `testerComment` where one was offered. It is outside the
Chapter 5 five-column table and is dropped when pasting, so the report table stays
conformant while the raw comment survives in the repository.

---

## Why the `UAT-` prefix is load-bearing

`backend/scripts/tc-tables.ts` reads `tests/.results/vitest-results.json` and extracts test
titles matching `/^(TC-\d+)/`. It is a projection of **automated Vitest results**.

A human session has no Vitest result to project from. Using `TC-` for these rows would make
human observations indistinguishable from generated automated evidence in the very artifact
markers scrutinise — and the only way to route them through the generator would be to author
fake passing tests carrying human observations, which would corrupt the automated evidence.

The `UAT-` prefix keeps the two evidence classes distinguishable at a glance while both stay
paste-ready. FR-009 asks that records be *expressible in* the established format; matching
the columns satisfies that.

---

## Roster table (top of file)

Filed before the first session record. No field may carry identifying detail beyond these
two bands (FR-005, NFR-5).

| Pseudonym | Role type | Support familiarity | Experience exercised | Consent recorded |
|---|---|---|---|---|
| T1 | non-technical | occasional | employee | yes |
| T2 | technical | frequent | staff | yes |
| T3 | non-technical | none | employee | yes |

Constraints: ≥ 3 rows; ≥ 1 row with `staff`; every row `consent recorded = yes`. The
developer is never a row (spec Edge Case 1).

---

## Example rows

| TC-No | Input | Expected Output | Actual Output | Passed/Failed | Comment |
|---|---|---|---|---|---|
| UAT-001 | SC-01 (T1) — cannot log in after password change | Guided resolution to completion | Classified `password_login`, ticket `HD-0xxx` created, guide served; tester completed step 3 unaided | Passed (unaided) | "Clear enough, I knew what to do." |
| UAT-007 | SC-08 (T1) — vague "my thing is broken" | Escalation with transcript | Clarifying question, then escalated `unclassified` after rounds exhausted; full transcript attached | Passed (unaided) | — |
| UAT-012 | SC-04 (T3) — mouse not responding | Guided resolution to completion | Tester read "peripheral" as printer-related and stopped at step 1; facilitator restated the step | Passed (prompted) | "I did not know what peripheral meant." |
| UAT-015 | SC-11 (T2, staff) — restart a print spooler on an unregistered host | Safe refusal | Executor refused; refusal written to the audit trail with actor, intent, target, outcome | Passed (unaided) | — |

**Row 12 is the model case for how this table feeds US4**: `prompted`, not `failed`; the
jargon complaint becomes an `Observation` with severity `significant`; the fix is a wording
change under NFR-2 — and because "peripheral" is category vocabulary, the fix may land in
`backend/src/services/llm/prompts/classification.ts`, which triggers the Principle VIII
regression gate.

**Row 15 is the model case for a safety scenario**: the refusal is the *correct* outcome and
is recorded `Passed`. It is not a defect (spec Edge Case 5, Principle II).

---

## Validation rules

- **C1** `Passed/Failed` is exactly one of the three stated values. There is no "partly" —
  any facilitator input makes the row `Passed (prompted)` (FR-007).
- **C2** A row `Failed (not completed)` MUST have a matching `Observation` in
  `docs/testing/observations.md`, and the session MUST have continued with the remaining
  scenarios (FR-007, spec AS2-3).
- **C3** The **Comment** column is PII-generalised **before** the file is committed. Raw
  comments are never committed and later edited — git history retains them
  (spec Edge Case 8, NFR-5).
- **C4** Every `scenarioId` in **Input** resolves to a row in `docs/testing/uat-scenarios.md`,
  and that file's commit predates the session date (FR-006).
- **C5** SC-003 is computed over this table and **reported as a figure**, not asserted:
  `Passed (unaided)` ÷ all rows ≥ 0.80.
- **C6** A tester request for behaviour never scoped is **not** a `Failed` row. It becomes an
  `Observation` classified `out-of-scope` with a named boundary (FR-016, spec AS2-4).
- **C7** A session interrupted by an unavailable local model is **recorded, not abandoned**:
  the degraded notice and escalation are the designed behaviour and the row is scored on
  whether that behaviour occurred (spec Edge Case 3).
- **C8** A session run without the `rs0` replica set is **halted and restarted**, not scored.
  Rows from such a run are discarded rather than filed as false defects (spec Edge Case 4).
