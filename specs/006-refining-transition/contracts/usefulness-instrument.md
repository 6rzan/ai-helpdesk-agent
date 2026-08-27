# Contract: Perceived-Usefulness Instrument

**Consumer**: Objective **O-4**, second half — evaluation against perceived usefulness for
reducing repetitive IT support workload (FR-012).

**Output file**: `docs/testing/usefulness-evaluation.md` — a **distinct deliverable** from
`requirements-traceability.md`. FR-013 forbids either standing in for the other.

**Administered**: to each acceptance tester, immediately after their session, once they have
actually used the prototype.

---

## Prerequisite — do this before administering anything

> **The original survey instrument is not in the repository.** It exists only inside the IR
> PDF (`TAHA_FAHD_AHMED_MOHAMMED_THABIT_MR_TP078281_APU3F2601CS_CS.pdf`, repository root).
>
> FR-012 requires this instrument be *"structured comparably to the original
> requirements-gathering survey"*. Comparability cannot be asserted against a document that
> has never been transcribed. **Extract the original's scale type, number of points, and
> question stems from the IR and record them in the "Original survey structure" section
> below, then reconcile the question set against it.**
>
> This is a blocking prerequisite, not a formality: if the original used a different scale
> (7-point, or agreement vs. usefulness phrasing), the comparison becomes unreportable after
> the sessions, when the testers are gone and cannot be re-surveyed.

### Original survey structure (extracted from the IR)

Extracted via `pdftotext -layout` (the Read tool's native PDF-page-image path requires
`pdftoppm`, which is not installed in this environment; `ghostscript`, ImageMagick, and
Python `fitz`/`pdf2image` were also checked and are absent — confirmed by direct probe, not
assumed). §3.3.2/§3.3.4 are prose text and extracted cleanly. Appendix G (Figures 24–30,
source pp. 66–71) is the actual Google Forms screenshot set; only its **captions** appear in
the extracted text (front-matter List-of-Figures, two locations) — the question text inside
those figures is image content and did not extract. The table below states only what the
prose in §3.3.1/§3.3.2/§3.4.1 actually supports; the "Anchors" row is left honestly
unconfirmed rather than guessed.

| Property | Value from IR | IR section |
|---|---|---|
| Scale type | A numeric graded-response scale ("numbered range"), used for exactly **two** items in the whole survey. Everything else in the survey (demographics, frequency-of-problem, preferred help channel, listed troubles/desired features/worries) was single-choice ("circular buttons") or multi-select ("square boxes") fixed-answer, **not** graded. | §3.3.2, para. 1 (p.34, before 3.3.1) and §3.3.2 (p.36) |
| Points | 5 ("A numbered range from one up to five shaped responses twice... Five distinct levels guided those two replies") | §3.3.2, para. 1 |
| Anchors | **Not recoverable from extractable text.** The prose names what the two items measure but never states the label text at either end of the 1–5 range, and that text is not present anywhere else in the extracted document — it exists only inside the Appendix G form screenshots, which are image content. Recorded here as an explicit gap, not inferred. | — (checked §3.3.2, §3.3.4, Appendix G captions; absent from all three) |
| Relevant question stems | The two graded items were: (1) rating the quality/helpfulness of *current* IT assistance; (2) judging whether automated aid might reduce repeated/repetitive tasks. Item (2) is a near-direct match for the FR-012 workload-reduction construct this new instrument targets. | §3.3.2, para. 1 |
| Respondent count | 33 usable responses (against APU's ≥30 floor) | §3.3.1, §3.4.1 |

Structural context (not part of the scale, but relevant to T012's reconciliation): the
original instrument was overwhelmingly pick-one/multi-select across demographics, current-support
experience, and pain points, with the 5-point numeric scale reserved for exactly the two items
above; a separate, undefined "agreement levels" mechanism is mentioned once for the
pain-point-intensity section (§3.3.2, para. 4) without stating its point count, so it is not
counted as a second confirmed scale here.

---

## Question set (reconciled against the original, T012)

5-point numeric scale. **Points confirmed against the original (5 = 5, exact match).**
Anchors: **1 = Strongly disagree, 3 = Neutral, 5 = Strongly agree** — **kept as a deliberate
divergence**, not a confirmed match; see divergence log below. Q1–Q6 map onto the constructs
O-4 names; Q7 is free text.

### Divergences from the original (FR-012, V6.2)

| # | Divergence | Reason |
|---|---|---|
| D1 | The original used its 5-point numeric scale on **2 items** out of the whole survey; everything else was pick-one/multi-select. This instrument applies the 5-point scale to **all 6 core questions** (Q1–Q6) plus both staff questions. | Scope difference, not a methodology drift: the original was a broad exploratory requirements survey where most content was categorical (what problems, how often, which channel) and only two items needed a graded judgment. This instrument is a short post-session evaluation of one prototype against a fixed set of FR-mapped constructs (classification, guidance, escalation, adoption, workload) — each construct needs its own graded reading, so a single omnibus numeric item (mirroring the original's 1-item-per-topic ratio) would not satisfy FR-012's per-construct reporting contract (see Scoring section, U3). Point count (5) is kept identical; only the number of items it is applied to differs. |
| D2 | Anchor **wording** is agreement-style (Strongly disagree → Strongly agree) rather than the original's anchors, which are unconfirmed but were most plausibly quality/likelihood-style given their stems ("rating existing help quality", "judging if automated aid might lower repeated tasks") — closer to Poor→Excellent or Not at all→Definitely than to agreement. | The original's actual anchor text could not be recovered (see "Anchors" row above — image-only Appendix, no rasterization tool available in this environment). Q1, Q2, Q4, S1, S2 are phrased as first-person claims about the tool ("The assistant understood...", "I had enough oversight...") that read naturally as agreement statements and do not fit a quality/likelihood anchor without rephrasing every stem. Rather than force a match to an unconfirmed anchor, the divergence is disclosed here per V6.2 and the point scale (the one property that *is* confirmed) is kept exact. |
| D3 | Q6 stem ("A tool like this would reduce repetitive work for IT support staff") is kept close to, but not verbatim, the original's second graded item ("judging if automated aid might lower repeated tasks") — this is the one point of direct continuity with the original instrument. | Deliberate: Q6 is the literal FR-012 construct, so of the 8 questions in this instrument it is the one where wording continuity with the original matters most for the "structured comparably" requirement. Not made verbatim because the original's stem was itself paraphrased in the IR's prose (not machine-extractable as a literal form label) and full audience/context (staff vs. general respondent) differs. |

| id | Question | Construct |
|---|---|---|
| Q1 | The assistant understood what my problem was. | Classification (FR-3) |
| Q2 | The steps it gave me were clear and in a sensible order. | Guidance quality (FR-4, NFR-2) |
| Q3 | I could have solved this myself with the assistant, without contacting IT staff. | **Workload reduction — the core O-4 construct** |
| Q4 | When it could not help, handing over to a person felt right rather than like a dead end. | Escalation (FR-7, NFR-6) |
| Q5 | I would use this instead of raising a ticket the usual way. | Adoption intent |
| Q6 | A tool like this would reduce repetitive work for IT support staff. | **Perceived workload reduction — the literal FR-012 wording** |
| Q7 | *(Free text)* Anything that would stop you using it? | Qualitative |

**Staff testers** additionally answer:

| id | Question | Construct |
|---|---|---|
| S1 | The dashboard showed me what I needed to take over a ticket. | FR-9 |
| S2 | I had enough oversight of what the assistant had already done. | NFR-4, Principle III |

---

## Scoring and reporting contract

All three parts are required by FR-012 and SC-005 — a mean alone does not satisfy either:

| Output | Rule |
|---|---|
| **Aggregate** | Mean per question, and an overall mean across Q1–Q6. |
| **Spread** | Range **and** standard deviation per question. Required. |
| **Participant count** | Stated explicitly, as a number, next to every aggregate figure. |

### Reporting rules

- **U1** With N ≈ 3–5, report **descriptive figures only** and state explicitly that the
  sample does not support statistical inference. Stating the limit is FR-011-consistent
  behaviour and is stronger evidence than an unqualified percentage.
- **U2** Never report a percentage that implies a larger sample ("80% agreed") without the
  raw count beside it ("4 of 5"). At this N the raw count is the honest form.
- **U3** Q3 and Q6 are the two questions that speak directly to the O-4 construct. Report
  them individually, not only inside a rolled-up mean.
- **U4** Free-text answers are PII-generalised before filing (NFR-5, spec Edge Case 8).
- **U5** Responses are keyed to tester pseudonyms, never names.
- **U6** If a tester's session hit a degraded local model (spec Edge Case 3), note it beside
  their response — it plausibly depresses Q1/Q2 for reasons unrelated to design, and the
  reader needs that context to read the figure correctly.
- **U7** Note in the report that a validated instrument (TAM / SUS / UMUX-LITE) was
  considered and rejected in favour of comparability with the project's own prior survey
  (research.md Decision 3). One sentence — it shows the choice was made, not defaulted into.

---

## Consent line

Read to each participant before administering (research.md Decision 5):

> "Your answers are recorded under a pseudonym, not your name. What is stored is your role
> type, how familiar you are with IT support, your ratings, and any comment you make. It
> will appear in an academic report. You can stop at any point."

Consent is noted in the tester roster (`consentRecorded`), not as a signed artifact —
consistent with data minimisation under NFR-5.
