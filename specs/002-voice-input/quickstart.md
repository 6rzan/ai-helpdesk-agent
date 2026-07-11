# Quickstart: Voice Input Validation

**Feature**: 002-voice-input | **Date**: 2026-07-11
Run guide only — implementation detail lives in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/transcription-api.md).

## Prerequisites

- Feature 001 running end-to-end (backend + frontend + MongoDB + LM Studio LLM).
- A working microphone on the demo machine; Chromium-based browser.
- STT model downloaded once (gitignored):

```powershell
# from repo root — Parakeet TDT 0.6B v2 int8 (sherpa-onnx export, ~700 MB)
mkdir backend/models/stt -Force
# download + extract sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8 from the sherpa-onnx
# releases into backend/models/stt/  (exact URL pinned in backend/.env.example)
```

- Environment (append to `backend/.env`, mirrored in `.env.example`):

```dotenv
STT_PROVIDERS=local                # reference config: fully local (FR-007)
STT_MODEL_DIR=./models/stt
VOICE_MAX_SECONDS=120              # FR-008 default
# alternate config (explicit, visible choice per FR-007):
# STT_PROVIDERS=local,openai_compat
# STT_OPENAI_BASE_URL=http://127.0.0.1:8080   # e.g. whisper.cpp server / speaches
```

Frontend (optional override): `VITE_VOICE_MAX_SECONDS=120`.

## Run

```powershell
cd backend; npm install; npm run dev     # terminal 1
cd frontend; npm install; npm run dev    # terminal 2
```

Automated tests: `npm test` in each of `backend/` and `frontend/`
(TC-table export naming per Principle IV).

## Validation scenarios

| # | Scenario | Steps | Expected | Maps to |
|---|---|---|---|---|
| 1 | Voice report end-to-end | Identify (typed) → press mic → say "I forgot my password and can't log into my computer" → Stop → review → Send | Transcript appeared for review; after Send: password/login classification, ticket reference, plain-language confirmation — identical to typed path; whole journey < 2 min | SC-001, US1 |
| 2 | Category benchmark | Speak one prepared report per category (6 total, quiet room) | ≥ 90% classified same as typed equivalents | SC-002 |
| 3 | Latency | Record ~30 s utterances ×10 | Transcript ready ≤ 5 s after Stop at p90 | SC-003 |
| 4 | Review & correct | Record; edit a misheard word; Send | Agent processes corrected text only; message origin `voice` | US2 |
| 5 | Discard | Record; clear the draft | Nothing sent, no ticket; mic and typing immediately usable | US2, FR-004 |
| 6 | Mixed draft | Type half a sentence → record the rest → Send | Combined draft reviewed once; origin `mixed`; downstream identical | FR-005, SC-006 |
| 7 | Mic denied | Deny mic permission in browser → press mic | Plain-language notice; typing unaffected | US3, FR-010 |
| 8 | STT down | Set `STT_MODEL_DIR` to a bad path (or stop fallback server) → attempt voice | "Voice temporarily unavailable, please type" notice; typed intake works; `503 STT_UNAVAILABLE` in logs | SC-004, FR-009 |
| 9 | Silence | Record 5 s of silence | "We couldn't hear any words" notice; nothing sent, no ticket | FR-011 |
| 10 | Limit | Keep talking past 2:00 (or set `VOICE_MAX_SECONDS=15` for the test) | T-15 s warning; auto-stop at limit; captured speech offered for review | FR-008 |
| 11 | Audio transience | After scenarios 1–10: inspect MongoDB collections and OS temp dir | Zero audio artifacts anywhere; only sent transcripts persist as messages | SC-005, FR-006 |
| 12 | Rapid re-record | Record → transcript lands in draft → record again before sending | Second transcript appends to pending draft; single review before Send | Edge case (clarified 2026-07-11) |

UAT (SC-007) reuses scenarios 1, 4, 5, 7 with ≥ 3 testers; demographics recorded per
constitution Principle IV.

## Evidence capture (Principle V, while validating)

Screenshot the composer in idle / recording / transcribing / error states → `docs/`
(Chapter 4); export TC tables from the Vitest run; update the conversation sequence
diagram with the record → transcribe → review → send hop.
