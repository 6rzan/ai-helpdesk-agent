# Phase 0 Research: Voice Input

**Feature**: 002-voice-input | **Date**: 2026-07-11

All Technical Context unknowns resolved. The developer requested "the latest and best
lightweight model" for speech recognition; R1 records that investigation.

## R1. Speech-to-text engine and model (reference configuration)

**Decision**: **NVIDIA Parakeet TDT 0.6B v2** (English, int8 ONNX export) executed on
**CPU** through **sherpa-onnx** (`sherpa-onnx-node`, prebuilt win-x64 binaries), wrapped
in the project's own `SttProvider` abstraction.

**Rationale**:
- **Current lightweight leader.** As of mid-2026 the Hugging Face Open ASR Leaderboard
  places Parakeet TDT 0.6B at the top of the lightweight class: ~6.05% average English
  WER (v2) — more accurate than Whisper large-v3 (~7.4%) at under half its size (0.6B
  vs 1.55B parameters) — with reported real-time factors in the thousands (RTFx ≈ 3,300)
  versus Whisper-class ~68. Absolute leaderboard leaders (NVIDIA Canary Qwen 2.5B ~5.6%,
  IBM Granite Speech 8B ~5.85%, Cohere Transcribe 2B) are LLM-decoder models several
  times larger and slower — not "lightweight" and not needed for six-category help-desk
  utterances.
- **Fits the hardware envelope (NFR-7).** ~0.7 GB resident int8 on CPU. The RTX 4050's
  6 GB VRAM stays wholly reserved for the LM Studio LLM (Qwen2.5-7B Q4 ≈ 4.5 GB); STT
  and LLM never compete. 30 s of audio transcribes in well under 2 s on the Ryzen 5
  8645HS — comfortably inside the 5 s p90 review budget (SC-003).
- **Robust on silence.** The TDT (transducer) decoder emits blanks on silence instead of
  hallucinating text — Whisper's known failure mode — which directly serves FR-011
  (silence must yield "nothing was understood", not an invented sentence).
- **Node-native integration (Principle VI).** `sherpa-onnx-node` keeps the stack
  TypeScript/Node-only: no Python sidecar, no ffmpeg. English-only v2 matches the spec's
  stated language scope; CC-BY-4.0 weights are fine for an academic project.
- **Sources**: [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) ·
  [Leaderboard trends blog](https://huggingface.co/blog/open-asr-leaderboard) ·
  [Northflank 2026 STT benchmarks](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks) ·
  [Parakeet vs Whisper 2026](https://localaimaster.com/blog/parakeet-vs-whisper) ·
  [Parakeet TDT profile](https://localaimaster.com/models/parakeet-tdt) ·
  [Moonshine/Parakeet/Whisper comparison](https://www.onresonant.com/resources/local-stt-models-2026)

**Alternatives considered**:
| Option | Why rejected |
|---|---|
| Whisper large-v3-turbo via faster-whisper | Excellent, but Python runtime (sidecar process) violates the single-ecosystem preference; slower and more silence-hallucination-prone than Parakeet TDT at similar effort. Retained as an ecosystem via the fallback provider (any OpenAI-compatible server, e.g. whisper.cpp `server` or speaches). |
| whisper.cpp in-process (small.en / large-v3-turbo) | Viable and CPU-friendly; lower accuracy (small.en) or higher latency (turbo) than Parakeet at the same footprint; Node bindings less maintained than sherpa-onnx. Remains the easiest self-hosted target for the `openai_compat` fallback. |
| Moonshine (245M, streaming) | Optimised for live streaming captions on edge devices; batch accuracy below Parakeet; streaming partials are out of scope (transcript is reviewed after stop). |
| Qwen3-ASR 0.6B/1.7B (Jan 2026) | Strong multilingual (52 languages) — capability the spec explicitly does not need (English-only scope); less mature ONNX/Node path today. |
| NVIDIA Canary Qwen 2.5B / Granite 8B / Cohere Transcribe 2B | Best absolute WER but LLM-decoder class: multi-GB, GPU-hungry — would contend with the LLM for the 6 GB VRAM and violate the lightweight requirement. |
| Browser Web Speech API (`webkitSpeechRecognition`) | Chromium implementation ships audio to Google servers — directly violates FR-007 (audio never leaves the controlled environment) and NFR-3/NFR-5. Rejected outright. |
| Hosted cloud STT (OpenAI, Deepgram, AssemblyAI, Groq) | Violates FR-007 reference config and the no-mandatory-cloud constraint; permissible only as an explicit, visible alternate configuration — which the `openai_compat` provider supports by pointing at a hosted base URL. |

## R2. STT provider abstraction and fallback chain

**Decision**: `SttService` mirrors the LLM gateway discipline (Principle VI/VIII): an
ordered provider chain configured by environment — reference `STT_PROVIDERS=local`
(sherpa/Parakeet in-process); alternates append `openai_compat` (POST
`{STT_OPENAI_BASE_URL}/v1/audio/transcriptions`, multipart WAV, optional API key).
Total chain failure degrades visibly: the route returns `503 STT_UNAVAILABLE` and the
UI shows the plain-language "voice temporarily unavailable, please type" notice
(FR-009) — never a silent error.

**Rationale**: Identical shape to the existing provider abstraction keeps the safety
story uniform and providers swappable by configuration only; `/v1/audio/transcriptions`
is the de-facto standard surface (whisper.cpp server, speaches, LM Studio-adjacent
tooling, and hosted providers all speak it).

**Alternatives considered**: single hardcoded engine (violates Principle VIII fallback
discipline); spawning a Python faster-whisper subprocess (second runtime to install and
defend in the viva).

## R3. Audio capture format and pipeline

**Decision**: Capture with browser `MediaRecorder` (webm/opus); on stop, decode in the
browser (`AudioContext.decodeAudioData`), downmix to mono and resample to 16 kHz via
`OfflineAudioContext`, encode **WAV PCM16** client-side, upload as multipart
(`audio/wav`). Backend accepts only 16 kHz mono PCM16 WAV, validated by header before
transcription.

**Rationale**: Every candidate engine consumes 16 kHz mono PCM natively, so client-side
conversion removes all server transcoding (no ffmpeg dependency — nothing extra to
install on the demo machine). 2 minutes of 16 kHz PCM16 ≈ 3.8 MB — a trivial local
upload. The browser can always decode its own recording, making the pipeline
deterministic across mic hardware.

**Alternatives considered**: upload webm/opus and decode server-side (adds ffmpeg or a
WASM decoder to the backend); raw AudioWorklet PCM streaming (more code, needed only
for live partial transcripts, which are out of scope).

## R4. Audio transience enforcement (FR-006, SC-005)

**Decision**: `multer.memoryStorage()` with a 16 MB cap — the upload exists only as a
request-scoped `Buffer`; no temp files, no disk path at any point. The transcription
route never logs audio bytes; structured logs record sizes and durations only. Response
sent → buffer goes out of scope. SC-005 verification: inspect MongoDB collections and
the OS temp directory after the test set; both must contain zero audio artifacts.

**Alternatives considered**: disk-buffered upload with post-hoc deletion (creates the
very persistence window FR-006 forbids, and crash-leaves files behind).

## R5. Message input origin (FR-005)

**Decision**: One attribute on Message: `inputOrigin: 'typed' | 'voice' | 'mixed'`,
default `'typed'`, supplied by the frontend at send time, zod-validated at the API
boundary, stored via Mongoose enum. Derivation rules live client-side where the draft
history is known (see data-model.md). Processing remains origin-blind end-to-end.

**Alternatives considered**: deriving origin server-side (server cannot know draft
composition history); separate VoiceMessage subtype (violates "no voice-specific
behaviour", FR-003).

## R6. Recording duration limit (FR-008)

**Decision**: Default 120 s, configurable: frontend `VITE_VOICE_MAX_SECONDS` enforces
the live cap (timer, T-15 s warning, auto-stop at limit with transcript offered for
review); backend `VOICE_MAX_SECONDS` (+ the 16 MB multer cap) independently rejects
oversized uploads (`413 AUDIO_TOO_LARGE`). Client value is UX, server value is the
guarantee.

**Alternatives considered**: server-only enforcement (user loses speech with no warning
— violates FR-008's "never silently discards speech").

## R7. Microphone permission & capability handling (FR-010)

**Decision**: Feature-detect `navigator.mediaDevices.getUserMedia` before showing an
active mic; request permission only on first explicit press (FR-002). Denied/absent mic
→ persistent plain-language notice, mic control disabled with explanatory tooltip,
typed path untouched. No pre-emptive permission prompt on page load.

**Alternatives considered**: requesting permission at session start (violates
explicit-action privacy posture and annoys users who never use voice).
