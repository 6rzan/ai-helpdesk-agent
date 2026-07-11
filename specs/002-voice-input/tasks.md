# Tasks: Voice Input

**Input**: Design documents from `/specs/002-voice-input/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transcription-api.md, quickstart.md

**Tests**: REQUIRED for every feature (Constitution Principle IV). No safety-critical
components (whitelist/executor/escalation) are touched, so TDD ordering is not mandated,
but every story ships its automated tests and test names map to Chapter 5 TC tables.
No prompt modules change in this feature, so no classification/guardrail regression
refresh is triggered (Principle VIII).

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, configuration, and model plumbing for the STT stack

- [ ] T001 Add backend dependencies `sherpa-onnx-node` and `multer` (+ `@types/multer`) to backend/package.json, install, and verify the prebuilt win-x64 native addon loads under `tsc --noEmit` and a trivial import smoke test
- [ ] T002 [P] Add frontend dependency `@phosphor-icons/react` to frontend/package.json (icons: Microphone, Stop, X — one family, `weight="regular"`)
- [ ] T003 Extend backend config schema in backend/src/config/index.ts with `STT_PROVIDERS` (csv, default `local`), `STT_MODEL_DIR` (default `./models/stt`), `STT_OPENAI_BASE_URL`, `STT_OPENAI_API_KEY`, `VOICE_MAX_SECONDS` (default 120); document all keys plus the pinned Parakeet TDT 0.6B v2 int8 download URL in backend/.env.example
- [ ] T004 [P] Add `backend/models/stt/` to .gitignore and download/extract the sherpa-onnx Parakeet TDT 0.6B v2 int8 bundle into backend/models/stt/ (manual step; verify files present)

**Checkpoint**: `npm install` clean in both packages; typecheck green; model files on disk

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Message `inputOrigin` extension — shared by all three stories and
touching shared files (types, model, message route), so it lands before any story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Extend the message subdocument schema with `inputOrigin` (`enum: ['typed','voice','mixed']`, `default: 'typed'`) in backend/src/models/conversation.ts
- [ ] T006 Accept optional `inputOrigin` in the send-message zod schema, pass it through the service, and include it in all Message DTOs in backend/src/api/routes/conversations.ts and backend/src/services/conversation/conversation-service.ts (processing stays origin-blind — no branching on it)
- [ ] T007 [P] Add `InputOrigin` type and `Message.inputOrigin` field in frontend/src/lib/types.ts; confirm MessageBubble/TicketCard consumers still compile unchanged
- [ ] T008 Integration tests: `inputOrigin` accepted (all three values), defaulted to `typed` when omitted, rejected on invalid value, returned in DTOs — in backend/tests/integration/messages-origin.test.ts (TC-naming per Principle IV)

**Checkpoint**: Foundation ready — existing 001 suite still green; user stories can begin

---

## Phase 3: User Story 1 - Report an IT issue by speaking (Priority: P1) 🎯 MVP

**Goal**: Press mic → speak → stop → transcript appears in the composer draft → send →
identical downstream behaviour to typing (classification, ticket, confirmation)

**Independent Test**: Quickstart scenarios 1–3 — speak prepared reports covering all six
categories; each produces a reviewable transcript and, once sent, the same
classification/ticket/confirmation as its typed equivalent

### Tests for User Story 1 (REQUIRED - Constitution Principle IV) ⚠️

- [ ] T009 [P] [US1] Unit tests for `SttService`: ordered provider chain, first-success wins, latency/provider fields, no audio bytes in log payloads — in backend/tests/unit/stt-service.test.ts (stub providers)
- [ ] T010 [P] [US1] Integration tests for `POST /api/sessions/:sessionId/transcriptions` with a stubbed local provider: 200 happy path (`transcript`, `durationSeconds`, `provider`), 400 INVALID_AUDIO (missing part / not PCM16-mono-16kHz), 404 SESSION_NOT_FOUND, 413 AUDIO_TOO_LARGE, 409 TRANSCRIPTION_IN_PROGRESS — in backend/tests/integration/transcription.test.ts
- [ ] T011 [P] [US1] Component tests for VoiceControl state machine: idle → recording (indicator + timer visible, stop/cancel present) → transcribing → transcript appended callback; mocked MediaRecorder/getUserMedia and mocked api — in frontend/tests/components/VoiceControl.test.tsx

### Implementation for User Story 1

- [ ] T012 [P] [US1] Define `SttProvider` interface, `TranscriptionResult`, and provider-error types in backend/src/services/stt/types.ts
- [ ] T013 [US1] Implement the reference local provider: Parakeet TDT 0.6B v2 int8 via sherpa-onnx-node, lazy one-time model load from `STT_MODEL_DIR`, accepts 16 kHz mono PCM16 WAV buffers — in backend/src/services/stt/providers/sherpa-local.ts (depends on T012)
- [ ] T014 [P] [US1] Implement the alternate provider: multipart POST to `{STT_OPENAI_BASE_URL}/v1/audio/transcriptions` with optional bearer key, timeout, plain-language error mapping — in backend/src/services/stt/providers/openai-compat.ts (depends on T012)
- [ ] T015 [US1] Implement `SttService`: build ordered chain from `STT_PROVIDERS`, try in order, structured logs (sizes/durations/provider/latency only), visible-degradation error when chain exhausted — in backend/src/services/stt/stt-service.ts (depends on T013, T014)
- [ ] T016 [US1] Implement the transcription route per contracts/transcription-api.md: `multer.memoryStorage()` with 16 MB cap, WAV header validation (PCM16/mono/16kHz), session existence check, per-session in-flight guard (409), duration cap (413), error-code mapping — in backend/src/api/routes/transcriptions.ts, mounted in backend/src/app.ts (depends on T015)
- [ ] T017 [P] [US1] Implement capture pipeline in frontend/src/lib/audio.ts: feature detect, `getUserMedia` on explicit press, MediaRecorder capture, `decodeAudioData` → `OfflineAudioContext` downmix/resample to 16 kHz mono → WAV PCM16 Blob
- [ ] T018 [P] [US1] Add `transcribe(sessionId, wavBlob)` to frontend/src/services/api.ts returning the contract result and typed errors
- [ ] T019 [US1] Build VoiceControl per plan.md Design Direction: mic icon-button (idle), recording bar (pulsing red-600 dot, "Recording" label, `tabular-nums` elapsed/limit timer, Stop primary + Cancel), inline transcribing state ("Turning your speech into text…"), `aria-label`s, `aria-live` timer warnings, `prefers-reduced-motion` static-dot fallback, 150–250 ms state transitions — in frontend/src/components/VoiceControl.tsx (depends on T017, T018)
- [ ] T020 [US1] Integrate into the composer in frontend/src/pages/ChatPage.tsx: mount VoiceControl right of the textarea (never in SessionForm — identification stays typed-only), append transcript to the existing draft, enforce `VITE_VOICE_MAX_SECONDS` cap with T-15 s warning and auto-stop offering the partial transcript, send messages with `inputOrigin: 'voice'` when the draft is transcript-only (depends on T019)

**Checkpoint**: Full voice report→ticket journey works on the demo machine (quickstart
scenarios 1–3); typed path untouched

---

## Phase 4: User Story 2 - Review, correct, or discard the transcript (Priority: P2)

**Goal**: Nothing is ever sent without confirmation: the transcript is editable in the
draft, discardable, and the message records an accurate typed/voice/mixed origin

**Independent Test**: Quickstart scenarios 4–6 and 12 — edit a misheard word and verify
the agent receives only the corrected text; discard and verify nothing was sent and no
ticket exists; mix typed text with a transcript and verify origin `mixed`

### Tests for User Story 2 (REQUIRED - Constitution Principle IV) ⚠️

- [ ] T021 [P] [US2] Component tests for draft behaviour: edited transcript sends edited text only; clearing the draft discards with no send; no auto-send on idle; origin derivation matrix (typed-only → `typed`; transcript-only incl. edits → `voice`; typed+transcript either order → `mixed`; mixed is sticky until clear/send; second recording appends) — in frontend/tests/pages/ChatPage.test.tsx
- [ ] T022 [P] [US2] Extend backend/tests/integration/messages-origin.test.ts: messages posted with `voice` and `mixed` origins persist and return correctly and produce no processing difference (same classification path as typed)

### Implementation for User Story 2

- [ ] T023 [US2] Implement draft origin tracking in frontend/src/pages/ChatPage.tsx: `hasTypedContent`/`hasTranscriptContent` flags per data-model.md rules (review edits do not flip a transcript-only draft to mixed; clear/send resets), origin passed to `sendMessage`
- [ ] T024 [US2] Implement discard and re-record affordances: clear-draft control discards transcript with no side effects; a new recording appends its transcript to the pending draft (one-at-a-time, single combined review) — in frontend/src/components/VoiceControl.tsx and frontend/src/pages/ChatPage.tsx (depends on T023)

**Checkpoint**: US1 and US2 both pass independently; review-before-send guarantee
demonstrable (FR-004)

---

## Phase 5: User Story 3 - Voice degrades gracefully; typing always works (Priority: P3)

**Goal**: Every voice failure (no mic, permission denied, STT down, silence) produces a
plain-language notice and leaves typed intake fully functional — intake never blocks

**Independent Test**: Quickstart scenarios 7–9 — deny mic permission, break
`STT_MODEL_DIR`, record silence; each shows its plain-language notice, sends nothing,
creates no ticket, and typing keeps working

### Tests for User Story 3 (REQUIRED - Constitution Principle IV) ⚠️

- [ ] T025 [P] [US3] Extend backend/tests/integration/transcription.test.ts: provider chain exhaustion → 503 STT_UNAVAILABLE with plain-language message; fallback engages when primary fails; whitespace-only transcript returned as-is with 200 (client decides FR-011)
- [ ] T026 [P] [US3] Extend frontend/tests/components/VoiceControl.test.tsx: no-`mediaDevices` and permission-denied → notice + disabled mic + typing unaffected; 503 → "voice temporarily unavailable" notice; empty transcript → "couldn't hear any words" notice with nothing appended; mid-attempt failure preserves the existing draft

### Implementation for User Story 3

- [ ] T027 [US3] Implement capability/permission handling in frontend/src/components/VoiceControl.tsx: feature-detect before rendering an active mic, request permission only on explicit press, denied/absent → disabled control with explanatory tooltip and dismissible notice (microcopy from plan.md Design Direction)
- [ ] T028 [US3] Implement failure notices and draft preservation in frontend/src/pages/ChatPage.tsx and frontend/src/components/VoiceControl.tsx: map 503/network/empty-transcript to their plain-language notices above the composer; draft text survives every failure path; retry by voice or continue typing immediately
- [ ] T029 [US3] Harden backend/src/services/stt/stt-service.ts: per-provider timeout, error classification (unavailable vs invalid input), degradation log line on chain exhaustion (visible degradation, Principle VIII discipline)

**Checkpoint**: All three stories independently functional; zero blocked intakes across
the failure test set (SC-004)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Evidence, validation, and quality gates across all stories

- [ ] T030 [P] Capture documentation evidence in docs/: composer screenshots (idle/recording/transcribing/error), record→transcribe→review→send sequence-diagram update, named sample-code excerpt of the STT provider (Chapter 4)
- [ ] T031 [P] Export Chapter 5 TC tables from the Vitest runs (backend + frontend) into docs/ (Principle IV format: TC-No / input / expected / actual / Passed-Failed)
- [ ] T032 Execute specs/002-voice-input/quickstart.md scenarios 1–12 on the demo machine, including the SC-005 transience inspection (MongoDB + OS temp dir contain zero audio artifacts) and SC-003 latency measurement
- [ ] T033 Run quality gates: `tsc --noEmit`, lint, full backend+frontend test suites, and the scripted end-to-end demo path (report → classify → ticket → confirmation) with a voice-originated message
- [ ] T034 [P] frontend-design-pro review pass on the new composer states: impeccable critique/audit + taste pre-flight (theme lock, motion motivated, contrast, no banned patterns) against frontend/src/components/VoiceControl.tsx and frontend/src/pages/ChatPage.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (shared files: conversation model, message route, frontend types)
- **User Stories (Phases 3–5)**: All depend on Phase 2
  - US1 (P1) has no story dependencies — the MVP
  - US2 (P2) builds on US1's composer integration (T020) — frontend tasks depend on it; its backend test task (T022) only needs Phase 2
  - US3 (P3) builds on US1's VoiceControl and route — depends on T016/T019 existing
- **Polish (Phase 6)**: After all desired stories

### Within Each User Story

- Types/interfaces before providers (T012 → T013/T014), providers before service (→ T015), service before route (→ T016)
- Frontend lib + api client (T017, T018) before component (T019) before page integration (T020)
- Tests ship inside the same story; write them alongside implementation and keep them green at the checkpoint

### Parallel Opportunities

- Phase 1: T002 and T004 parallel to T001/T003
- Phase 2: T007 parallel to T005/T006
- US1: T009/T010/T011 together; T012 with T017/T018; T014 parallel to T013 (different files)
- US2: T021/T022 together
- US3: T025/T026 together; T027 and T029 parallel (different files)
- Phase 6: T030/T031/T034 parallel; T032/T033 sequential on the demo machine

## Parallel Example: User Story 1

```bash
# Launch all US1 test scaffolds together:
Task: "Unit tests for SttService chain in backend/tests/unit/stt-service.test.ts"
Task: "Integration tests for transcription route in backend/tests/integration/transcription.test.ts"
Task: "Component tests for VoiceControl in frontend/tests/components/VoiceControl.test.tsx"

# Launch independent implementation files together:
Task: "SttProvider types in backend/src/services/stt/types.ts"
Task: "Audio capture lib in frontend/src/lib/audio.ts"
Task: "transcribe() client in frontend/src/services/api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (blocking)
2. Phase 3 US1 → **STOP and VALIDATE**: quickstart scenarios 1–3 on the demo machine
3. Demoable increment: a spoken password report becomes a classified ticket

### Incremental Delivery

1. Setup + Foundational → suite green, origin field live
2. US1 → voice report end-to-end (MVP, demo-ready)
3. US2 → review/correct/discard + origin fidelity → demo
4. US3 → failure-proof degradation → demo
5. Polish → evidence captured, gates green, UAT-ready (SC-007)

---

## Notes

- Implementation MUST invoke `/frontend-design-pro build` before UI tasks (T019, T020, T024, T027, T028) — enforced by the `before_implement` hook in `.specify/extensions.yml`
- Audio never touches disk or logs anywhere in these tasks (FR-006/SC-005); keep `multer.memoryStorage()` and size caps exactly as contracted
- SessionForm.tsx is out of bounds — identification stays typed-only (clarification 2026-07-11)
- Keep every file ≤ 500 lines (Principle VI); `stt-service.ts` and `VoiceControl.tsx` are the likeliest to grow — split before they cross the line
- The developer commits manually; agents suggest messages only (constitution workflow rule)
- After code changes, run `graphify update .` to keep the knowledge graph current
