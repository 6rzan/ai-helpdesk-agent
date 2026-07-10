# Scripted Demo Path — Release Gate Log (T047)

**Date**: 2026-07-09
**Reference**: quickstart.md §Demo path — report → classify → ticket → status question → demo-mode escalation transition (live SSE) → vague report → clarification → escalation with transcript.
**Result**: **PASS — 9/9 checks**

## Environment (demo machine — HP Victus 16)

| Component | Value |
|---|---|
| Backend | Express dev server, `APP_MODE=demo`, port 3000 |
| LLM | LM Studio, Qwen2.5-7B-Instruct Q4_K_M, `openai_compat` provider, `http://127.0.0.1:1234/v1` |
| Database | MongoDB (mongodb-memory-server) |
| Driver | Scripted curl sequence against the REST + SSE API |

## Steps and observed results

| # | Step | Observed | Check |
|---|---|---|---|
| 0 | Create session (`TP047001` / Alex Chen) | Session + conversation created | PASS |
| 1 | Report "I forgot my password and can't log in to my laptop" | Ticket created, category `password_login`, confirmation with quotable reference pushed over SSE | PASS (×2) |
| 2 | Ask "What's the status of my tickets?" | Per-ticket plain-language summary; ticket count unchanged | PASS |
| 3 | Staff transition `handlingMode → human_involved` via demo-mode `PATCH /api/tickets/:ref/state` | `ticket_updated` SSE event received in **109 ms** (SC-004 gate ≤ 2 s); plainText: "Ticket … is now with IT staff." | PASS (×2) |
| 4 | Vague report ("something is wrong with my thing…") + 2 more vague replies | Round 1: clarifying question, no ticket; after rounds exhausted: escalated `unclassified` ticket, `handlingMode=human_involved` | PASS (×2) |
| 5 | Fetch escalated ticket detail | Full transcript attached (10 messages), `escalationReason=low_confidence` — staff handover context complete (FR-007) | PASS |

## Notes

- The real LLM (not the mock) handled classification for every step; classifier prompt is the
  final version benchmarked in [benchmark-results.md](./benchmark-results.md) (100% accuracy, 0%
  confident misclassification, p90 1.6 s).
- An earlier take of the same path on the same stack also passed steps 1–4 before being
  interrupted by an environment restart; this log records the clean end-to-end take.
