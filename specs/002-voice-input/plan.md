# Implementation Plan: Voice Input

**Branch**: `002-voice-input` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-voice-input/spec.md`

## Summary

Add the deferred IR FR-1 voice path to the help desk chat: an explicit-start microphone
control records the user's speech in the browser, the audio is transcribed to text by a
fully local speech-to-text engine, and the transcript lands in the existing composer
draft for review, editing, or discard before sending. Downstream behaviour (classification,
ticketing, clarification, escalation) is untouched; the only data-model change is one
`inputOrigin` attribute on Message. Reference STT engine: **NVIDIA Parakeet TDT 0.6B v2
(int8 ONNX) running on CPU via sherpa-onnx**, behind a provider abstraction with an
OpenAI-compatible fallback — chosen in Phase 0 research as the current best lightweight
local model (top of the lightweight class on the Hugging Face Open ASR Leaderboard,
~6.05% English WER at 0.6B parameters, real-time factors far above the 5-second review
budget, and zero VRAM contention with the LM Studio LLM).

## Technical Context

**Language/Version**: TypeScript 5.x `strict` (Node.js LTS backend, React 18 frontend)

**Primary Dependencies**: Existing — Express, Mongoose, zod, Vite, Tailwind CSS.
New backend — `sherpa-onnx-node` (Parakeet TDT 0.6B v2 int8 runtime, prebuilt win-x64
binaries), `multer` (in-memory multipart upload). New frontend — `@phosphor-icons/react`
(microphone/stop/discard glyphs); audio capture uses the browser-native MediaRecorder +
Web Audio APIs (no library).

**Storage**: MongoDB Community + Mongoose. Messages gain `inputOrigin` (`typed | voice |
mixed`). Audio is NEVER stored: uploads are processed in memory and discarded (FR-006).

**Testing**: Vitest + supertest (backend unit/integration with a stubbed STT provider),
Vitest + Testing Library (frontend, mocked MediaRecorder). Test names map to Chapter 5
TC tables.

**Target Platform**: Windows 11 demo machine (HP Victus 16 — Ryzen 5 8645HS, 16 GB RAM,
RTX 4050 6 GB); modern Chromium browser for the chat UI.

**Project Type**: Web application (`backend/` + `frontend/`).

**Performance Goals**: Transcript ready for review ≤ 5 s at p90 for utterances up to
30 s (SC-003). Parakeet TDT int8 on this CPU transcribes 30 s of audio in well under
2 s, leaving headroom for upload + decode.

**Constraints**: All speech processing local in the reference config (FR-007); STT runs
on CPU so the 6 GB VRAM stays reserved for the LM Studio LLM; 16 GB RAM envelope
(model ≈ 0.7 GB resident); recording cap default 120 s (configurable, FR-008); audio
transient in memory only (FR-006); typed path must keep working through every voice
failure (FR-009/FR-010).

**Scale/Scope**: Single-organisation demo; a handful of concurrent sessions; one
recording at a time per session. ~6 new source files, 2 extended.

## Constitution Check

*GATE: evaluated against constitution v1.1.1 before Phase 0; re-checked after Phase 1.*

| Principle | Verdict | Evidence |
|---|---|---|
| I. IR Fidelity | ✅ PASS | Spec traces to IR FR-1 (voice path), NFR-2, NFR-3, NFR-5, NFR-7; no scope beyond the IR. Title and downstream pipeline unchanged. |
| II. Safety-First Automation | ✅ PASS | No new automated actions, no whitelist/executor/endpoint-registry change. Transcription is a pure input transform; the transcript enters the same validated message boundary as typed text. |
| III. Human-in-the-Loop | ✅ PASS | Escalation, dashboard, and handover untouched; voice messages carry through to tickets as ordinary text (origin-blind processing, FR-003/FR-005). |
| IV. Test-Backed Evidence | ✅ PASS | Not safety-layer code, so TDD is not mandated, but every task ships tests: STT service fallback-chain units, transcription-endpoint integrations (stubbed engine, failure/unavailable/empty cases), origin-validation units, frontend state-machine tests with mocked MediaRecorder. Hardware capture itself is covered by manual TC entries (documented in quickstart). |
| V. Documentation as Deliverable | ✅ PASS | Plan requires: voice-flow UI screenshots, sequence-diagram update (record → transcribe → review → send), sample-code excerpt (STT provider), TC tables from test names. |
| VI. Clean TypeScript Architecture | ✅ PASS | STT sits behind a single provider abstraction (`SttService`) with a fully local reference provider — mirrors the LLM gateway rule. zod validation on the upload boundary and on `inputOrigin`. Files ≤ 500 lines. Native-addon dependency justified in research.md (R1). |
| VII. RUP-Aligned Delivery | ✅ PASS | Voice input occupies exactly its amended Principle VII slot (after service status, before constrained remediation). Stories P1→P3 are independently demoable increments. |
| VIII. Agent Core & Prompts | ✅ PASS | No prompt or agent-loop change: the transcript is delimited user data like any typed message. The STT provider adopts the same ordered-fallback + visible-degradation discipline as the LLM chain (local primary, config-only alternates). |

**Post-Phase-1 re-check (2026-07-11)**: design artifacts introduce no new violations —
no new collections, no prompt changes, one enum attribute on Message, one new route.
Gate remains ✅ PASS. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-voice-input/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── transcription-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── middleware/validate.ts          # existing — reused on new route
│   │   └── routes/transcriptions.ts        # NEW — POST /api/sessions/:sessionId/transcriptions
│   ├── config/index.ts                     # EXTEND — STT_* and VOICE_MAX_SECONDS settings
│   ├── models/conversation.ts              # EXTEND — Message.inputOrigin enum
│   └── services/
│       └── stt/                            # NEW — speech-to-text behind one abstraction
│           ├── types.ts                    #   SttProvider interface + result types
│           ├── stt-service.ts              #   ordered fallback chain, availability, timing
│           └── providers/
│               ├── sherpa-local.ts         #   reference: Parakeet TDT 0.6B v2 int8 via sherpa-onnx (CPU)
│               └── openai-compat.ts        #   alternate: POST {base}/v1/audio/transcriptions
├── models/stt/                             # gitignored model files (download in quickstart)
└── tests/
    ├── unit/stt-service.test.ts            # NEW
    └── integration/transcription.test.ts   # NEW (+ extend message tests for inputOrigin)

frontend/
├── src/
│   ├── components/VoiceControl.tsx         # NEW — mic button + recording/transcribing/error states
│   ├── lib/
│   │   ├── audio.ts                        # NEW — capture, 16 kHz mono PCM16 WAV encode
│   │   └── types.ts                        # EXTEND — InputOrigin, Message.inputOrigin
│   ├── pages/ChatPage.tsx                  # EXTEND — composer integration, draft-origin tracking
│   └── services/api.ts                     # EXTEND — transcribe(sessionId, wavBlob)
└── tests/components/VoiceControl.test.tsx  # NEW
```

**Structure Decision**: Web application layout already established by feature 001
(`backend/` + `frontend/`). Voice input adds one backend service directory
(`services/stt/`), one route, one frontend component, and one frontend lib module;
everything else is an extension of existing files. `SessionForm.tsx` is deliberately
untouched — reporter identification stays typed-only (clarification 2026-07-11).

## Design Direction (frontend-design-pro)

**Design Read**: Product-register addition to an existing internal help-desk chat —
trust-first tooling for employees mid-task, extending feature 001's stock-Tailwind
vocabulary; earned familiarity over novelty, zero decorative flourish.

**Dials**: `DESIGN_VARIANCE: 3` (trust-first internal product; consistency with 001 is
the feature) · `MOTION_INTENSITY: 3` (motion only conveys state: recording pulse,
150–250 ms transitions) · `VISUAL_DENSITY: 4` (chat composer; compact controls, no new
chrome).

**Design system / stack**: Existing React 18 + Vite + Tailwind (stock config, light
theme locked — Page Theme Lock). No component library added. Icons: `@phosphor-icons/react`
(one family, `weight="regular"`), because taste-skill bans hand-rolled SVG icons and 001
has no icon library yet. Needed glyphs: `Microphone`, `Stop`, `X`.

**Palette commitment**: 001's established palette, locked — gray neutrals
(`gray-100…900`), primary accent `blue-600` (send/actions). Recording state uses the
already-present red family (`red-600` dot + label, `red-50` surface tint) — the one
conventional colour for live capture, already in the page's vocabulary via error text.
No new hues; status tints (green/amber/purple) untouched.

**Typography plan**: System font stack via Tailwind defaults, exactly as 001 — product
register: one family carries labels, buttons, timer digits (`tabular-nums` on the
recording timer so it doesn't jitter).

**Layout strategy** (composer states, inline — never a modal):
- *Idle*: mic icon-button sits inside the composer row, right of the textarea, left of
  Send; 40 px hit target; `aria-label="Record a voice message"`.
- *Recording*: composer swaps to a recording bar — pulsing red dot, "Recording" label,
  elapsed/limit timer (`0:42 / 2:00`), Stop (primary) and Cancel controls; textarea
  stays visible below with the pending draft. At T-15 s an `aria-live` note: "Recording
  ends in 15 seconds."
- *Transcribing*: mic button shows an inline working state ("Turning your speech into
  text…"); composer remains editable.
- *Review*: transcript is appended into the existing textarea draft (voice joins typed
  text; a second recording appends again) — review/edit/discard use the composer the
  user already knows; Send is the only way anything is sent (FR-004).
- *Errors*: plain-language inline notice above the composer (mic denied, STT
  unavailable, nothing heard), dismissible, typed path visibly unaffected.

**Motion plan**: 150–250 ms ease transitions between composer states; 1 s opacity pulse
on the recording dot (state-conveying, FR-002). `prefers-reduced-motion`: pulse becomes
a static dot — the text label and timer are the primary indicators (also the a11y path).

**Microcopy (FR-012, plain language, no em-dashes per taste ban)**:
"Recording", "Turning your speech into text…", "We couldn't hear any words. You can try
again or type instead.", "The microphone is not available. You can keep typing as
usual.", "Voice input is not available right now. Please type your message instead."

**Banned for this feature** (union of taste + impeccable product bans + project):
modals for any part of the flow; decorative/looping motion beyond the recording pulse;
gradients, glassmorphism, display fonts; emoji as icons; hand-rolled SVG icon paths; any
new accent hue; auto-send affordances; placeholder-as-label; spinner replacing layout
(inline working states only); waveform visualisations (unearned complexity for this
scope).

**Affected shared components (graphify)**: `ChatPage.tsx` (composer — direct edit,
regression risk on the typed send path → covered by existing + extended tests);
`services/api.ts` (additive `transcribe()`); `lib/types.ts` (Message gains
`inputOrigin` — consumed by `MessageBubble`, which renders unchanged; origin is not
displayed); `useEvents.ts` untouched; `SessionForm.tsx` untouched by rule (typed-only
identification). Regression watch: MessageBubble/TicketCard type imports must compile
with the extended Message.

**Planned build sequence**: craft → critique → polish → audit (impeccable), with taste
pre-flight before ship.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
