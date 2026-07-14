# AI Help Desk Agent

Conversational IT support automation for organisations. Employees describe an issue in plain language; the agent classifies it, opens and tracks a ticket, walks through curated troubleshooting where available, and hands the case to IT staff when human attention is needed.

This is a B.Sc. (Hons) Computer Science Final Year Project at Asia Pacific University (APU): *Designing Artificial Intelligence Help Desk Agent for Organisational IT Support Automation*.

> Project status: active development. The staff dashboard and assignment workflow are implemented; the remaining Feature 004 account-history, self-service profile, settings, and import work is still in progress. Interfaces may change before the project is finalised.

## What is available now

- Natural-language IT issue reporting with automatic ticket creation and a quotable reference such as `HD-0012`.
- Six fixed support categories: password/login, network, printer, peripherals, performance, and service status.
- Deterministic, versioned troubleshooting guides. The language model interprets the user’s reply, but never invents, reorders, or skips a troubleshooting step.
- Clarification and escalation safeguards: uncertain classifications, missing guides, and explicit requests for a person all preserve the case for staff rather than silently guessing.
- Live chat and ticket updates through Server-Sent Events (SSE).
- Optional local speech-to-text input; audio is transcribed locally and discarded after transcription.
- Registration, sign-in, sign-out, password changes, and role-gated routes.
- A staff-only ticket dashboard with status/category filters, sorting, and a separate escalated-ticket group.
- Staff ticket detail with the conversation, classification context, status history, permitted status changes, takeover, reassignment, and any available reporter support profile.
- Staff availability controls and advisory workload-aware assignment suggestions. Assignment always requires a deliberate staff confirmation.

## Safety and data handling

The application does not execute commands, scripts, or remediation on employee devices. LLM output is treated as untrusted input and schema-validated against a closed category set. Ticket transitions are validated and recorded in append-only history. Staff-only endpoints require both an authenticated session and the `staff` role; no HTTP endpoint can grant that role.

Only information required to support a case is stored: account details, session information, the reported issue, ticket context, and optional support-profile data. Local voice audio is not retained after transcription.

## Architecture

```text
backend/                         Express API (TypeScript, strict)
├── src/
│   ├── api/
│   │   ├── middleware/          Request validation, auth/role guards, errors
│   │   ├── routes/              Auth, chat, tickets, staff tickets, staff roster, health
│   │   └── sse/                 Reply streaming and staff/reporter ticket events
│   ├── models/                  Mongoose schemas, including accounts, sessions,
│   │                            tickets, profiles, and staff-action records
│   ├── services/
│   │   ├── llm/                 Ollama, OpenAI-compatible, and mock providers
│   │   ├── conversation/        Chat orchestration and guided troubleshooting
│   │   ├── ticket/              Ticket lifecycle, history, and notifications
│   │   ├── auth/                Password hashing and opaque session management
│   │   └── staff/               Dashboard queries, takeover, reassignment, roster
│   └── scripts/                 Guide and staff-account seeding
└── tests/                       Vitest + Supertest integration and unit tests

frontend/                        React + Vite + Tailwind CSS SPA
├── src/
│   ├── context/                 Authentication state
│   ├── components/              Navigation, dashboard controls, assignment/profile UI
│   ├── pages/                   Chat, login, registration, staff dashboard, ticket detail
│   └── services/                Typed API client and SSE subscriptions
└── tests/                       Testing Library component/page tests

specs/                           Feature specifications, plans, tasks, and API contracts
docs/                            Design diagrams, test traceability, implementation evidence
```

## Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript 5 (`strict`) on Node.js 20+ |
| Backend | Express, Mongoose, Zod, Pino |
| Frontend | React, Vite, Tailwind CSS |
| Database | MongoDB Community Edition |
| LLM runtime | Ollama, OpenAI-compatible server, or deterministic mock |
| Realtime | Server-Sent Events |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library |

## Getting started

### Prerequisites

| Requirement | Check |
|---|---|
| Node.js 20+ | `node --version` |
| MongoDB | `mongosh --eval "db.runCommand({ping:1})"` |
| LLM runtime (optional for mock-backed development) | `ollama pull llama3.1:8b` |

For a local MongoDB container:

```powershell
docker run -d --name helpdesk-mongo -p 27017:27017 -v helpdesk-mongo-data:/data/db mongo:7
```

### Install and run

```powershell
git clone https://github.com/6rzan/ai-helpdesk-agent.git
cd ai-helpdesk-agent

cd backend; npm install; cd ..
cd frontend; npm install; cd ..

# Optional: the reference configuration has sensible defaults.
Copy-Item .env.example backend/.env

# Terminal 1: API on http://localhost:3000
cd backend; npm run dev

# Terminal 2: SPA on http://localhost:5173
cd frontend; npm run dev
```

Open `http://localhost:5173`. The health endpoint is available at `http://localhost:3000/api/health`.

## Using the application

### Employees

1. Register an account or sign in at `/register` or `/login`.
2. Open the chat and describe one IT problem in everyday language.
3. Follow the offered troubleshooting steps, ask for a person, or ask for a ticket update. Status changes appear in the conversation without a page refresh.

The conversation flow remains deliberately conservative. If the agent cannot confidently classify the issue, a guide is unavailable, or the user asks for staff, it escalates rather than improvising.

### Provisioning staff

Staff accounts are created only by a maintainer-run backend script. The script creates a new staff account with a generated initial password, or promotes an existing account to the staff role.

```powershell
cd backend
npm run seed:staff -- staff@example.com "Support Engineer"
```

The generated initial password is written to the backend log. Share it through a secure channel; the staff member should change it after first sign-in. No browser API can assign the staff role.

### Staff workflow

1. Sign in with a provisioned staff account and open **Dashboard** (`/staff`).
2. Filter tickets by status or category, choose a sort order, and check the amber escalated group first.
3. Open a ticket to review the transcript, classification, ticket history, and reporter profile when one exists.
4. Take over an unassigned escalation, or choose a roster colleague and explicitly confirm reassignment. The suggested assignee is advisory only.
5. Update the ticket status. The service records the staff action and sends a plain-language update to the reporter’s conversation.

Staff can also set their availability to `available`, `busy`, or `away` in the top navigation. Roster entries expose availability and current open-case counts to make reassignment decisions visible.

## Configuration

Copy [`.env.example`](.env.example) to `backend/.env` to override defaults. The important settings are:

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/helpdesk` | MongoDB connection string |
| `PORT` | `3000` | Backend HTTP port |
| `APP_MODE` | `development` | `development`, `test`, or `demo` |
| `LLM_PROVIDER` | `ollama` | `ollama`, `openai_compat`, or `mock` |
| `LLM_MODEL` | `llama3.1:8b` | Model identifier for the configured provider |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `LLM_TIMEOUT_MS` | `10000` | LLM timeout before fallback behaviour |
| `CONFIDENCE_THRESHOLD` | `0.7` | Minimum accepted classification confidence |
| `MAX_CLARIFICATION_ROUNDS` | `2` | Clarification limit before escalation |
| `SESSION_INACTIVITY_MINUTES` | `30` | Chat session expiry period |
| `STT_PROVIDERS` | `local` | Ordered speech-to-text provider list |
| `STT_MODEL_DIR` | `./models/stt` | Local speech-to-text model directory |
| `VOICE_MAX_SECONDS` | `120` | Voice-recording duration cap |
| `MAINTAINER_KEY` | unset | Enables and protects `/api/admin/*` |

For an OpenAI-compatible server, set `LLM_PROVIDER=openai_compat`, `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. The complete annotated reference, including speech-to-text options, is in [`.env.example`](.env.example).

Seed the six supported categories and their curated guides with:

```powershell
cd backend
npm run seed:guides
```

## API surface

All routes are prefixed with `/api`. Authenticated browser requests use the session cookie and must include credentials.

| Endpoint | Purpose |
|---|---|
| `POST /auth/register` | Create a regular user account and start a session |
| `POST /auth/login` | Sign in and set the session cookie |
| `POST /auth/logout` | End the current session |
| `GET /auth/me` | Read the current account and role |
| `POST /auth/change-password` | Change password and invalidate other sessions |
| `POST /sessions` | Start or resume a chat session |
| `GET /events?sessionId=…` | Reporter SSE stream for replies and ticket updates |
| `POST /conversations/:conversationId/messages` | Send a chat message |
| `GET /tickets/:reference` | Read a ticket available to the current chat flow |
| `GET /staff/tickets` | Staff-only dashboard list; supports status/category/escalated/sort filters |
| `GET /staff/tickets/:reference` | Staff-only full ticket detail |
| `POST /staff/tickets/:reference/status` | Staff-only status change |
| `POST /staff/tickets/:reference/takeover` | Staff-only atomic takeover of an unassigned ticket |
| `POST /staff/tickets/:reference/assignee` | Staff-only explicit reassignment |
| `GET /staff/roster` | Staff-only roster, availability, workload, and suggested assignee |
| `PUT /staff/availability` | Set the signed-in staff member’s availability |
| `GET /staff/events` | Staff-only SSE stream for ticket created/updated events |

The detailed contracts are maintained in [`specs/004-staff-dashboard/contracts/api.md`](specs/004-staff-dashboard/contracts/api.md).

## Verification

Run the checks from their respective application folders:

```powershell
cd backend
npm run typecheck
npm run lint
npm test

cd ..\frontend
npm run typecheck
npm run lint
npm test
```

Feature 004 staff-dashboard evidence and test traceability:

- [Dashboard and ticket-detail evidence](docs/implementation/staff-dashboard-us1.md)
- [Takeover and reassignment evidence](docs/implementation/staff-assignment-us2.md)
- [Staff takeover sequence diagram](docs/design/sequence-diagrams.md)
- [Chapter 5 test-case traceability](docs/testing/tc-tables.md)

## Current delivery scope

Feature 004 is being delivered incrementally. The completed scope covers account authentication, staff-role enforcement, dashboard ticket management, live staff events, takeover/reassignment, roster availability, and staff-side profile surfacing.

The following planned Feature 004 capabilities are not yet presented as complete: account-linked ticket history, end-user profile editing, user settings, and Excel/CSV import. The authoritative work breakdown is [`specs/004-staff-dashboard/tasks.md`](specs/004-staff-dashboard/tasks.md).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| API does not start | MongoDB is unavailable | Start MongoDB and verify `mongosh --eval "db.runCommand({ping:1})"` succeeds. |
| Chat requests fail | Backend is not running | Start `npm run dev` in `backend` and check `/api/health`. |
| A staff route returns 401 or 403 | Not signed in, or account lacks the staff role | Sign in with an account provisioned through `npm run seed:staff`. |
| All issues escalate as unclassified | LLM provider is unavailable | Check `/api/health`, then verify `LLM_PROVIDER`, `LLM_MODEL`, and provider URL settings. |
| Microphone is unavailable | Permission, device, or local model issue | Allow browser microphone access; verify `STT_MODEL_DIR` if local transcription fails. Typing remains available. |
| Tests initially fail while downloading MongoDB binaries | `mongodb-memory-server` is preparing its binary | Run the suite again after the download completes. |

## License

This project is **not open source**. It is published for educational, reference, portfolio, and demonstration purposes only. All rights are reserved by the copyright holder; see [LICENSE](LICENSE) for the complete terms.
