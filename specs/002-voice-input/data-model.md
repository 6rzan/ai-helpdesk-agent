# Data Model: Voice Input

**Feature**: 002-voice-input | **Date**: 2026-07-11

No new persistent collections. One attribute is added to the foundation's Message; the
other two entities are deliberately ephemeral (FR-006).

## Message (extended — persistent, `conversations` collection)

| Field | Type | Rules |
|---|---|---|
| `inputOrigin` | `'typed' \| 'voice' \| 'mixed'` | Required on user-authored messages, default `'typed'`. Agent/staff/system messages always `'typed'` (they have no voice path). zod enum at the API boundary; Mongoose `enum` in the message subdocument schema. Never affects processing (FR-003/FR-005 — origin-blind). |

**Origin derivation (client-side, where draft history is known)** — per clarification
2026-07-11:

| Draft history at send | Origin |
|---|---|
| Typed characters only, no transcript ever appended | `typed` |
| Transcript(s) only, including edits/corrections made during review | `voice` |
| Draft contained typed text when a transcript was appended (either order) | `mixed` |

State rule: the draft tracks two flags, `hasTypedContent` and `hasTranscriptContent`.
Appending a transcript to a draft with `hasTypedContent=true` → `mixed`. Editing a
transcript-only draft does NOT set `hasTypedContent` (corrections are part of the voice
path). Once `mixed`, the draft stays `mixed` until sent or fully cleared. Clearing the
draft resets both flags.

**Migration**: none needed — `default: 'typed'` makes every pre-existing message valid;
no backfill required.

## Voice Capture (ephemeral — frontend state only, never persisted)

A transient recording in progress or awaiting transcription. Exists only inside the
active browser session (spec Key Entities).

**State machine** (drives `VoiceControl.tsx`):

```text
idle ──press mic──▶ requesting-permission ──granted──▶ recording
  ▲                        │ denied/no-mic                 │
  │                        ▼                               ├─ stop ────▶ transcribing
  │                  error(mic-unavailable)                ├─ cancel ──▶ idle (audio discarded)
  │                        │                               └─ limit ───▶ transcribing (auto-stop, FR-008)
  │                        ▼                                     │
  ◀──── notice dismissed / user types instead ◀── error(stt-unavailable | nothing-heard | failed)
  ▲                                                              │ success
  └──────────── transcript appended to composer draft ◀──────────┘
```

Invariants:
- Recording starts only from an explicit user press (FR-002); one recording at a time
  (clarification: repeated recordings append transcripts to the pending draft serially).
- `cancel` and session end discard audio with no transcription and no message (FR-006,
  edge case "leaves mid-recording").
- Every `error(...)` state renders a plain-language notice (FR-009/010/011/012) and
  leaves the typed path untouched.
- Audio bytes live in browser memory only until upload; the backend holds them in a
  request-scoped buffer only (research R4).

## Transcript (ephemeral — becomes part of an ordinary Message only on send)

| Aspect | Rule |
|---|---|
| Produced by | `SttService` from a completed capture |
| Presented | Appended into the composer textarea draft for review (FR-004) |
| Editable | Exactly like typed text; edits keep origin `voice` (see table above) |
| Discardable | Clearing the draft discards it; nothing is sent without explicit Send (FR-004) |
| Empty result | Transcript of only-whitespace → treated as "nothing heard" (FR-011): notice shown, nothing appended, nothing sent |
| Persistence | None as an entity — only the sent message text persists, as an ordinary Message |

## Validation summary (system boundaries)

| Boundary | Validation |
|---|---|
| `POST /api/sessions/:sessionId/transcriptions` | Session exists; multipart field `audio`; WAV header = PCM16 mono 16 kHz; size ≤ 16 MB; duration ≤ `VOICE_MAX_SECONDS` + grace |
| `POST /api/conversations/:id/messages` | Existing zod schema + optional `inputOrigin` enum (default `typed`) |
| STT provider output | Must be a string; trimmed; non-UTF8/oversized output rejected (LLM-adjacent output treated as untrusted input, Principle II spirit) |
