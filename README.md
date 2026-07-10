# AI Help Desk Agent

Conversational IT support automation for organisations — a chat-based agent that takes free-text problem reports, classifies them into fixed support categories, opens tickets automatically, keeps reporters informed in plain language in real time, and hands off to human IT staff whenever a case is unclear, out of scope, or simply when the user asks for a person.

> **🚧 Project status: under active development.**
> This project is designed, built, and maintained solely by the author, and it is a living codebase: any part of it — features, APIs, data models, project structure, or documentation — is open to change by the author at any time, without prior notice. Do not treat any interface as stable yet.

Developed as a B.Sc. (Hons) Computer Science Final Year Project at Asia Pacific University (APU): *Designing Artificial Intelligence Help Desk Agent for Organisational IT Support Automation*.

---

## What it does

Employees report IT problems the way they would describe them to a colleague — in their own words, at any hour, with no forms and no training. The agent:

1. **Understands the report** using a locally hosted LLM and classifies it into exactly one of six fixed support categories — or explicitly admits it isn't sure. It never silently guesses.
2. **Opens a ticket automatically** with a quotable reference (`HD-NNNN`), the reporter's own description, the category, and a full timestamped state history.
3. **Keeps the reporter informed** — every status or handling-mode change appears in the conversation immediately, in plain, jargon-free language. Users can also just ask *"what's happening with my ticket?"*.
4. **Asks instead of assuming** — low classification confidence triggers a bounded clarification exchange (two rounds by default), after which the ticket is flagged for human attention with the entire conversation attached, so nobody ever repeats themselves.
5. **Escalates on request** — saying *"can I just talk to IT staff?"* at any point hands the case to a human immediately.
6. **Degrades gracefully** — if the language model is unreachable, intake still works: the report is recorded as an unclassified, human-flagged ticket and the user is told it is saved.

### Support categories

Password / login · Internet & network connectivity · Printer · Peripheral devices · Slow device performance · Basic service status

### Ticket lifecycle

`Open → In Progress → Resolved → Closed`, where **Resolved** waits for the reporter to confirm the fix (confirmation closes the ticket; *"still broken"* reopens it), and **Open** tickets may close directly when withdrawn or identified as duplicates. Orthogonally, each ticket carries a **handling mode**: *automated*, *waiting on user*, or *human involved*. Every transition is timestamped and recorded in an append-only history.

### Safety posture

This foundation contains **no remediation capability whatsoever** — no code path executes commands, scripts, or system changes. Requests for such actions are politely declined and escalated where relevant. LLM output is treated as untrusted input and schema-validated against a closed category set before anything acts on it. Data collection is minimal by design: a display name, an organisational identifier, and the problem text the user chooses to share.

---

## Architecture

Monorepo with a TypeScript backend and frontend, running entirely on one machine — no mandatory cloud dependency.

```text
backend/                      Express API (TypeScript, strict)
├── src/
│   ├── config/               zod-validated environment configuration (fail-fast)
│   ├── models/               Mongoose schemas: Reporter, Conversation, Message, Ticket
│   ├── services/
│   │   ├── llm/              single LLM gateway — Ollama, OpenAI-compatible, and mock
│   │   │                     providers behind one interface; no other module touches a model
│   │   ├── classification/   classification prompt + confidence policy
│   │   ├── conversation/     chat orchestration: greeting, clarification, streaming replies
│   │   ├── ticket/           reference counter, creation, state machine, notifications
│   │   ├── escalation/       escalation decision rules (developed test-first)
│   │   └── session/          lightweight session + reporter identity
│   ├── api/
│   │   ├── routes/           sessions, conversations, tickets, health
│   │   ├── sse/              Server-Sent Events: token streaming + live ticket updates
│   │   └── middleware/       zod request validation, error envelope
│   └── lib/                  structured logging (pino), typed errors, clock/id helpers
├── tests/                    unit + integration (in-memory MongoDB, deterministic mock LLM)
│   └── benchmark/            opt-in accuracy & latency suite against a real model
└── scripts/                  test-case table generator, 24-hour availability probe

frontend/                     React + Vite + Tailwind CSS chat SPA
├── src/
│   ├── components/           MessageBubble, TicketCard, StatusBadge, SessionForm, …
│   ├── pages/                single chat page (identify → converse)
│   └── services/             typed API client + SSE subscription hook
└── tests/                    component tests (Testing Library)

specs/                        feature specifications, plans, task lists, API contracts, data model
docs/                         design diagrams, implementation evidence, testing reports
```

Key decisions:

- **Single LLM gateway** — all model access flows through one provider-abstraction module (`backend/src/services/llm/`). Providers are swappable by configuration only: self-hosted **Ollama** (default), any **OpenAI-compatible** server (e.g. LM Studio), or a deterministic **mock** for tests and offline development.
- **Real-time by SSE** — agent replies stream token-by-token, and ticket state changes push to the reporter's browser within moments of the change.
- **Validation at every boundary** — HTTP requests and LLM output are parsed with zod before use; malformed model output routes to the escalation path rather than being trusted.
- **Append-only ticket history** — a state machine validates every transition; anything not explicitly allowed is rejected.

## Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript 5 (`strict`) on Node.js ≥ 20 |
| Backend | Express, Mongoose, zod, pino |
| Frontend | React, Vite, Tailwind CSS |
| Database | MongoDB Community Edition |
| LLM runtime | Ollama (default) / any OpenAI-compatible server / mock |
| Realtime | Server-Sent Events |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library |

---

## Getting started

### Prerequisites

| Requirement | Check |
|---|---|
| Node.js ≥ 20 | `node --version` |
| MongoDB running locally | `mongosh --eval "db.runCommand({ping:1})"` |
| An LLM runtime *(optional for development — the mock provider needs nothing)* | `ollama pull llama3.1:8b`, or LM Studio serving a model |

### Install & run

```powershell
git clone https://github.com/6rzan/ai-helpdesk-agent.git
cd ai-helpdesk-agent

cd backend;  npm install; cd ..
cd frontend; npm install; cd ..

# optional — every setting has a sensible default:
Copy-Item .env.example backend/.env

# terminal 1 — backend API on :3000
cd backend; npm run dev

# terminal 2 — frontend on :5173 (proxies /api to the backend)
cd frontend; npm run dev
```

Open `http://localhost:5173`, enter a display name and an organisational ID, and describe an IT problem.

Health check: `curl http://localhost:3000/api/health` → reports overall status plus LLM and database reachability.

### Configuration

All settings are environment variables (see `.env.example`); every one has a default, so the app runs with no `.env` at all.

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/helpdesk` | MongoDB connection string |
| `PORT` | `3000` | Backend port |
| `APP_MODE` | `development` | `development` \| `test` \| `demo` — `demo`/`test` enable the ticket state-transition endpoint used by tests and scripted demos |
| `LLM_PROVIDER` | `ollama` | `ollama` \| `openai_compat` \| `mock` |
| `LLM_MODEL` | `llama3.1:8b` | Model identifier for the chosen provider |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama server address |
| `LLM_BASE_URL` | — | OpenAI-compatible base URL (e.g. LM Studio: `http://127.0.0.1:1234/v1`) |
| `LLM_API_KEY` | — | API key for OpenAI-compatible servers (any non-empty value for LM Studio) |
| `LLM_TIMEOUT_MS` | `10000` | Model call timeout before degrading gracefully |
| `CONFIDENCE_THRESHOLD` | `0.7` | Minimum classification confidence to accept a category |
| `MAX_CLARIFICATION_ROUNDS` | `2` | Clarifying questions asked before escalating |
| `SESSION_INACTIVITY_MINUTES` | `30` | Chat session expiry (tickets and conversations persist) |

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/sessions` | Start or resume a session (display name + organisational ID); returns open tickets |
| `GET /api/events?sessionId=…` | SSE stream: streamed reply tokens, agent messages, ticket created/updated events |
| `POST /api/conversations/:conversationId/messages` | Send a chat message |
| `GET /api/tickets` | List the reporter's tickets with status and handling mode |
| `GET /api/tickets/:reference` | Ticket detail including full state history and conversation transcript |
| `PATCH /api/tickets/:reference/state` | Drive a state transition — available only in `demo`/`test` mode |
| `GET /api/health` | Service, database, and LLM reachability |

Full request/response contracts live in [`specs/001-conversational-ticketing-foundation/contracts/api.md`](specs/001-conversational-ticketing-foundation/contracts/api.md).

## Testing & quality

```powershell
cd backend
npm test                 # unit + integration — deterministic mock LLM, in-memory MongoDB
npm run test:benchmark   # opt-in: classification accuracy & latency against a real model
npm run tc-tables        # regenerate the formal test-case tables into docs/testing/
npm run availability-probe  # long-running availability evidence run
npm run typecheck; npm run lint

cd ../frontend
npm test                 # component tests
npm run typecheck; npm run lint
```

- The functional suites are fully deterministic — no model or database needs to be installed to run them.
- Safety-critical escalation logic was developed test-first; the state machine is unit-tested against its complete transition matrix.
- Benchmark, demo-path, and test-case evidence is captured under [`docs/testing/`](docs/testing/); design diagrams (architecture, sequence, ERD) under [`docs/design/`](docs/design/).

## Project documentation

Development is specification-first: every feature starts from a written specification with functional requirements, acceptance scenarios, and measurable success criteria, followed by an implementation plan, a data model, API contracts, and a dependency-ordered task list — all under [`specs/`](specs/). The project constitution in `.specify/memory/constitution.md` fixes the scope, the safety rules, and the quality gates every feature must pass.

## Roadmap

The current codebase is the conversational and ticketing **foundation**. Planned next, in priority order:

1. **Guided troubleshooting** — step-by-step guidance per support category, starting with password/login.
2. **Voice input** — speech transcribed to text and fed through the same conversation pipeline, with a fully local option.
3. **Staff dashboard** — web dashboard for IT staff to view tickets, take over escalated cases, and resolve them, with role-restricted access.
4. **Constrained automated remediation** — strictly whitelisted, fully audited actions against designated isolated test endpoints only.

Each arrives as its own independently testable increment; the roadmap itself may be reordered or revised by the author at any time.

## Author

**Taha Fahd Ahmed Mohammed Thabit**
B.Sc. (Hons) Computer Science — Asia Pacific University (APU)

© 2026 Taha Fahd Ahmed Mohammed Thabit. All rights reserved.
