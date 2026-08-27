# Phase 0 Research: Refining & Transition Phase

Resolves every unknown the Technical Context raised. Each decision states what was chosen,
why, and what was rejected. Findings are drawn from the repository as it stands on
2026-08-27, not from assumption.

---

## Decision 1 — Make the release-gated demo path a repeatable artifact before anything else

**Decision**: Before any tester is scheduled, convert the release-gated demo path from a
hand-driven `curl` sequence into a single re-runnable script (`backend/scripts/demo-path.ts`,
alongside the existing `availability-probe.ts`), covering all legs in one continuous run:
voice or text intake → classification → ticket → guided troubleshooting → escalation →
staff takeover → whitelisted remediation against a registered test endpoint. It writes a
timestamped PASS/FAIL log into `docs/testing/` on each run.

**Rationale**: This is the phase's critical path and its largest risk, and the evidence for
it is currently inconsistent:

- `docs/testing/demo-path-log.md` records **PASS 9/9 on 2026-07-09**, but that run
  (a) predates feature 005 entirely, so it has **no remediation leg**; (b) has **no voice
  leg**, though FR-001 names voice-or-text intake; and (c) used **`mongodb-memory-server`**,
  not the documented `rs0` replica set the environment contract requires.
- `specs/005-constrained-remediation/tasks.md` T118 is marked `[X]` — "demo path passes …
  with the remediation leg included" — but `demo-path-log.md` was never updated to record
  it. The task record and the evidence artifact therefore **disagree**, which is precisely
  the FR-020 staleness the spec anticipates.

FR-002 and SC-008 require this path to pass **on the first attempt, twice** (before the
first tester session and after the final refinement). A path that is reassembled by hand
each time cannot honestly claim "first attempt", and each manual reassembly is a chance to
silently drop a leg — which is how the current log lost two of them.

**Alternatives considered**:
- *Keep it manual and just re-log it.* Rejected: it is the demonstrated failure mode. Two
  legs already went missing from the record without anyone noticing for six weeks.
- *Rely on the integration suites instead.* Rejected: the suites run against the test
  harness with mocked or in-memory infrastructure. Principle IV gates on the path passing
  **on the demo machine** with the real stack — that is a different claim, and the one the
  viva demo depends on.
- *Write it after UAT.* Rejected: FR-002 requires it to pass **before** the first session.

**Consequence**: This becomes the first task block of the phase. `docs/testing/demo-path-log.md`
is superseded by the script's generated log; the old entry is retained with a dated note
rather than deleted (the project's own "keep the breach visible and dated" convention).

---

## Decision 2 — Scope of "every committed requirement" for the traceability assessment

**Decision**: The traceability assessment's verdict spine is the **16 IR-level requirements**
reproduced in the constitution — FR-1…FR-9 and NFR-1…NFR-7 — each receiving exactly one
verdict (satisfied / partially satisfied / not satisfied) plus at least one named evidence
reference. The per-feature `FR-xxx` identifiers from specs 001–005 appear as **supporting
evidence rows beneath their IR parent**, not as separate verdicts. Objectives O-1…O-4 receive
**coverage statements** in the same document, which SC-011 requires separately from the
requirement list.

**Rationale**: O-4 is worded as evaluation "against the gathered user requirements" — the IR
survey-derived set, not the internal spec decomposition. The existing
`docs/testing/requirements-traceability.md` already maps exactly this set and states its
own two limits up front. Treating every per-feature FR as a top-level verdict would produce
roughly 120 rows, most restating the same IR obligation, and would bury the shortfalls that
FR-011 exists to surface.

**Alternatives considered**:
- *Verdict every per-feature FR.* Rejected: volume without signal, and it is not what O-4
  asks. Kept as evidence rows so nothing is lost.
- *Start a fresh matrix.* Rejected: the spec's Assumptions require extending existing
  records. The existing matrix is extended and its two stated limits are resolved or
  restated honestly.

**Consequence**: `docs/testing/requirements-traceability.md` is **updated in place**, not
replaced. Its current caveat that "TC identifiers cover features 001–003 only" must either
be closed (by adding `TC-` prefixes to the 004/005 suites) or restated as an accepted,
explained limit — it may not be left as an unexplained gap under FR-010.

---

## Decision 3 — The perceived-usefulness instrument

**Decision**: A short 5-point Likert questionnaire, administered to the acceptance testers
after their session, mirroring the structure of the IR's requirements-gathering survey.
Reported with mean **and** dispersion (spread) **and** participant count, per FR-012.
The instrument itself is committed to the repository as
`specs/006-refining-transition/contracts/usefulness-instrument.md` so the question set is
version-controlled and quotable in the report.

**Open item that must be closed by the developer, not guessed**: the original survey
instrument is **not in the repository** — it exists only inside the IR PDF
(`TAHA_FAHD_AHMED_MOHAMMED_THABIT_MR_TP078281_APU3F2601CS_CS.pdf`, repository root). FR-012
requires the new instrument be "structured comparably" to it, and comparability cannot be
asserted against a document nobody has transcribed. **Task**: extract the original survey's
question structure (scale type, number of points, question stems) from the IR into the
contract file before administering anything.

**Rationale**: Comparability is the entire point of FR-012 — it is what lets the report say
something about the same construct measured before and after. A 5-point Likert scale is the
standard choice and near-certainly what the IR used, but "near-certainly" is not evidence,
and an instrument that turns out to use a different scale than the original makes the
comparison unreportable after the fact, when testers are gone and cannot be re-surveyed.

**Alternatives considered**:
- *Assume 5-point Likert and proceed.* Rejected as the primary path for the reason above,
  though it is the expected outcome of the extraction.
- *Use a validated instrument (TAM / SUS / UMUX-LITE).* Rejected: methodologically stronger
  in isolation, but FR-012 asks for comparability with **this project's own** prior survey,
  which a standard instrument would not provide. Worth one sentence in the report noting the
  trade-off was considered.
- *Survey a wider population.* Permitted by the spec's Assumptions but not planned: with
  3–5 respondents the honest report is descriptive, and inflating N with respondents who
  never used the prototype would misrepresent "perceived usefulness of the prototype".

**Consequence**: With N ≈ 3–5, the report presents descriptive figures (mean, range or
standard deviation, N) and explicitly **declines to claim statistical significance**. Stating
that limit is FR-011-consistent behaviour and is stronger evidence than an unqualified
percentage.

---

## Decision 4 — How UAT session records reach Chapter 5 TC-table format

**Decision**: UAT session records are authored **by hand** in `docs/testing/uat-sessions.md`,
using the same five columns as the generated tables (TC-No / input / expected output /
actual output / Passed-Failed), with UAT rows carrying a distinct `UAT-` prefix. They are
**not** routed through the `tc-tables` generator.

**Rationale**: `backend/scripts/tc-tables.ts` reads `tests/.results/vitest-results.json` and
extracts titles matching `/^(TC-\d+)/` — it is a projection of *automated Vitest results*.
A human session has no Vitest result to project from. Forcing one would mean writing fake
passing tests to carry human observations, which would corrupt the automated evidence with
non-automated claims — a serious integrity problem in the exact artifact markers scrutinise.

FR-009 requires records be "expressible in the project's established test-case table
format". That is satisfied by matching the **format**, and the `UAT-` prefix keeps human and
automated evidence distinguishable at a glance while both remain paste-ready for Chapter 5.

**Alternatives considered**:
- *Extend the generator to merge a hand-written source.* Rejected: added machinery for one
  document, and it blurs the automated/manual boundary the prefix exists to keep sharp.
- *Free-form session notes.* Rejected: FR-009 explicitly requires the table format so the
  chapter is not rewritten later.

---

## Decision 5 — Tester recruitment, consent, and data minimisation

**Decision**: 3–5 testers from the developer's contacts, each recorded under a pseudonym
(`T1`, `T2`, …). Stored demographics are limited to two coarse bands: role type
(technical / non-technical) and familiarity with IT support (none / occasional / frequent).
At least one tester runs the **staff** workspace. Tester comments are reviewed for
identifying detail and generalised **before** the record is filed, not after.

**Rationale**: NFR-5 makes data minimisation a graded requirement, and FR-005 caps stored
detail at agreed bands. Two bands are enough to characterise the sample in the report while
staying well inside the cap. Generalising before filing matters because the spec's own edge
case anticipates workplace-identifying detail in comments — once a raw comment is committed
to git it persists in history even if later edited.

**Alternatives considered**:
- *Record age/occupation/employer for a richer sample description.* Rejected: exceeds the
  agreed bands and buys nothing at N ≈ 4.
- *Redact during write-up.* Rejected: git history retains the original.

**Consequence**: A one-line consent statement (what is recorded, that it is pseudonymous,
that it appears in an academic report) is read to each tester before their session and the
fact of consent is noted in the session record.

---

## Decision 6 — Scenario script derivation and coverage bookkeeping

**Decision**: The scenario script is written **before** the first session
(`docs/testing/uat-scenarios.md`) and derived from the six mandated categories plus the two
mandated flow outcomes. Minimum eight scenarios: one per category (password/login, network,
printer, peripheral, slow performance, service status), one forcing a guided resolution to
completion, one forcing an escalation. Staff-side scenarios (takeover, approving a
remediation) are drawn from the same list for the staff tester. A coverage matrix at the top
of the file tracks category × exercised-by-tester so SC-004 is checkable at a glance rather
than reconstructed at the end.

**Rationale**: FR-006 requires the script to pre-date the sessions and to cover all six
categories, ≥ 1 guided resolution, and ≥ 1 escalation **across the session set** — a
set-level property that is easy to miss until it is too late to fix. A live coverage matrix
turns SC-004 into an observable during the sessions, when a gap can still be filled by
assigning it to the next tester.

**Alternatives considered**:
- *Let testers free-explore.* Rejected: FR-006 requires a written script, and free
  exploration cannot guarantee category coverage.
- *One scenario per tester per category (30 attempts).* Rejected: session fatigue would
  depress the SC-003 unaided-completion figure for reasons unrelated to the system.

---

## Decision 7 — Handling the four deferred evidence items

**Decision**: All four are confirmed still open and are closed within this phase, each
leaving its artifact in `docs/`:

| Item | Owner | State verified 2026-08-27 | Closure |
|---|---|---|---|
| `T049` 24-hour availability probe | 001 | Open. Probe **repaired 2026-08-25** for the auth change feature 005 introduced (it now registers/signs in via `PROBE_EMAIL`/`PROBE_PASSWORD` and re-authenticates on 401); smoke-verified 3/3. | Unattended 24 h run on the demo machine → log to `docs/testing/` |
| `T046` guided-flow chat screenshots | 003 | Open — diagrams and TC tables done, screenshots never captured | Capture to `docs/implementation/screenshots/` |
| `T047` manual quickstart walkthroughs | 003 | Open — automated gates green (166/166 backend, 47/47 frontend), 5 manual walkthroughs never run | Run all five on the demo machine, record outcomes |
| `T119` remediation implementation screenshots | 005 | Open — 8 named screens (consent block, action result, approval queue, approval confirmation, audit view with filters, per-ticket history, kill switch + disabled banner, metrics incl. no-data state) | Capture to `docs/implementation/screenshots/` |

**Rationale**: Principle V permits dated deferral of demo-machine evidence **only** if
tracked and cleared before submission; SC-009 requires zero deferred items at phase end.
The probe repair is the reason T049 must be *run*, not merely re-attempted — before the fix
an unattended run would have silently recorded 0/25 successes and looked like a genuine
availability failure against FR-5.

**Sequencing consequence**: The 24-hour probe is a **wall-clock dependency** with no way to
compress it. It starts on day one of the phase, in parallel with everything else. The
screenshot items (T046, T119) should be captured **after** refinement settles, or they will
show pre-refinement wording and contradict the shipped system under FR-019/FR-020.

---

## Decision 8 — Refinement boundary enforcement

**Decision**: Every observation is triaged in a single register
(`docs/testing/observations.md`) carrying severity (blocking / significant / minor),
classification (defect vs out-of-scope request), disposition (fix / defer / decline), and a
reason. Declines name the specific boundary crossed, citing the requirement or principle.
No item is closed without a disposition.

**Rationale**: FR-014 through FR-016 and SC-006/SC-007 all key off this register, and the
spec names US4 as the phase's main drift risk. One register with mandatory columns makes an
untriaged item structurally visible rather than a matter of memory.

**The named boundaries a decline may cite**:

| Boundary | Source | Typical tester request that crosses it |
|---|---|---|
| New functional requirement | FR-016, Principle I | "Add email/Teams notifications", "let me attach a file" |
| Relaxed safety control | FR-016, Principle II | "Skip the approval step for restarts", "let it fix things without asking" |
| Third account role | FR-016, Principle III | "Add a manager view", "give me admin" |
| Action beyond registered endpoints | FR-016, NFR-3 | "Try it on my actual machine" |
| Admin/maintainer console | Spec Assumptions | "Let me edit the categories in the browser" |

**Alternatives considered**:
- *Triage inline in session records.* Rejected: SC-007 requires proving **every** observation
  has a disposition, which a scattered record cannot demonstrate.
- *Judge scope case by case.* Rejected: the spec deliberately wrote these as requirements
  rather than leaving them to judgement, because late-phase tester enthusiasm is the
  predicted drift source.

---

## Decision 9 — Guidance documents and the drift risk against refinement

**Decision**: Three documents in `docs/` — employee, IT staff, maintainer — written
**after** refinement settles (US5 is correctly P5), then verified screen-by-screen against
the running system before the phase closes.

**Rationale**: FR-019 forbids describing any screen, action, or option that does not exist,
and FR-018 requires plain jargon-free language per NFR-2. Writing before refinement
guarantees rework, as the spec itself observes. The maintainer document covers the
`MAINTAINER_KEY` header surface for category and guide administration — which is **not** a
third role and must not be described as one, per the locked account model.

**Known trap**: the shared-component inventory in `plan.md` shows `AppNav` and `RouteGuards`
render on every authenticated route, and `MyTicketsPage` duplicates status wording that
`StatusBadge` also owns. A late label change in either place silently invalidates guidance
already written. Verification against the running system is therefore the **last** step
before phase closure, not a step taken when the documents are drafted.

---

## Decision 10 — Repository-state closure work

**Decision**: Before the phase closes, bring the stale records current and clear the
hygiene items found during planning:

- `docs/handoff.md` — **stale**, confirmed: dated 2026-08-19 and states "Four features are
  specified", but feature 005 shipped 2026-08-21. Bring current (FR-020).
- `docs/testing/demo-path-log.md` — superseded by Decision 1's generated log; retain with a
  dated note.
- `README.md` — the constitution's own Sync Impact Report already flags its status prose as
  predating the amendment. Re-verify against delivered state.
- Root artifact `No` (0 bytes) — a shell-redirection accident of the same class as the four
  cleared by 001 T051. Remove.
- `frontend/src/components/SessionForm.tsx` — dead code with a green test suite; disposition
  explicitly via the observation register (see `plan.md` Complexity Tracking).

**Rationale**: FR-020 forbids any document describing a delivery state the repository
contradicts, and SC-012 makes that checkable. `handoff.md` is the exact case the spec's
Assumptions predicted. The stray root file and the dead component are small, but Principle VI
bans dead code outright and the repo-hygiene precedent (T051) is already established — and
both are the kind of thing a marker notices.

---

## Resolved unknowns summary

| Technical Context unknown | Resolution |
|---|---|
| How the demo path is executed repeatably | Decision 1 — scripted, all legs, generated log, built first |
| What "every committed requirement" means | Decision 2 — 16 IR-level verdicts + O-1…O-4 coverage statements |
| Perceived-usefulness instrument | Decision 3 — 5-point Likert mirroring the IR survey; **structure to be extracted from the IR PDF first** |
| UAT records vs the TC-table generator | Decision 4 — hand-authored, same columns, `UAT-` prefix |
| Tester count, consent, PII bands | Decision 5 — 3–5 testers, pseudonyms, two coarse bands, generalise before filing |
| Scenario derivation and set-level coverage | Decision 6 — ≥ 8 scenarios, live coverage matrix |
| Deferred evidence closure | Decision 7 — all four confirmed open; probe starts day one, screenshots last |
| Refinement boundary enforcement | Decision 8 — one register, mandatory columns, five named boundaries |
| Guidance timing and verification | Decision 9 — written after refinement, verified against the running system last |
| Stale records and hygiene | Decision 10 — handoff/README/demo log current, stray file and dead code dispositioned |

**No NEEDS CLARIFICATION items remain.** One item requires developer action before it can be
executed rather than decided — extracting the original survey structure from the IR PDF
(Decision 3) — and is carried into `tasks.md` as an explicit prerequisite task, not left as
an open question in the plan.
