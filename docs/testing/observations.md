# Observations Register

**Purpose**: The single triage register for this phase (data-model.md §4). Every defect,
friction point, and out-of-scope request found during verification (US1), tester sessions
(US2), or planning is filed here as one row and carries through to an explicit disposition
before the phase closes — no row may rest without both a `severity` and a `disposition`
(FR-014, SC-007).

**Source**: `verification` (US1) · `uat-session` (US2) · `planning` (found during
`/speckit-plan`, before any tester ran).

---

## Severity banding

| Severity | Meaning | Consequence |
|---|---|---|
| `blocking` | A core journey cannot be completed | **Gates submission.** Fixed, or explicitly accepted with written justification (FR-015, SC-006). Never left silently open. |
| `significant` | Completed, but with confusion or a wrong-looking result | Triaged on merit |
| `minor` | Cosmetic or wording | May be declined with a reason |

## Named boundaries (`boundaryCrossed`)

Required whenever `classification = out-of-scope` (FR-016). Cites a source rather than an
opinion:

| Value | Source |
|---|---|
| `new-functional-requirement` | FR-016, Principle I |
| `relaxed-safety-control` | FR-016, Principle II |
| `third-account-role` | FR-016, Principle III (locked two-role model) |
| `beyond-registered-endpoints` | FR-016, NFR-3 |
| `admin-console-deferred` | Spec Assumptions |

## Column contract

| Field | Type | Rules |
|---|---|---|
| `id` | string | Required, unique. Format `OBS-01`, … |
| `description` | string | What was noticed. |
| `source` | enum | `verification` \| `uat-session` \| `planning`. |
| `sourceRef` | string \| — | e.g. `UAT-014`, or the demo-path run date. |
| `severity` | enum | `blocking` \| `significant` \| `minor`. Required. |
| `classification` | enum | `defect` \| `out-of-scope`. |
| `disposition` | enum | `fix` \| `defer` \| `decline`. Required. |
| `reason` | string | Required when `disposition` is `defer` or `decline`. |
| `boundaryCrossed` | enum \| — | Required when declined for scope. One of the five above. |

---

## Register

| id | description | source | sourceRef | severity | classification | disposition | reason | boundaryCrossed |
|---|---|---|---|---|---|---|---|---|
| OBS-01 | `frontend/src/components/SessionForm.tsx` has a passing test suite and zero production consumers — dead code (Principle VI) with green coverage over unshipped code | planning | plan.md § Complexity Tracking | minor | defect | _pending_ | | |
| OBS-02 | `MyTicketsPage` renders status inline rather than reusing `TicketCard`/`StatusBadge`; employee-facing status wording can drift between two screens (FR-019 risk) | planning | plan.md § Design Direction | minor | defect | _pending_ | | |
| OBS-03 | `docs/testing/demo-path-log.md` (2026-07-09) records a PASS lacking the voice and remediation legs and using `mongodb-memory-server` rather than `rs0`, while 005 T118 claims a passing run with remediation — artifacts disagree | planning | research.md Decision 1 | significant | defect | _pending_ | | |
| OBS-04 | `docs/handoff.md` (2026-08-19) states four features shipped; 005 shipped 2026-08-21 — stale status record (FR-020) | planning | research.md Decision 10 | minor | defect | _pending_ | | |
| OBS-05 | 0-byte shell-redirection artifacts, same class as those cleared by 001 T051. Raised against root `No` (with `Filled` and `will` named by T077); **all three are now gone from the root, but the accident recurred outside it** — `specs/006-refining-transition/Filled` (0 bytes, untracked) existed on 2026-08-28, so a root-only sweep passes while the artifact survives. Removed by T089; T077's sweep must cover the whole tree, not just the root | planning | research.md Decision 10 | minor | defect | fix | Removed 2026-08-28 (T089); the sweep is widened beyond the repository root so this class of accident cannot hide one directory down. The widened sweep immediately found two more at the root that the original three-name list missed — `Promise` and `requirements-gathering`, both 0 bytes and untracked — removed in the same pass | |
| OBS-06 | `demo-path.ts`'s `isMainModule` guard compared `import.meta.url` against a hand-built `file://${argv[1]}` string; on Windows this never equals the real (drive-lettered, triple-slash) URL, so `main()` was never invoked — the very first invocation exited instantly with no output and no log at all | verification | first `npm run demo-path` invocation, 2026-08-26T19:47Z (no log file produced) | blocking | defect | fix | Rewrote the guard with `pathToFileURL(process.argv[1]).href`, the portable comparison | |
| OBS-07 | `GET /api/tickets` is scoped by `reporterId` and sorted newest-first, but `demo-path.ts` reuses the same employee/staff accounts across re-runs; `waitFor(() => listTickets(...)[0])` is unconditionally truthy the moment that reporter has *any* prior ticket, so on a second-or-later run it resolved to a stale ticket from an earlier run before the new one was even created — a race, not a wait | verification | `docs/testing/demo-path-runs/2026-08-26T19-53-31-203Z.md` and `...19-57-11-736Z.md` | blocking | defect | fix | Added `snapshotTicketReferences`/`waitForNewTicket`, which wait for a reference absent from a pre-report snapshot instead of trusting index `[0]` | |
| OBS-08 | The intake/escalation legs post the same fixed report text on every run; once an earlier run leaves a same-description ticket open, the product's legitimate duplicate-ticket check (conversation-engine.ts) asks a clarifying question the script never answered, so no new ticket is ever filed and the run times out | verification | `docs/testing/demo-path-runs/2026-08-26T19-57-11-736Z.md` | blocking | defect | fix | Added `postReportAndClearDuplicateCheck`, which reads the agent's actual SSE reply and answers the duplicate check (without matching `DUPLICATE_SAME_PATTERN`) only when it was actually asked | |
| OBS-09 | `test-endpoints/node-b/scripts/print-queue-status.sh` only emitted `queue_empty=true` when `lpstat -o test-printer` *errored*; the ordinary well-behaved case (exit 0, zero job lines) left it silent, so the policy engine's verification judgement always read a successful clear as `contradicted` — leg 7 (whitelisted remediation) could never pass | verification | `docs/testing/demo-path-runs/2026-08-26T20-06-50-650Z.md`; confirmed live via direct SSH (`lpstat -o test-printer` exits 0 with empty output) | blocking | defect | fix | Script now checks the captured output instead of the exit code; redeployed via `test-endpoints/reset.ps1` (`docker compose up -d --build`), verified live | |
| OBS-10 | `capture-host-keys.mjs`'s bare `ssh-keyscan` PATH lookup resolves Windows' bundled (older) `System32\OpenSSH\ssh-keyscan.exe` when run from `reset.ps1`'s PowerShell context; that build rejects the container sshd's default post-quantum KEX (`sntrup761x25519-sha512@openssh.com`), so the documented reset procedure fails at the fingerprint-capture step even though the containers themselves start fine | verification | `backend/test-endpoints/reset.ps1` run, 2026-08-26 | significant | defect | fix | Try Git for Windows' `ssh-keyscan.exe` (confirmed working against the live containers) before falling back to bare PATH resolution | |
| OBS-11 | The consent block interpolates the whitelisted action's **internal** description into a noun-phrase slot in employee-facing copy, so it reads ungrammatically and leaks verification internals: "I can run "Clears the test endpoint's print queue. Verified by print_queue_status." against Test Node B…" and then "That needs IT staff sign-off first: Clears the test endpoint's print queue. Verified by print_queue_status.. I'll let you know…" (note the doubled full stop). The staff approval queue renders the same action correctly as "Clears the endpoint's print queue.", so a short user-facing description already exists — the chat path is reading the wrong field (FR-019) | verification | `docs/testing/demo-path-runs/2026-08-27T07-11-06Z-manual.md`, leg 5 | minor | defect | fix | Fixed in two passes, recorded here rather than silently. Pass 1 (commit `aa6a255`) changed **only** the opening offer text to `entry.description`, leaving `tool.description` stored on `pendingActionProposal` and republished through the `action_proposed` SSE payload, the sign-off notice, and every outcome report — so the leak and the doubled full stop both survived, while this row still read `_pending_`. Pass 2 (T085) stores and publishes the user-facing description at source and routes every mid-sentence use through `asClause()`; covered by `tests/unit/disclosure.test.ts` and a copy assertion in `tests/integration/remediation-state-changing.test.ts` | |
| OBS-12 | After consent is given and the action moves to `pending_approval`, the reporter's chat renders the "Waiting on IT staff to approve" system message **twice** — two identical sibling bubbles in the same container — so the employee sees the same status announced two times in a row | verification | `docs/testing/demo-path-runs/2026-08-27T07-11-06Z-manual.md`, leg 5 | significant | defect | _pending_ | | |
| OBS-13 | `guidance-service.ts`'s `decideStepTransition()` returned `{ action: "resolve" }` for the "worked" outcome with no `attemptOutcome`, and `conversation-guidance.ts`'s `case "resolve"` never called `recordAttempt` — so the step that actually resolved the ticket was silently absent from `guidance.stepAttempts`, contradicting FR-005 ("record...the user's reported outcome for each") and the 003 quickstart's own Scenario 1 step 5 expectation | verification | `docs/testing/quickstart-walkthroughs-003.md` Scenario 1; `specs/003-guided-troubleshooting/spec.md` FR-005 | significant | defect | fix | Added `attemptOutcome: "worked"` to the `resolve` branch of `StepDecision` and a `recordAttempt(session, decision.attemptOutcome)` call before `endSession` in `conversation-guidance.ts`, mirroring `advance`/`escalate`; updated `guidance-service.test.ts` and `guided-session-resume.test.ts` (GR-001, which had been asserting the missing entry as correct) to expect the now-complete two-entry record | |
| OBS-14 | `conversation-engine.ts` processed each conversation's incoming replies fire-and-forget (`void processReply(...)`, no `await`, HTTP 202 returned immediately) with no per-conversation serialization; two rapid-fire reports against the same conversation raced, and the agent's replies quoted ticket references (HD-0060, HD-0061) that never actually persisted — a direct `GET /api/tickets/<reference>` on either 404'd | verification | `docs/testing/quickstart-walkthroughs-003.md` Scenario 3, rapid-fire all-categories leg | blocking | defect | fix | Added a `conversationQueues` `Map<string, Promise<void>>` and `enqueueReply()` in `conversation-engine.ts` to serialize replies per conversation via promise chaining; verified clean `tsc`/`eslint` and a full backend suite run (426/427 passing, sole failure a pre-existing opt-in real-LLM classification benchmark unrelated to this change) | |
| OBS-15 | `enqueueReply`'s cleanup could never fire: the map slot was set to `next.finally(cb)` while `cb` compared `conversationQueues.get(key)` against `next` — two different promises, so the identity check was always false and the entry was never deleted. The map grew one permanent entry per conversation for the process lifetime, defeating the cleanup its own comment describes | verification | T083 extraction; caught by the new `tests/unit/reply-queue.test.ts` slot-release case | minor | defect | fix | Named the chained promise `slot` and compared against that, so the cleanup removes the entry it actually stored | |
| OBS-16 | `backend/scripts/availability-probe.ts` called `main()` unconditionally at module load with no main-module guard — the same class as `OBS-06`, latent until T086 exported functions from it for testing. Importing the module started a live probe run and wrote `docs/testing/availability-probe-log.md` as a side effect of running the unit test | verification | T086; observed when `tests/unit/availability-probe.test.ts` created the stray log file | significant | defect | fix | Added the `pathToFileURL(process.argv[1]).href` guard `demo-path.ts` already uses; stray file deleted, and the test re-run confirms it is no longer recreated | |
| OBS-17 | `approval-service.ts`'s `chatReportForApproval()` embeds the policy entry description inside a parenthetical the same way `consent-service.ts` did — "approved and ran that action (Clears the endpoint's print queue.), and it completed successfully." — so the doubled-punctuation half of `OBS-11` still reaches the reporter down the staff-approval path. Left unfixed deliberately: T085's scope is the consent path, and silently widening it is the drift FR-016 guards against | verification | code read during T085, `backend/src/services/remediation/approval-service.ts` `chatReportForApproval` | minor | defect | _pending_ | | |
| OBS-18 | `frontend/src/pages/ChatPage.tsx` gained a React StrictMode guard against a duplicate `POST /api/sessions` in commit `83320f9`, but no observation row recorded that defect — FR-004 requires a failure found during verification to carry a severity in the record *before* a fix is attempted, and this one was fixed without ever appearing here. Logged retrospectively by T087, with the omission stated rather than backdated | verification | commit `83320f9`, `frontend/src/pages/ChatPage.tsx` (`sessionStartedForAccountRef`) | minor | defect | fix | Already fixed in `83320f9`; the gap was in the record, not the code. Recorded here so the register matches the repository (FR-020) | |

`OBS-01`…`OBS-04` are pre-seeded from planning (data-model.md §4) and still await disposition
in Phase 6 (T054, T055 and the triage tasks T052/T053); `OBS-05` was dispositioned early by
T089 because the artifact recurred. Rows from verification (US1) and tester sessions (US2) are
appended below as they are found, in the order discovered, each carrying its severity
**before** any fix is attempted (V4.4, FR-004).

`OBS-12` and `OBS-17` are the two rows still open from verification, both awaiting Phase 6
triage. Every other row carries a disposition.

<!-- Append new rows above this line, continuing the OBS-NN sequence. -->
