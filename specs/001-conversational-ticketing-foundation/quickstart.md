# Quickstart & Validation Guide: Conversational & Ticketing Foundation

**Date**: 2026-07-08 | **Contracts**: [contracts/api.md](./contracts/api.md) | **Data model**: [data-model.md](./data-model.md)

How to run the feature on the demo machine (HP Victus, Windows 11) and prove each user story end-to-end. No implementation code here — commands and expected outcomes only.

## Prerequisites

| Requirement | Check |
|---|---|
| Node.js LTS ≥ 20 | `node --version` |
| MongoDB Community running locally | `mongosh --eval "db.runCommand({ping:1})"` |
| Ollama installed with default model pulled | `ollama pull llama3.1:8b` then `ollama list` |

## Setup

```powershell
# from repo root
Copy-Item .env.example .env        # then review values (Mongo URI, LLM_MODEL, APP_MODE)
cd backend;  npm install; cd ..
cd frontend; npm install; cd ..
```

## Run

```powershell
# terminal 1 — backend (Express + SSE) on :3001
cd backend; npm run dev

# terminal 2 — frontend (Vite) on :5173
cd frontend; npm run dev
```

Open `http://localhost:5173`, enter a display name + organisational ID, and chat.

Sanity check: `curl http://localhost:3001/api/health` → `status: "ok"`, `llm.reachable: true`, `db.reachable: true`.

## Automated validation

```powershell
cd backend
npm test                 # unit + integration (MockLlmProvider — deterministic, no Ollama needed)
npm run test:benchmark   # opt-in: real Ollama; asserts SC-003 accuracy ≥ 80% and SC-008 latency
npm run tc-tables        # regenerate APU Chapter-5 TC tables into docs/
cd ../frontend
npm test                 # component tests
```

Quality gates before calling the feature done (constitution): `tsc --noEmit`, lint, all tests, scripted demo path below.

## Manual validation scenarios

### US1 — Report an issue, get a ticket (P1)

1. Start a session (name + org ID, e.g. `TP078281`).
2. Type: *"I forgot my password and can't log into my computer"*.
3. **Expect**: reply starts streaming ≤ 3 s, completes ≤ 10 s; plain-language confirmation naming the **password/login** category and a quotable reference (`HD-NNNN`).
4. Repeat with one report per remaining category (network, printer, peripherals, performance, service status) — each classifies correctly (SC-003 spot check).
5. Type only *"hi"* → conversational greeting inviting a problem description; **no ticket created**.

### US2 — Follow status in plain messages (P2)

1. With a ticket open and `APP_MODE=demo`, drive a transition via the test-support endpoint (see [contracts/api.md](./contracts/api.md#test-support-not-part-of-the-product-surface)):
   `PATCH /api/tickets/HD-0001/state` body `{"field":"handlingMode","to":"human_involved","actor":"staff"}`.
2. **Expect**: a plain-language update appears in the chat within 2 s (SC-004).
3. Ask *"what's happening with my ticket?"* → list of the reporter's tickets with status + handling mode, jargon-free.
4. Close the browser, start a **new session with the same org ID** → open tickets listed (cross-session identity, FR-008).

### US3 — Clarify or escalate (P3)

1. Type *"my computer is acting weird"* → clarifying question (no ticket, no guess).
2. Stay vague twice more → unclassified ticket flagged for human attention (`escalated`, reason `low_confidence`), mode `human_involved`.
3. In a fresh conversation type *"can I just talk to IT staff?"* → immediate escalation acknowledgement.
4. Fetch the escalated ticket (`GET /api/tickets/:reference`) → full transcript + classification attempt attached (FR-007 — nothing to re-ask).

### Degradation — FR-013

1. Stop Ollama (`Stop-Process -Name ollama` or quit the tray app).
2. Report an issue in chat.
3. **Expect**: report accepted, unclassified ticket created (reason `llm_unavailable`), user told their report is saved; `/api/health` shows `degraded`.
4. Restart Ollama → next report classifies normally.

### Availability probe — SC-006

Run the scheduled probe (script hits `POST /api/sessions` + a report at intervals across 24 h) and confirm every attempt succeeds while the service runs unattended.

## Demo path (release gate, Principle IV)

Scripted sequence for the 25-minute presentation: report password issue → ticket confirmation → status question → demo-mode escalation transition (live SSE update) → vague report → clarification → escalation with transcript. This exact path must pass on the demo machine before any supervisor meeting or recording.
