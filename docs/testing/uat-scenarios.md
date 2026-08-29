# UAT Scenario Script

**Feature**: 006-refining-transition (US2). Written and committed **before** the first
tester session, per FR-006/V2.4 — git history on this file is the evidence that it
pre-dates every `docs/testing/uat-sessions.md` session date. Schema:
`specs/006-refining-transition/data-model.md` §2 (`ScenarioScript`). Derivation rationale:
`specs/006-refining-transition/research.md` Decision 6.

**Do not read the `id`, `targetCategory`, `expectedOutcome`, or `role` columns aloud to a
tester.** Only the `situation` text is read to them, in the facilitator's own words if
useful — it deliberately carries no system vocabulary (no "ticket", "category", "guided
step", "escalate") so the tester's path through the product is unprompted.

**Category naming note**: the six mandated categories are written here using the actual
system category slugs (`password_login`, `network`, `printer`, `peripherals`,
`performance`, `service_status`, confirmed against `backend/src/scripts/seed-guides.ts`
and live classification during T019), not the descriptive names used in
`data-model.md`/`research.md` (`peripheral`, `slow performance`) — those are the same six
categories, just named more casually in the planning docs written before the guides were
seeded.

---

## Coverage matrix

Updated **during** the session set (T033), not only at the end, so a gap can still be
assigned to the next available tester while testers remain reachable (SC-004,
research.md Decision 6). `Exercised by` takes tester pseudonyms as sessions complete;
`Status` flips `☐` → `☑` the first time a scenario is actually run to a scored outcome.

| Category / outcome | Scenario | Exercised by | Status |
|---|---|---|---|
| `password_login` | SC-01 | | ☐ |
| `network` | SC-02 | | ☐ |
| `printer` | SC-03 | | ☐ |
| `peripherals` | SC-04 | | ☐ |
| `performance` | SC-05 | | ☐ |
| `service_status` | SC-06 | | ☐ |
| *(guided resolution, dedicated)* | SC-07 | | ☐ |
| *(escalation, dedicated)* | SC-08 | | ☐ |
| *(staff — ticket takeover)* | SC-09 | | ☐ |
| *(staff — remediation approval)* | SC-10 | | ☐ |
| *(staff — safe refusal)* | SC-11 | | ☐ |
| *(maintainer — category + guide, 007 SC-008)* | SC-12 | | ☐ |
| *(staff — profile correction, 007 SC-008)* | SC-13 | | ☐ |

V2.1 (all six categories) and V2.2 (≥ 1 guided-resolution, ≥ 1 escalation) are each
satisfiable from SC-01…SC-06 alone (all scripted as `guided-resolution`), with SC-07/SC-08
as a deliberate second, independent proof of each outcome under conditions the six
category scenarios don't otherwise exercise. V2.3 (≥ 1 `role = staff`) is satisfied by
SC-09…SC-11.

---

## Employee-role scenarios

| id | situation | targetCategory | expectedOutcome | role |
|---|---|---|---|---|
| SC-01 | You try to sign into your work account first thing in the morning, and it keeps telling you your password is wrong — even though you're sure you're typing the right one. | `password_login` | `guided-resolution` | `employee` |
| SC-02 | Your laptop's Wi-Fi keeps dropping every few minutes while you're trying to get work done. | `network` | `guided-resolution` | `employee` |
| SC-03 | You send a document to the printer on your floor, but nothing comes out and the print job just seems to sit there. | `printer` | `guided-resolution` | `employee` |
| SC-04 | You come back to your desk after lunch and your external monitor just shows "no signal", even though everything looks plugged in. | `peripherals` | `guided-resolution` | `employee` |
| SC-05 | Your laptop has been painfully slow all morning — even opening a simple document takes forever. | `performance` | `guided-resolution` | `employee` |
| SC-06 | You want to find out whether the email system is down for everyone right now, or if it's just something wrong on your end. | `service_status` | `guided-resolution` | `employee` |
| SC-07 | Your computer has been crashing and freezing randomly all week, no matter what you're doing on it. | `performance` | `escalation` | `employee` |
| SC-08 | Something's wrong with your computer today and you're not sure what — it's just not acting right. | `network` | `escalation` | `employee` |

Notes for the facilitator, not for the tester:
- **SC-07** is scripted to genuinely resist the standard fixes — answer each suggested step
  honestly as "still happening" rather than being told in advance to reject every step.
  This is the same organic exhaustion path validated live in
  `docs/testing/quickstart-walkthroughs-003.md` Scenario 2a.
- **SC-08** is deliberately unclassifiable, mirroring the "my thing is broken" example in
  `specs/006-refining-transition/contracts/session-record.md` — expect a clarifying
  question first, escalating only if it stays vague after that. Validated live in
  Scenario 3b of the same walkthrough file.
- Every situation above is phrased as something a genuinely resolvable (or genuinely
  unresolvable) problem, never as an instruction to sabotage the flow — a tester who
  happens to get lucky and resolve SC-07/SC-08 on the real system should have that scored
  as the actual outcome, not forced.

## Staff-side scenarios

| id | situation | targetCategory | expectedOutcome | role |
|---|---|---|---|---|
| SC-09 | A ticket has come in from an employee that isn't assigned to anyone yet. Take ownership of it so it's yours to work. | `staff-workflow` | `staff-takeover` | `staff` |
| SC-10 | One of your open tickets has an automated fix waiting on your sign-off before it runs on the test system. Review what it's proposing to do and approve it. | `staff-workflow` | `remediation-approved` | `staff` |
| SC-11 | Try to approve or run a fix against a machine that was never set up as one of the system's registered test devices — for example, type in a hostname that isn't on the known list. | `staff-workflow` | `safe-refusal` | `staff` |

SC-11 is deliberately attempted against a target outside
`backend/src/policy/test-endpoints.json`'s two registered nodes (`test-node-a`,
`test-node-b`); a refusal is the **correct, passing** outcome (V2.5, spec Edge Case 5,
Principle II) — score it `Passed`, not a defect.

---

## Feature 007 scenarios (SC-008)

Added on 2026-08-29 for feature 007 (`specs/007-admin-console-account-editing`, tasks T055
and T059), before any session had run — `docs/testing/uat-sessions.md` did not yet exist at
the time of this commit, so V2.4 holds for these two exactly as it does for SC-01…SC-11.

**007 SC-008 is a stricter bar than the rest of this script and must be run as written**:
**three** acceptance testers each complete **both** tasks below, **unaided** and **on first
attempt**, without asking what a field means. Demographics are recorded (pseudonyms
allowed). Results go to `docs/testing/feature-007-uat.md`, not to the 006 session log, since
they answer a different feature's success criterion. Facilitator gives no hints; a question
asked is itself the finding and is recorded verbatim.

| id | situation | targetCategory | expectedOutcome | role |
|---|---|---|---|---|
| SC-12 | You look after which kinds of problem this help desk knows how to handle. A new kind has started coming up that isn't on the list yet. Add it, along with the steps someone should try when it happens, and then check that a person reporting that problem actually gets routed to it. | `maintainer-console` | `category-published` | `maintainer` |
| SC-13 | An employee's record has the wrong desk location and the wrong machine listed, and the remote-access ID is out of date. You know the correct details. Put them right on their record so the next person handling their case sees the real ones. | `staff-workflow` | `profile-corrected` | `staff` |

Notes for the facilitator, not for the tester:

- **SC-12** is quickstart Scenario 1 (`specs/007-admin-console-account-editing/quickstart.md`)
  put into a tester's language. The tester is given the `MAINTAINER_KEY` and the console
  address and nothing else — not the request format, and not a terminal. Scored `Passed` when
  they reach a published category that classifies a matching report. **Do not tell them the
  key must be re-entered after a reload**; if they discover it themselves that is the correct
  behaviour (FR-014), and if it confuses them that is a finding worth recording.
- **SC-13** is quickstart Scenario 3. Score it `Passed` when all three fields hold the correct
  values and each names the tester as the person who set it. The tester is **not** told in
  advance that saving takes the field away from the employee — whether they notice, and what
  they expect to happen next, is the interesting part.
- **SC-009 is measured inside SC-13, on a different person.** After the tester finishes,
  show the *account owner's* own `/profile` page to someone who has not seen it before and
  ask them, unaided, why the field cannot be edited and how to get it changed (quickstart
  Scenario 4, step 7). **Record the answer verbatim**, not as a pass/fail — the wording is
  the evidence, and a near-miss answer tells the developer more than a tick does.
- Neither scenario is scored against a clock. 007's SC-001 (under 5 minutes) and SC-003
  (under 60 seconds) are developer walkthrough measurements taken in T049, not tester
  measurements; timing an unaided first attempt would measure the stopwatch rather than the
  interface.

**Note on the R14 evidence review**: `research.md` R14 lists this file as needing its
profile-editing steps revised for staff-authoritative editing. On inspection there were none
to revise — SC-01…SC-11 exercise chat, guided steps, escalation, takeover, approval, and
refusal, and no scenario touched the profile surface at all. The obligation is therefore
discharged by the addition above rather than by an edit, and this note records that the file
was checked rather than skipped.

---

## Validation checklist

- **V2.1** All six mandated categories are `targetCategory` of at least one scenario: ✅
  SC-01…SC-06.
- **V2.2** ≥ 1 `guided-resolution` (✅ SC-01…SC-06, SC-09), ≥ 1 `escalation` (✅ SC-07, SC-08).
- **V2.3** ≥ 1 `role = staff`: ✅ SC-09, SC-10, SC-11.
- **V2.4** This file is committed before any `docs/testing/uat-sessions.md` session date —
  verifiable from git history; no session has run as of this commit.
- **V2.5** SC-11's refusal is scored as a pass, not a defect, when it occurs.

Cardinality: 13 scenarios ≥ 8 required (research.md Decision 6).

**Feature 007 SC-008** (separate criterion, separate record): satisfied only when three
testers have each completed **both** SC-12 and SC-13 unaided on first attempt, with
demographics and the verbatim SC-009 answers written to `docs/testing/feature-007-uat.md`.
It is not satisfied by SC-12 and SC-13 appearing in the coverage matrix above, and it is not
carried by the 006 session count.
