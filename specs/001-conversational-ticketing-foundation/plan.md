# Implementation Plan: Conversational & Ticketing Foundation

**Branch**: `001-conversational-ticketing-foundation` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-conversational-ticketing-foundation/spec.md`

## Summary

Build the foundation every later feature plugs into: a web chat where an identified reporter describes an IT problem in free text, a locally hosted LLM (behind the single provider-abstraction module) classifies it into one of the six fixed IR categories with a confidence score, a ticket is created automatically with full state history, and the reporter sees status/handling-mode changes in plain language in real time. Low confidence triggers bounded clarification then escalation; LLM unavailability degrades to an unclassified, human-flagged ticket — intake never fully fails. No remediation capability and no staff UI exist in this feature (clarified 2026-07-08).

## Technical Context

**Language/Version**: TypeScript 5.x, `strict` mode everywhere (backend + frontend); Node.js LTS (≥ 20)

**Primary Dependencies**: Express (REST + SSE), Mongoose, zod (all boundary validation), React + Vite + Tailwind CSS (chat UI), Ollama (default LLM runtime behind the provider abstraction; default model `llama3.1:8b` Q4, configurable), pino (structured logging)

**Storage**: MongoDB Community Edition (local), via Mongoose schemas

**Testing**: Vitest (unit + integration) + supertest (HTTP) + mongodb-memory-server; deterministic `MockLlmProvider` for all functional tests; separate opt-in benchmark suite against real Ollama; custom Vitest reporter exports APU Chapter-5 TC tables

**Target Platform**: Windows 11 on HP Victus 16 (Ryzen 5 8645HS, 16 GB RAM, RTX 4050 6 GB VRAM) — install, run, and demo entirely on this one machine; no cloud on the core path

**Project Type**: Web application — `backend/` + `frontend/` (constitution-mandated layout)

**Performance Goals**: Agent reply visibly starts ≤ 3 s and completes ≤ 10 s (SC-008, via token streaming); status/handling-mode changes visible ≤ 2 s (SC-004, via SSE push); intake available whenever the service runs (SC-006)

**Constraints**: LLM must fit the 6 GB VRAM envelope; refusal-by-default safety posture (no command execution path exists at all in this feature); source files ≤ 500 lines; LLM output treated as untrusted input (zod-validated against a closed category enum); data minimisation (orgId + displayName + problem text only)

**Scale/Scope**: Single organisation, isolated test environment; ~3–10 concurrent users (UAT minimum 3 testers); 3 user stories, 13 functional requirements; data volume trivially small (hundreds of tickets)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate assessment | Status |
|---|-----------|-----------------|--------|
| I | IR Fidelity | Every spec FR cites its IR source (IR FR-1/2/3/5/6/7, NFR-1/2/5/6). Deferred IR items (FR-4 guidance, FR-8 remediation, FR-9 dashboard, voice) are documented deferrals, not scope changes. | PASS |
| II | Safety-First Automation | This feature ships **zero** execution capability: no executor, no whitelist consumer, no code path that runs commands — refusal is structural, not conditional. LLM output is untrusted: classification responses are zod-parsed against the closed category enum + confidence bounds; parse failure ⇒ unclassified/escalate, never guess. Ticket state history is an immutable append-only log. | PASS |
| III | Human-in-the-Loop | Escalation is first-class: explicit user request, low confidence, or bounded-clarification exhaustion all set `escalated` + `human_involved`, carrying the full conversation so users never repeat themselves. | PASS |
| IV | Test-Backed Evidence | Escalation logic (safety-critical) is developed test-first — its failing tests are written before implementation. Every other component ships tests in the same task. Vitest reporter emits Chapter-5 TC tables. The scripted demo path (report → classify → ticket → status → escalation) is this feature's release gate. | PASS |
| V | Documentation as Deliverable | Plan includes docs/ evidence capture: UI screenshots, named sample-code excerpts, TC tables, and the ERD/sequence diagrams produced in Phase 1. | PASS |
| VI | Clean TypeScript Architecture | Strict TS; zod at every boundary (HTTP, LLM output); exactly one LLM gateway module (`backend/src/services/llm/`) — no other module may import an LLM client; structured logging via pino; files ≤ 500 lines. | PASS |
| VII | RUP-Aligned Iterative Delivery | This is Construction iteration 1: the conversational + ticketing foundation that Principle VII orders before all category features. User stories are independently implementable/demoable slices (P1 MVP first). | PASS |

**Post-Phase-1 re-check (2026-07-08)**: design artifacts (data-model.md, contracts/api.md, quickstart.md) introduce no new violations. The single test-support state-transition endpoint is disabled outside demo/test mode and exists because this feature has no staff UI (clarified decision) — documented in contracts/api.md, not a safety-layer bypass (it executes nothing; it only moves ticket state). PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-conversational-ticketing-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist (passing 16/16)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/            # env loading (.env + .env.example), zod-validated config schema
│   ├── models/            # Mongoose schemas: Reporter, Conversation, Message, Ticket
│   ├── services/
│   │   ├── llm/           # THE single LLM gateway: LlmProvider interface, OllamaProvider,
│   │   │                  #   MockLlmProvider (tests), provider factory — no LLM access elsewhere
│   │   ├── classification/ # intent classification + zod schema for LLM output, confidence policy
│   │   ├── conversation/  # chat orchestration: greeting, clarification rounds, reply streaming
│   │   ├── ticket/        # ticket creation, reference generation, state machine, history
│   │   └── escalation/    # escalation rules (TDD — tests first per Principle IV)
│   ├── api/
│   │   ├── routes/        # sessions, conversations/messages, tickets, health
│   │   ├── sse/           # event stream: agent tokens + ticket state events
│   │   └── middleware/    # zod request validation, error handler, request logging
│   └── lib/               # pino logger, error types, ids/clock helpers
└── tests/
    ├── unit/              # state machine, escalation (test-first), classification parsing
    ├── integration/       # API + mongodb-memory-server + MockLlmProvider end-to-end flows
    └── benchmark/         # opt-in: real-Ollama classification accuracy (SC-003) + latency (SC-008)

frontend/
├── src/
│   ├── components/        # ChatWindow, MessageBubble, TicketCard, StatusBadge, SessionForm
│   ├── pages/             # single chat page (reporter identification → conversation)
│   ├── services/          # typed API client, SSE subscription hook
│   └── lib/               # shared types (mirrors contracts), formatting
└── tests/                 # component tests (Vitest + Testing Library)
```

**Structure Decision**: Constitution-mandated web-application layout — `backend/` (Express + Mongoose + LLM gateway) and `frontend/` (React chat SPA), both TypeScript strict, served together on the demo machine. Neither directory exists yet; this feature creates both scaffolds.

## Complexity Tracking

No constitution violations — table intentionally empty.
