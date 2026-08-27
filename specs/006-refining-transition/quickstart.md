# Quickstart: Validating the Refining & Transition Phase

How to prove this phase is complete. Every scenario is runnable on the demo machine and maps
to success criteria in [spec.md](./spec.md).

This phase's deliverables are documents and evidence, so most validation is a check that a
required artifact exists, is complete, and does not contradict the running system. Two
scenarios (S1, S7) are live runs.

---

## Prerequisites

| Requirement | Check | Why |
|---|---|---|
| Demo machine | HP Victus 16, Windows 11 | NFR-7 — all evidence originates here |
| MongoDB **as `rs0` replica set** | `mongosh --eval "rs.status().ok"` → `1` | Environment contract. A standalone `mongod` fails transactional steps by design (spec Edge Case 4) |
| LM Studio serving `qwen2.5-7b-instruct` | `curl http://127.0.0.1:1234/v1/models` | Reference config; `openai_compat` provider |
| Registered test endpoint reachable | Per `backend/src/policy/` endpoint registry | FR-8 remediation leg; NFR-3 keeps it isolated |
| Backend + frontend installed | `npm --prefix backend ci && npm --prefix frontend ci` | |

```bash
# Baseline gates — must be green before anything below
npm --prefix backend run typecheck && npm --prefix backend run lint && npm --prefix backend test
npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test
```

---

## S1 — The cross-feature journey runs end to end in one continuous run

**Validates**: FR-001, FR-002, SC-008 · **User Story 1**

```bash
npm --prefix backend run demo-path        # script built by this phase (research.md Decision 1)
```

**Expected**: one continuous run, no restart and no hand-edited data between stages, covering
voice-or-text intake → classification → ticket → guided troubleshooting → escalation → staff
takeover → whitelisted remediation against a **registered** test endpoint. A timestamped
PASS/FAIL log lands in `docs/testing/`.

**Pass**: completes on the **first attempt**. If it does not, tester sessions do not begin
(FR-002, spec AS1-3).

> The existing `docs/testing/demo-path-log.md` (2026-07-09, PASS 9/9) does **not** satisfy
> this: it has no voice leg, no remediation leg, and used `mongodb-memory-server` rather than
> `rs0`. Verifying against it instead of a fresh run is the failure mode this scenario exists
> to prevent (`OBS-03`).

**On any failure**: log it in `docs/testing/observations.md` with a severity **before**
attempting a fix (FR-004). The failure stays in the record.

---

## S2 — Every deferred evidence item is closed

**Validates**: FR-003, SC-009 · **User Story 1**

```bash
grep -rn "^- \[ \] T" specs/00{1,2,3,4,5}-*/tasks.md      # expect: no output
```

| Item | Artifact that must exist |
|---|---|
| 001 T049 — 24 h availability probe | `docs/testing/availability-probe-24h.log` |
| 003 T046 — guided-flow chat screenshots | `docs/implementation/screenshots/` (to resolution **and** to escalation) |
| 003 T047 — 5 manual quickstart walkthroughs | Recorded outcomes in `docs/testing/` |
| 005 T119 — remediation screenshots | 8 named screens in `docs/implementation/screenshots/` |

**Pass**: zero unchecked task boxes across all five earlier features, and each artifact
present.

> **Sequencing**: start the 24-hour probe on day one — it is a wall-clock dependency that
> cannot be compressed. Capture screenshots **after** refinement settles, or they will show
> pre-refinement wording and contradict the shipped system (FR-019, FR-020).

---

## S3 — Three or more testers completed the scenario script

**Validates**: FR-005…FR-009, SC-002, SC-003, SC-004 · **User Story 2**

Check `docs/testing/uat-sessions.md` against
[`contracts/session-record.md`](./contracts/session-record.md):

- [ ] ≥ 3 tester profiles, each with pseudonym, role type, support familiarity, consent
- [ ] ≥ 1 tester with `experienceExercised = staff` (FR-008)
- [ ] Every `UAT-` row has exactly one outcome: unaided / prompted / not completed
- [ ] `docs/testing/uat-scenarios.md` **commit date precedes** the first session date (FR-006)
- [ ] Coverage matrix shows all six mandated categories exercised, plus ≥ 1 guided
      resolution and ≥ 1 escalation (SC-004)
- [ ] No record contains identifying detail beyond the two agreed bands (FR-005, NFR-5)

```bash
# SC-003 — report the figure, do not assert it
# unaided ÷ all attempts, computed over docs/testing/uat-sessions.md, must be ≥ 0.80
```

**Pass**: all boxes ticked and SC-003 ≥ 80%.

> Fewer than three testers **cannot** be absorbed: three is a floor. Escalate to the
> supervisor; the developer is never counted as a tester (spec Edge Case 1).

---

## S4 — Both Objective-4 deliverables exist and are distinct

**Validates**: FR-010…FR-013, SC-001, SC-005, SC-011 · **User Story 3**

Two separate files. Neither may cite the other as fulfilling its purpose (FR-013).

**`docs/testing/requirements-traceability.md`** — per
[`contracts/traceability-verdict.md`](./contracts/traceability-verdict.md):

- [ ] Exactly 16 verdict rows (FR-1…FR-9, NFR-1…NFR-7), **zero blanks** (SC-001)
- [ ] Every row ≥ 1 named, resolvable evidence reference — never "tested" or "see tests"
- [ ] Every non-`Satisfied` row states its shortfall reason openly (FR-011)
- [ ] All four objectives O-1…O-4 carry a coverage statement (SC-011)
- [ ] The "TC identifiers cover 001–003 only" caveat is closed or restated as an explained limit

**`docs/testing/usefulness-evaluation.md`** — per
[`contracts/usefulness-instrument.md`](./contracts/usefulness-instrument.md):

- [ ] Original survey structure extracted from the IR **before** administering (blocking prerequisite)
- [ ] Aggregate **and** spread **and** participant count all reported (SC-005)
- [ ] Q3 and Q6 reported individually, not only inside a rolled-up mean
- [ ] Sample-size limit stated explicitly; no inferential claim at N ≈ 3–5

**Pass**: both files complete, both standing alone.

---

## S5 — Every observation carries a disposition

**Validates**: FR-014…FR-016, SC-006, SC-007 · **User Story 4**

Check `docs/testing/observations.md`:

- [ ] Every row has a severity (`blocking` / `significant` / `minor`) — no blanks (FR-014)
- [ ] Every row has a disposition (`fix` / `defer` / `decline`) — none untriaged (SC-007)
- [ ] Every `defer` or `decline` states its reason (FR-014)
- [ ] Every `blocking` item is fixed, or explicitly accepted with written justification —
      **none silently open** (FR-015, SC-006)
- [ ] Every `out-of-scope` decline names one of the five boundaries (FR-016)
- [ ] `OBS-01`…`OBS-05` (found during planning) each carry a disposition

**Pass**: no row missing severity, disposition, or — where required — a reason.

---

## S6 — Refinement stayed inside its boundaries

**Validates**: FR-016, FR-017 · **User Story 4**

```bash
git diff --stat <phase-start>..HEAD
```

- [ ] No new route, screen, or navigation entry (a new screen is a new functional requirement)
- [ ] No change under `backend/src/policy/` (safety controls untouched)
- [ ] No third account role; registration still hardcodes `user`; no HTTP promotion path
- [ ] No endpoint registry entry beyond registered test endpoints
- [ ] No restyle: no palette, type-scale, spacing, or component-shape change (plan.md Design Direction)

**Principle VIII gate — applies if any file under `backend/src/services/llm/prompts/` changed:**

```bash
npm --prefix backend test -- classification    # classification regression set
npm --prefix backend test -- escalation        # guardrail / escalation behaviour
```

A tester-driven wording fix can legitimately land in a prompt module — the agent's
plain-language tone (NFR-2) is produced there, not in UI strings. That makes it a **prompt
change**, and a prompt regression is a real regression. These suites pass before it merges.

**Shared-component gate** — if any of these changed, re-validate against the **full**
scenario set, not only the report that prompted the change (spec Edge Case 6):

| Changed | Also verify |
|---|---|
| `ActionRecordCard` | ChatPage, staff AuditTrail, TicketTimeline |
| `AppNav` / `RouteGuards` | Every authenticated route, both roles |
| `StatusBadge` | `TicketCard` **and** `MyTicketsPage` (duplicated status wording, `OBS-02`) |

---

## S7 — The verified journey still passes with refinements in place

**Validates**: FR-017, SC-008, spec AS4-5 · **User Story 4**

```bash
npm --prefix backend run typecheck && npm --prefix backend run lint && npm --prefix backend test
npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test
npm --prefix backend run demo-path
```

**Pass**: all suites green **and** the demo path completes on the first attempt — the second
of the two runs FR-002 requires. This is the re-run of S1 with refinements applied.

---

## S8 — Each role has guidance that matches the running system

**Validates**: FR-018, FR-019, SC-010 · **User Story 5**

Three documents in `docs/`: employee, IT staff, maintainer.

- [ ] Each covers the actions available to that role, in plain jargon-free language (NFR-2)
- [ ] The maintainer document describes the `MAINTAINER_KEY` header surface **without**
      describing it as a third role — it is not an account (Principle III, locked model)
- [ ] Walked screen by screen against the running system: **no instruction describes a
      screen, action, or option that does not exist** (FR-019)
- [ ] ≥ 1 unfamiliar person per role covered completed that role's primary task using only
      the written material (SC-010)

**Pass**: all three exist, verified against the running system, with a person-check per role.

> Do this **last**. `AppNav` renders on every authenticated route and `MyTicketsPage`
> duplicates status wording — a late label change silently invalidates guidance already
> written (research.md Decision 9).

---

## S9 — Phase closure

**Validates**: FR-020, FR-021, SC-011, SC-012

- [ ] `docs/handoff.md` current — currently stale (2026-08-19, says four features; 005
      shipped 2026-08-21), `OBS-04`
- [ ] `docs/testing/demo-path-log.md` superseded, with a dated note retaining the old entry
- [ ] `README.md` status prose re-verified against delivered state
- [ ] Root artifact `No` (0 bytes) removed, `OBS-05`
- [ ] `frontend/src/components/SessionForm.tsx` dispositioned — dead code with a green test
      suite, `OBS-01`
- [ ] Compliance Debt Register re-verified **empty** (FR-021)
- [ ] O-1…O-4 each carry a recorded coverage statement — objectives reviewed, not only the
      requirement list (FR-021, SC-011)
- [ ] No repository document contradicts the delivered state (FR-020, SC-012)

**Pass**: every box ticked. The repository is the authority — where two artifacts disagree,
the stale document is corrected, not the repository (spec Edge Case 7).

---

## Traceability

| Scenario | Requirements | Success criteria |
|---|---|---|
| S1 | FR-001, FR-002, FR-004 | SC-008 |
| S2 | FR-003 | SC-009 |
| S3 | FR-005…FR-009 | SC-002, SC-003, SC-004 |
| S4 | FR-010…FR-013 | SC-001, SC-005, SC-011 |
| S5 | FR-014, FR-015 | SC-006, SC-007 |
| S6 | FR-016, FR-017 | — |
| S7 | FR-017, FR-002 | SC-008 |
| S8 | FR-018, FR-019 | SC-010 |
| S9 | FR-020, FR-021 | SC-011, SC-012 |

All 21 functional requirements and all 12 success criteria are covered.
