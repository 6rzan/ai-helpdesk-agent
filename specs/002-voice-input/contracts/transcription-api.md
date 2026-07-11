# API Contract: Voice Input

**Feature**: 002-voice-input | **Date**: 2026-07-11
Extends the foundation contract (`specs/001-conversational-ticketing-foundation/contracts/api.md`).
Error bodies use the foundation's `ApiErrorBody` shape: `{ error: { code, message } }`.

## POST /api/sessions/:sessionId/transcriptions

Transcribe one completed voice capture. Audio is processed in memory and discarded —
this endpoint never persists anything (FR-006).

**Request**: `multipart/form-data`
| Part | Type | Rules |
|---|---|---|
| `audio` | file, `audio/wav` | WAV PCM16, mono, 16 kHz (client-encoded, research R3). Max 16 MB / `VOICE_MAX_SECONDS` (default 120 s) + 5 s grace. |

**Responses**:
| Status | Body | When |
|---|---|---|
| `200` | `{ "transcript": string, "durationSeconds": number, "provider": "local" \| "openai_compat" }` | Success. `transcript` may be `""`/whitespace — the client treats that as "nothing heard" (FR-011) and sends nothing. |
| `400` | `{ error: { code: "INVALID_AUDIO", message } }` | Missing part, not WAV, wrong sample format |
| `404` | `{ error: { code: "SESSION_NOT_FOUND", message } }` | Unknown/expired session |
| `413` | `{ error: { code: "AUDIO_TOO_LARGE", message } }` | Size or duration cap exceeded |
| `503` | `{ error: { code: "STT_UNAVAILABLE", message } }` | Entire provider chain failed/unconfigured — client shows the plain-language "voice temporarily unavailable, please type" notice (FR-009) |

Notes:
- Plain-language `message` strings (FR-012); no engine jargon reaches the user.
- Structured logs record sizes/durations/provider/latency only — never audio bytes.
- One in-flight transcription per session; a concurrent request returns `409
  { code: "TRANSCRIPTION_IN_PROGRESS" }` (recordings are one-at-a-time by spec).

## POST /api/conversations/:conversationId/messages (extended)

Existing endpoint gains one optional request field; behaviour is otherwise identical
(origin-blind processing, FR-003/FR-005).

```jsonc
// request body — addition only
{
  "text": "…",                    // unchanged
  "inputOrigin": "typed"          // OPTIONAL: "typed" | "voice" | "mixed"; default "typed"
}
```

- Invalid enum value → existing `400` validation error.
- Message DTOs returned by all existing read endpoints now include `inputOrigin`.
- No SSE event shape changes; no ticket, escalation, or dashboard contract changes.

## Explicitly unchanged

Sessions, tickets, health, SSE events, and the reporter-identification step (typed-only
by clarification) keep their foundation contracts verbatim.
