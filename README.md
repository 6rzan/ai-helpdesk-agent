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
3. **Walks the reporter through curated troubleshooting steps** for the category, one plain-language step at a time — the LLM only phrases and interprets, it never invents, reorders, or skips a step. Each reply is read against the current step: it worked and the ticket resolves; it didn't and the agent moves to the next step; the reporter asks for a person and it hands off immediately with every attempted step recorded on the ticket.
4. **Keeps the reporter informed** — every status or handling-mode change appears in the conversation immediately, in plain, jargon-free language. Users can also just ask *"what's happening with my ticket?"*.
5. **Asks instead of assuming** — low classification confidence triggers a bounded clarification exchange (two rounds by default), after which the ticket is flagged for human attention with the entire conversation attached, so nobody ever repeats themselves.
6. **Escalates on request** — saying *"can I just talk to IT staff?"* at any point hands the case to a human immediately.
7. **Degrades gracefully** — if the language model is unreachable, or a category has no guide yet, intake still works: the report is recorded as an unclassified or human-flagged ticket and the user is told it is saved.

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
│   ├── models/               Mongoose schemas: Reporter, Conversation, Message, Ticket,
│   │                         Category, Guide (versioned), GuidedSession
│   ├── services/
│   │   ├── llm/              single LLM gateway — Ollama, OpenAI-compatible, and mock
│   │   │                     providers behind one interface; no other module touches a model
│   │   ├── classification/   classification prompt + confidence policy (data-driven categories)
│   │   ├── category/         live category catalogue (mandated six + maintainer-added)
│   │   ├── guidance/         deterministic step state machine + maintainer guide/category admin service
│   │   ├── conversation/     chat orchestration: greeting, clarification, streaming replies,
│   │   │                     guided-flow start/advance/resolve/escalate
│   │   ├── ticket/           reference counter, creation, state machine, notifications
│   │   ├── escalation/       escalation decision rules (developed test-first)
│   │   └── session/          lightweight session + reporter identity
│   ├── api/
│   │   ├── routes/           sessions, conversations, tickets, health, admin-guides (maintainer-only)
│   │   ├── sse/              Server-Sent Events: token streaming + live ticket updates
│   │   └── middleware/       zod request validation, error envelope, maintainer auth
│   └── lib/                  structured logging (pino), typed errors, clock/id helpers
├── tests/                    unit + integration (in-memory MongoDB, deterministic mock LLM)
│   └── benchmark/            opt-in accuracy & latency suite against a real model
└── scripts/                  test-case table generator, 24-hour availability probe, guide seeding

frontend/                     React + Vite + Tailwind CSS chat SPA
├── src/
│   ├── components/           MessageBubble, TicketCard, StatusBadge, SessionForm, QuickReplies, …
│   ├── pages/                single chat page (identify → converse → guided steps)
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
- **Guidance is data, not model output** — troubleshooting steps live in versioned `Guide` documents; the LLM only classifies which step outcome the reporter meant (worked / didn't work / already tried / question / wants a person / unclear). It never chooses, invents, reorders, or omits a step. Each `GuidedSession` pins the exact guide version it started with, so a maintainer publishing a new version mid-session never changes what an in-flight reporter sees.

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

#### Installing MongoDB

The backend expects a MongoDB instance at `MONGODB_URI` (default `mongodb://127.0.0.1:27017/helpdesk`, see [Configuration](#configuration)) and will hang on startup — never binding its HTTP port — until it can connect. Pick one option:

**Option A — Docker (fastest, no local install):**
```powershell
docker run -d --name helpdesk-mongo -p 27017:27017 -v helpdesk-mongo-data:/data/db mongo:7
```
Re-run `docker start helpdesk-mongo` after a reboot (data persists in the named volume).

**Option B — MongoDB Community Server (native Windows service):**
1. Download the installer from the [MongoDB Community download page](https://www.mongodb.com/try/download/community) and run it, choosing "Install as a Service" (this starts it automatically on boot).
2. Verify it's running: `Get-Service MongoDB` should show `Running`.

**Option C — winget:**
```powershell
winget install MongoDB.Server
```

After any option, confirm with `mongosh --eval "db.runCommand({ping:1})"` before starting the backend.

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

## How to use

> This section is kept current: it is updated every time a feature ships.

### 1. The first screen — identifying yourself

The app asks for two things before the chat opens:

| Field | What to enter | Rules | Examples |
|---|---|---|---|
| **Organisation ID** | Any identifier for the team/company you're reporting under. There is no registration — the first use of an ID creates it. Reusing the same ID (with the same name) later brings back your open tickets. | 3–32 characters; letters, digits, `.`, `_`, `-` only; no spaces | `apu-demo`, `acme.it`, `dept_042` |
| **Display name** | The name the agent should call you. | 1–60 characters | `Taha`, `Sarah K.` |

For a quick local try-out, `demo-org` + your first name is all you need.

### 2. Reporting a problem

Type the problem the way you'd tell a colleague — no forms, no keywords required. One problem per message works best. Examples that map to each support category:

| You type… | Category |
|---|---|
| "I can't log into my account, it says my password is wrong" | Password / login |
| "The Wi-Fi keeps dropping every few minutes" | Internet & network connectivity |
| "The printer on the 3rd floor says paper jam but there is no jam" | Printer |
| "My second monitor is flickering and goes black" | Peripheral devices |
| "My laptop takes five minutes to open anything" | Slow device performance |
| "Is the file server down right now?" | Basic service status |

The agent replies in the chat, opens a ticket automatically, shows you its reference (e.g. `HD-0012`), and — for the categories above — immediately starts walking you through the first troubleshooting step in the same reply. If it isn't confident about the category it asks a clarifying question instead of guessing; after two rounds it hands the case to a human with the whole conversation attached.

### 3. Working through the guided steps

Each step appears as a labelled message (*"Step 1 of 3: …"*) with three quick-reply chips underneath: **That worked**, **Didn't work**, and **Talk to a human**. You can tap a chip or just type your own words — "yep, fixed it", "still broken", "already tried that", or a question about the step all work the same way.

| You do… | What happens |
|---|---|
| It worked | The ticket is marked *Resolved* right away |
| It didn't work / already tried it | The agent records the attempt and moves to the next step |
| No steps are left | The agent stops and escalates to a person, with every attempted step on the ticket |
| You ask a question about the step | The agent answers and stays on the same step — nothing is skipped |
| You ask for a person at any point | Guidance stops immediately and the case escalates with whatever was attempted so far |

If a category has no guide yet, or the agent can't confidently tell what you meant, it escalates rather than guessing — you're never shown another category's steps.

### 4. Talking to the agent after that

| You want to… | Just say… |
|---|---|
| Check progress | "What's happening with my ticket?" or "Any update on HD-0012?" |
| Reach a human | "Can I just talk to IT staff?" — escalates immediately |
| Confirm a fix | When a ticket is marked *Resolved* the agent asks; reply "yes, it's fixed" to close it |
| Reopen | "It's still broken" — reopens the resolved ticket |
| Withdraw | "Never mind, it fixed itself" |

Status changes (Open → In Progress → Resolved → Closed) appear in the conversation in real time — no refreshing.

### 5. Voice input

Click the **microphone button** next to the message box:

- Speak your report (up to **2 minutes**; a warning appears 15 seconds before the cap, then recording stops on its own).
- Click stop, and the transcript appears **as an editable draft** — nothing is sent until you press send, so you can fix names or wording first, or clear it and start over.
- You can mix typing and voice: type half a sentence, record the rest, and it lands in the same draft.
- Audio is transcribed **locally** and discarded immediately — only the final text is stored.

Voice needs a one-time model download (~700 MB, gitignored): get the *sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8* export from the sherpa-onnx releases and extract it into `backend/models/stt/` (exact URL pinned in `.env.example`). Without it, the mic button degrades gracefully — typing always works. Full setup detail: [`specs/002-voice-input/quickstart.md`](specs/002-voice-input/quickstart.md).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Page loads but sending a message fails / spinner forever | Backend not running or not on `:3000` | Start `cd backend; npm run dev`; check `curl http://localhost:3000/api/health` |
| "Organisation ID" rejected on the first screen | Invalid characters or length | 3–32 chars, only letters/digits/`.`/`_`/`-`, no spaces — e.g. `demo-org` |
| Backend hangs on start (no "server started" log, port never binds) | MongoDB not running | See [Installing MongoDB](#installing-mongodb); once running, `mongosh --eval "db.runCommand({ping:1})"` should succeed |
| Every report becomes an unclassified, human-flagged ticket | LLM unreachable (this is the designed fallback) | Check the `llm` field in `/api/health`; start Ollama / LM Studio, verify `LLM_PROVIDER`, `LLM_MODEL`, and `OLLAMA_URL`/`LLM_BASE_URL` in `backend/.env` |
| LM Studio specifically not answering | Wrong base URL or no model loaded | `LLM_PROVIDER=openai_compat`, `LLM_BASE_URL=http://127.0.0.1:1234/v1`, any non-empty `LLM_API_KEY`, and a model actually loaded in LM Studio |
| Mic button shows "The microphone is not available" | Browser permission denied or no input device | Allow microphone access for `localhost:5173` in the browser's site settings; typing is unaffected |
| Recording works but transcription returns an error (503) | STT model files missing | Download the model into `backend/models/stt/` (see *Voice input* above); confirm `STT_MODEL_DIR` points at it |
| Transcript comes back empty | Silence or no speech detected | The agent says so explicitly — try again closer to the mic, or type instead |
| Port already in use (`3000` or `5173`) | Another process holding the port | `netstat -ano | findstr :3000` then stop that process, or change `PORT` in `backend/.env` |
| Tests fail with worker/network errors on first run | `mongodb-memory-server` downloading its binary | Re-run once the download completes; no real MongoDB is needed for tests |
| A category has no troubleshooting steps / every report in it escalates straight away | No active guide for that category | Run `npm run seed:guides` (backend) to seed the mandated six, or publish one via the maintainer admin API |
| `/api/admin/*` returns 404 | `MAINTAINER_KEY` not set | Set `MAINTAINER_KEY` in `backend/.env` and restart the backend — the routes don't exist at all until it's set |
| `/api/admin/*` returns 401 | Missing/wrong `x-maintainer-key`, or `x-maintainer-name` header missing | Send both headers on every admin request; the key must match `MAINTAINER_KEY` exactly |

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
| `STT_PROVIDERS` | `local` | Speech-to-text provider order: `local` and/or `openai_compat` (comma-separated) |
| `STT_MODEL_DIR` | `./models/stt` | Directory holding the local STT model files |
| `STT_OPENAI_BASE_URL` | — | OpenAI-compatible STT fallback (e.g. a whisper.cpp server) |
| `VOICE_MAX_SECONDS` | `120` | Recording duration cap; keep frontend `VITE_VOICE_MAX_SECONDS` in sync |
| `MAINTAINER_KEY` | *(unset)* | Enables and guards `/api/admin/*` (category + guide management); routes aren't mounted at all while unset |

Seed the mandated six categories with their curated troubleshooting guides (idempotent, safe to re-run):

```powershell
cd backend
npm run seed:guides
```

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/sessions` | Start or resume a session (display name + organisational ID); returns open tickets |
| `GET /api/events?sessionId=…` | SSE stream: streamed reply tokens, agent messages, ticket created/updated events |
| `POST /api/conversations/:conversationId/messages` | Send a chat message (carries `inputOrigin`: typed / voice / mixed) |
| `POST /api/sessions/:sessionId/transcriptions` | Transcribe a recorded voice clip to text (audio is never persisted) |
| `GET /api/tickets` | List the reporter's tickets with status and handling mode |
| `GET /api/tickets/:reference` | Ticket detail including full state history and conversation transcript |
| `PATCH /api/tickets/:reference/state` | Drive a state transition — available only in `demo`/`test` mode |
| `GET /api/health` | Service, database, and LLM reachability |

Ticket detail additionally carries a `guidance` block (category, pinned guide version, session state, and every attempted step with its outcome) whenever a guided session exists for that ticket. Guided-flow behaviour rides the existing message and SSE endpoints above — there are no separate chat endpoints for it.

Full request/response contracts live in [`specs/001-conversational-ticketing-foundation/contracts/api.md`](specs/001-conversational-ticketing-foundation/contracts/api.md) and [`specs/003-guided-troubleshooting/contracts/api.md`](specs/003-guided-troubleshooting/contracts/api.md).

### Maintainer admin API

Credential-guarded, headless management of categories and their guides — no UI, `MAINTAINER_KEY` required (see *Configuration* above). Every request needs `x-maintainer-key: <MAINTAINER_KEY>` and a non-empty `x-maintainer-name` header.

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/categories` | List all categories (mandated + custom, including retired) with their active guide version |
| `POST /api/admin/categories` | Add a category with its initial guide (v1, active) |
| `PUT /api/admin/categories/:name` | Edit `displayName` / `classificationDescription` (name and mandated flag are immutable) |
| `DELETE /api/admin/categories/:name` | Soft-retire a custom category — the mandated six can't be deleted |
| `POST /api/admin/categories/:name/guide` | Publish a new guide version (previous version deactivates atomically; sessions already in flight keep the version they started on) |
| `GET /api/admin/categories/:name/guide/versions` | Full guide version history for a category |

Full contract, status codes, and error codes: [`specs/003-guided-troubleshooting/contracts/api.md`](specs/003-guided-troubleshooting/contracts/api.md).

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

The current codebase is the conversational and ticketing **foundation** plus **voice input** and **guided troubleshooting** (✅ both shipped — speech transcribed fully locally, and step-by-step guidance across all six support categories with a maintainer admin API for managing categories and guides). Planned next, in priority order:

1. **Staff dashboard & user accounts** — web dashboard for IT staff to view tickets, take over escalated cases, and resolve them, with role-restricted access. Includes user accounts with self-service profiles: users sign in and maintain their own support details (remote-access ID such as TeamViewer/UltraViewer, location/desk, hardware), IT staff can append further details to any user's profile, and escalated tickets surface the reporter's profile automatically so staff never have to search for a user's location, machine, or remote-access ID.
2. **Constrained automated remediation** — strictly whitelisted, fully audited actions against designated isolated test endpoints only.

Each arrives as its own independently testable increment; the roadmap itself may be reordered or revised by the author at any time.

## Author

**Taha Fahd Ahmed Mohammed Thabit**
B.Sc. (Hons) Computer Science — Asia Pacific University (APU)

© 2026 Taha Fahd Ahmed Mohammed Thabit. All rights reserved.
