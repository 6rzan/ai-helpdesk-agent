# AI Help Desk Agent

Conversational IT support automation for organisations. Employees describe an issue in plain language; the agent classifies it, opens and tracks a ticket, walks through curated troubleshooting where available, and hands the case to IT staff when human attention is needed.

This is a B.Sc. (Hons) Computer Science Final Year Project at Asia Pacific University (APU): *Designing Artificial Intelligence Help Desk Agent for Organisational IT Support Automation*.

> Project status: active development. Feature 004 — account authentication, the two-role model, staff dashboard, assignment, profiles, settings, and Excel import workflows — is implemented and its quality gates pass. Feature 005 — constrained automated remediation against a whitelisted set of read-only and state-changing actions, with consent, staff approval, an immutable audit trail, a kill switch, and outcome metrics — is implemented and its quality gates pass. Interfaces may change before the project is finalised.

## What is available now

**Reporting and troubleshooting**

- Natural-language IT issue reporting with automatic ticket creation and a quotable reference such as `HD-0012`.
- Six seeded support categories — password/login, network, printer, peripherals, performance, and service status — plus `unclassified` as the safety fallback. Categories are stored in the database, not hardcoded: a maintainer can add, edit, or retire one through the admin API and classification picks it up without a code change.
- Deterministic, versioned troubleshooting guides. The language model interprets the user’s reply, but never invents, reorders, or skips a troubleshooting step.
- Clarification and escalation safeguards: uncertain classifications, missing guides, and explicit requests for a person all preserve the case for staff rather than silently guessing.
- Live chat and ticket updates through Server-Sent Events (SSE).
- Optional local speech-to-text input; audio is transcribed locally and discarded after transcription.

**Accounts and roles**

- Two account roles: `user` (default for every registration) and `staff`. Registration, sign-in, sign-out, password changes, and role-gated routes are implemented on both the API and the SPA.
- Sessions are opaque server-side tokens carried in an HTTP-only cookie. Changing a password invalidates every other session for that account.
- The `staff` role is granted **only** by the maintainer-run `seed:staff` script. No HTTP endpoint, including the staff and maintainer surfaces, can promote an account.

**Employee self-service**

- Personal ticket history at `/tickets`, scoped to the signed-in account, with a per-ticket detail view and its own SSE stream.
- A self-service support profile (remote-access IDs, location, hardware notes) that staff see on escalated tickets, plus an account settings page.

**Staff workspace**

- A staff-only ticket dashboard with status/category filters, sorting, and a separate escalated-ticket group.
- Staff ticket detail with the conversation, classification context, status history, permitted status changes, takeover, reassignment, and any available reporter support profile.
- Staff availability controls and advisory workload-aware assignment suggestions. Assignment always requires a deliberate staff confirmation.
- Staff-appended profile notes and corrections on a reporter’s profile, and an initial-password reset that revokes that account’s sessions.
- Excel (`.xlsx`) user import with column mapping, a dry-run preview, and a transactional apply step. Every staff action is written to an append-only `StaffActionRecord` audit trail.

**Constrained automated remediation**

- A whitelisted set of read-only and state-changing diagnostic actions, defined as versioned policy data rather than executor code, each scoped to a specific issue category and a specific test endpoint.
- Every proposed action is matched against that whitelist by a default-deny policy engine before anything runs. There is no code path from an LLM proposal straight to execution.
- Read-only actions execute the moment the reporter consents; state-changing actions additionally wait on a staff approval decision. A decline, an expiry, or a policy mismatch is refused and recorded, never a silent no-op or a hard error.
- Every executed **and** every refused action is written to an append-only `ActionRecord`, visible per-ticket to the reporter (plain language) and cross-ticket to staff (full detail, filterable) at **Audit trail** (`/staff/audit`).
- An asymmetric kill switch — global or per-endpoint — at **Automation** (`/staff/remediation`) lets staff disable remediation instantly; a disabled state is visible everywhere it matters and blocks new proposals immediately.
- An ordered LLM provider fallback chain: if the primary provider is unavailable, the request retries against the next configured provider. No action is ever executed on a classification produced while the model was in a degraded fallback state — that proposal is refused and audited instead of offered.
- Outcome metrics (attempted/succeeded/refused/failed, by category and endpoint) for a selectable period at **Metrics** (`/staff/metrics`), including an explicit no-data state.

## Safety and data handling

The application does not execute arbitrary commands. Automated remediation is limited to a small, versioned whitelist of actions (`backend/src/policy/action-policy.json`) against dedicated, isolated test endpoints (`backend/test-endpoints/`) — never against employee devices or production infrastructure. Every action is default-denied unless it matches the whitelist exactly; read-only actions still require reporter consent, and state-changing actions additionally require staff approval before anything runs. The feature is off by default (`REMEDIATION_ENABLED=false`) and can be disabled globally or per-endpoint at any time from the staff automation kill switch. LLM output is treated as untrusted input throughout: it is schema-validated, and a returned category is accepted only if it matches an active category in the database — anything else falls back to `unclassified` and escalates. Ticket transitions are validated and recorded in append-only history.

Staff-only endpoints require both an authenticated session and the `staff` role; no HTTP endpoint can grant that role. The maintainer admin surface is a separate axis: it is mounted only when `MAINTAINER_KEY` is configured, and is protected by a constant-time key comparison rather than by a session — it does not touch accounts or roles at all.

Only information required to support a case is stored: account details, session information, the reported issue, ticket context, and optional support-profile data. Local voice audio is not retained after transcription.

## Architecture

```text
backend/                         Express API (TypeScript, strict)
├── src/
│   ├── api/
│   │   ├── middleware/          Validation, session/role guards, maintainer key, errors
│   │   ├── routes/              Auth, chat, tickets, own tickets/profile, staff tickets,
│   │   │                        staff roster/users/imports, staff actions/approvals/
│   │   │                        remediation/metrics, admin guides, health
│   │   └── sse/                 Reporter, own-ticket, and staff event streams
│   ├── models/                  Mongoose schemas: accounts, auth sessions, tickets,
│   │                            conversations, categories, guides, support profiles,
│   │                            profile imports, staff-action records, action records,
│   │                            approval requests, remediation settings, provider
│   │                            fallback events
│   ├── policy/                  Versioned action whitelist and endpoint registry
│   │                            (action-policy.json, test-endpoints.json) plus schema
│   │                            validation and the runtime loader
│   ├── services/
│   │   ├── llm/                 Ollama, OpenAI-compatible, mock, and chained
│   │   │                        (ordered-fallback) providers — the only module
│   │   │                        permitted to call a model directly
│   │   ├── classification/      Category classification against the active category set
│   │   ├── conversation/        Chat orchestration and guided troubleshooting
│   │   ├── guidance/, guide/    Step interpretation and versioned guide administration
│   │   ├── category/            Runtime category registry
│   │   ├── escalation/          Escalation rules and reasons
│   │   ├── ticket/              Ticket lifecycle, history, and notifications
│   │   ├── auth/                Password hashing and opaque session management
│   │   ├── session/             Chat-session lifecycle and inactivity expiry
│   │   ├── profile/             Self-service and staff-appended support profiles
│   │   ├── import/              Excel parsing, mapping, preview, transactional apply
│   │   ├── staff/               Dashboard queries, takeover, reassignment, roster
│   │   ├── stt/                 Local and OpenAI-compatible speech-to-text
│   │   ├── agent/               Tool-calling loop and remediation tool definitions
│   │   ├── remediation/         Default-deny policy engine, SSH executor, consent,
│   │   │                        approvals, availability (kill switch), audit
│   │   └── metrics/             Outcome metrics aggregation
│   └── scripts/                 Guide/category and staff-account seeding
├── test-endpoints/              Isolated Dockerised SSH endpoints remediation runs
│                                against (never employee devices), plus the reset
│                                and host-key-capture scripts used before a demo
└── tests/                       Vitest + Supertest integration and unit tests

frontend/                        React + Vite + Tailwind CSS SPA
├── src/
│   ├── context/                 Authentication state
│   ├── components/              Navigation, route guards, dashboard/assignment/profile UI
│   │   └── staff/               Approval queue, audit trail, metrics band/summary,
│   │                            remediation (kill switch) controls, ticket list
│   ├── pages/                   Chat, login, registration, my tickets, profile, settings
│   │   └── staff/               Dashboard, ticket detail, user profile, Excel import,
│   │                            approvals, audit, remediation (kill switch), metrics
│   ├── lib/                     Shared types
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
| LLM runtime | Ollama, OpenAI-compatible server, or deterministic mock, in an ordered fallback chain |
| Realtime | Server-Sent Events |
| Remediation | `ssh2` against a versioned action whitelist and endpoint registry |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library |

## Getting started

### Prerequisites

| Requirement | Check |
|---|---|
| Node.js 20+ | `node --version` |
| MongoDB | `mongosh --eval "db.runCommand({ping:1})"` |
| LLM runtime (optional for mock-backed development) | `ollama pull llama3.1:8b` |
| Docker Desktop with the WSL2 backend (only if exercising remediation) | `docker compose version` |

Feature 004's Excel Import **Apply** operation uses a MongoDB transaction. Run the
local demo database as a single-node replica set (not a standalone `mongod`):

```powershell
docker run -d --name helpdesk-mongo -p 27017:27017 -v helpdesk-mongo-data:/data/db mongo:7 --replSet rs0 --bind_ip_all
docker exec helpdesk-mongo mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
docker exec helpdesk-mongo mongosh --quiet --eval "db.hello().isWritablePrimary"
```

The final command must print `true` before starting the backend. The reference
`MONGODB_URI` includes `?replicaSet=rs0`; use the same suffix for a locally installed
MongoDB service after starting it with `--replSet rs0`. Existing standalone databases
can still run ordinary chat and dashboard flows, but Import Apply deliberately returns
MongoDB code 20 because atomic imports are not safe without transactions.

Automated remediation targets a pair of isolated, disposable Docker containers rather
than any real machine. Bring them up (and reset them to a known baseline, e.g. before a
demo) with the single reset script, which also generates the SSH client keypair and
captures each container's host key fingerprint into the pinned endpoint registry:

```powershell
powershell -File backend/test-endpoints/reset.ps1
```

Set `REMEDIATION_SSH_KEY_PATH` and `REMEDIATION_ENABLED=true` as printed by the script
(see [Configuration](#configuration)). Skip this step entirely if you only want the
chat/dashboard/import feature set — remediation is off by default.

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

### Roles at a glance

| Role | How it is obtained | What it unlocks |
|---|---|---|
| `user` | Assigned automatically to every registration. `POST /auth/register` hardcodes it and ignores any role supplied in the request body. | Chat, own ticket history, own support profile, account settings |
| `staff` | The maintainer-run `npm run seed:staff` script only. | Everything a `user` can do, plus `/staff` dashboard, ticket detail, takeover/reassignment, roster, reporter profiles, credential resets, and Excel import |
| maintainer | Not an account. A shared `MAINTAINER_KEY` sent as a request header. | Category and guide administration at `/api/admin` — cannot read tickets or alter accounts |

### Employees

1. Register an account or sign in at `/register` or `/login`.
2. Open the chat and describe one IT problem in everyday language.
3. Follow the offered troubleshooting steps, ask for a person, or ask for a ticket update. Status changes appear in the conversation without a page refresh.
   - When the agent proposes a whitelisted diagnostic action, it explains in plain language what will run and where, and waits for explicit consent in the chat before doing anything. Declining is always safe: it is refused and recorded, never a hard error. Read-only actions run the moment consent is granted; state-changing actions additionally wait on a staff approval decision, and the reporter is told which is happening.
4. Review past cases under **My tickets** (`/tickets`), which lists only tickets reported by the signed-in account. Each ticket's detail view includes its own action history: every attempted action and its outcome, in plain language.
5. Fill in the support profile at `/profile` — remote-access tool IDs, location, hardware notes — so staff have that context on escalation. Change the account password at `/settings`.

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

6. Decide state-changing action requests at **Approvals** (`/staff/approvals`): approve to execute, or decline with an optional reason. Both surfaces update live for every open staff tab the instant anyone decides.
7. Review every attempted and refused action across all tickets, filterable by ticket, endpoint, and outcome, at **Audit trail** (`/staff/audit`). It is append-only: there is no edit or delete affordance anywhere in this surface.
8. Turn automated remediation off — globally or for one endpoint — at **Automation** (`/staff/remediation`). The toggle takes effect immediately and blocks new proposals across every session.
9. Review attempted/succeeded/refused/failed action counts by category and endpoint, for a selectable period, at **Metrics** (`/staff/metrics`).

On a reporter's profile page (`/staff/users/:accountId/profile`) staff can append notes or corrections without overwriting what the employee entered, and issue a new initial password — which immediately revokes that account's sessions and forces a change at next sign-in. Bulk profile data is loaded through **Import** (`/staff/import`): upload an `.xlsx` workbook, map its columns, review the dry-run preview, then apply. Apply runs in a MongoDB transaction and therefore requires a replica-set deployment (see Prerequisites). Every one of these actions is recorded in the staff-action audit trail.

## Configuration

Copy [`.env.example`](.env.example) to `backend/.env` to override defaults. The important settings are:

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/helpdesk?replicaSet=rs0` | Replica-set-capable MongoDB connection string required for transactional import Apply |
| `PORT` | `3000` | Backend HTTP port |
| `APP_MODE` | `development` | `development`, `test`, or `demo` |
| `LLM_PROVIDER` | `ollama` | `ollama`, `openai_compat`, or `mock`. Used when `LLM_PROVIDERS` is unset. |
| `LLM_PROVIDERS` | unset | Comma-separated ordered fallback chain, e.g. `openai_compat,ollama,mock`. Falls back to `LLM_PROVIDER` if unset, empty, or naming an unrecognised provider. A single unrecognised entry is treated the same way (no silent partial chain). |
| `LLM_MODEL` | `llama3.1:8b` | Model identifier for the configured provider |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `LLM_TIMEOUT_MS` | `10000` | LLM timeout before fallback behaviour |
| `CONFIDENCE_THRESHOLD` | `0.7` | Minimum accepted classification confidence |
| `MAX_CLARIFICATION_ROUNDS` | `2` | Clarification limit before escalation |
| `SESSION_INACTIVITY_MINUTES` | `30` | Chat session expiry period |
| `STT_PROVIDERS` | `local` | Ordered speech-to-text provider list |
| `STT_MODEL_DIR` | `./models/stt` | Local speech-to-text model directory |
| `VOICE_MAX_SECONDS` | `120` | Voice-recording duration cap |
| `REMEDIATION_ENABLED` | `false` | Master kill switch for automated remediation. Staff can additionally disable it at runtime, globally or per-endpoint, without restarting. |
| `AGENT_MAX_STEPS` | `3` | Maximum tool-calling steps the remediation agent takes per proposal |
| `REMEDIATION_SSH_KEY_PATH` | `./.keys/remediation_id_ed25519` | Path to the SSH client private key used against the whitelisted test endpoints |
| `REMEDIATION_SSH_KEY_PASSPHRASE` | unset | Passphrase for the SSH client key, if it has one |
| `REMEDIATION_CONNECT_TIMEOUT_MS` | `5000` | SSH connection timeout |
| `REMEDIATION_COMMAND_TIMEOUT_MS` | `15000` | Remote command execution timeout |
| `REMEDIATION_APPROVAL_TTL_MINUTES` | `30` | How long a state-changing action waits for staff approval before it expires and is refused |
| `MAINTAINER_KEY` | unset | Enables and protects `/api/admin/*`. Leave unset and the admin routes are never mounted. |

For an OpenAI-compatible server, set `LLM_PROVIDER=openai_compat`, `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. The complete annotated reference, including speech-to-text options, is in [`.env.example`](.env.example).

For the local reference setup, LM Studio can serve `qwen2.5-7b-instruct` at `http://127.0.0.1:1234/v1` for chat and `text-embedding-nomic-embed-text-v1.5` for future semantic retrieval. The current application does not yet make embedding requests, so the embedding model should remain configured separately from the chat model.

Seed the six baseline categories and their curated guides with:

```powershell
cd backend
npm run seed:guides
```

This populates the `categories` collection. Further categories and guide versions are managed at runtime through the maintainer API rather than by editing the seed script — set `MAINTAINER_KEY`, restart the backend, and use the `/api/admin` endpoints listed below.

The remediation action whitelist and endpoint registry are versioned data files, not code: [`backend/src/policy/action-policy.json`](backend/src/policy/action-policy.json) and [`backend/src/policy/test-endpoints.json`](backend/src/policy/test-endpoints.json). No SSH key material is ever committed — `backend/.keys/` and the test endpoints' `authorized_keys` files are git-ignored, regenerated build inputs produced by `backend/test-endpoints/reset.ps1`.

## API surface

All routes are prefixed with `/api`. Authenticated browser requests use the session cookie and must include credentials. Access column: **public** = no session, **user** = any signed-in account, **staff** = signed-in *and* `staff` role, **maintainer** = `x-maintainer-key` header.

### Authentication

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /auth/register` | public | Create a `user` account and start a session |
| `POST /auth/login` | public | Sign in and set the session cookie |
| `POST /auth/logout` | user | End the current session |
| `GET /auth/me` | user | Read the current account and role |
| `POST /auth/change-password` | user | Change password and invalidate all other sessions |

### Chat and troubleshooting

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /sessions` | public | Start or resume a chat session |
| `POST /conversations/:conversationId/messages` | public | Send a chat message |
| `POST /sessions/:sessionId/transcriptions` | public | Upload audio for local speech-to-text |
| `GET /tickets?sessionId=…` | public | List tickets belonging to the current chat session |
| `GET /tickets/:reference?sessionId=…` | public | Read a ticket available to the current chat flow |
| `GET /tickets/:reference/actions?sessionId=…` | public | Plain-language action history and any approval requests for one ticket |
| `POST /tickets/:reference/actions/consent?sessionId=…` | public | Grant or decline consent for one proposed action. A read-only grant executes immediately; a decline is refused and recorded, never a hard error. |
| `GET /events?sessionId=…` | public | Reporter SSE stream for replies and ticket updates |
| `GET /health` | public | Liveness plus LLM/database readiness |

### Signed-in employee

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /my/tickets` | user | Ticket history for the signed-in account |
| `GET /my/tickets/:reference` | user | Own-ticket detail; other accounts' tickets are refused |
| `GET /my/profile` | user | Read the own support profile |
| `PUT /my/profile` | user | Update remote-access IDs, location, or hardware notes |
| `GET /my/events` | user | SSE stream for the signed-in account's tickets |

### Staff

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /staff/tickets` | staff | Dashboard list; supports status/category/escalated/sort filters |
| `GET /staff/tickets/:reference` | staff | Full ticket detail |
| `POST /staff/tickets/:reference/status` | staff | Status change |
| `POST /staff/tickets/:reference/takeover` | staff | Atomic takeover of an unassigned ticket |
| `POST /staff/tickets/:reference/assignee` | staff | Explicit reassignment |
| `GET /staff/roster` | staff | Roster, availability, workload, and suggested assignee |
| `PUT /staff/availability` | staff | Set the signed-in staff member’s availability |
| `GET /staff/users/:id/profile` | staff | Read a reporter’s support profile |
| `POST /staff/users/:id/profile/entries` | staff | Append a staff note or correction to a profile |
| `GET /staff/users/:id/credentials` | staff | Whether the account is still on its initial password |
| `POST /staff/users/:id/credentials/reset` | staff | Set a new initial password and revoke that account's sessions |
| `POST /staff/imports` | staff | Upload an `.xlsx` workbook and detect its columns |
| `PUT /staff/imports/:id/mapping` | staff | Map spreadsheet columns to profile fields |
| `POST /staff/imports/:id/preview` | staff | Dry-run the import and report per-row outcomes |
| `POST /staff/imports/:id/apply` | staff | Commit the import inside a MongoDB transaction |
| `GET /staff/actions` | staff | Cross-ticket audit trail; filterable by ticket, endpoint, outcome, and date range, paginated |
| `GET /staff/approvals?status=…` | staff | Approval queue; `pending` by default, or filtered by status. Past-due `pending` rows lazily transition to `expired` first. |
| `POST /staff/approvals/:id/approve` | staff | Approve a pending state-changing action; executes it |
| `POST /staff/approvals/:id/decline` | staff | Decline a pending state-changing action; never executes |
| `GET /staff/remediation` | staff | Read the current automation kill-switch state, global and per-endpoint |
| `POST /staff/remediation/toggle` | staff | Enable or disable automation, globally or for one endpoint |
| `GET /staff/metrics?period=…` | staff | Attempted/succeeded/refused/failed action counts by category and endpoint for a selectable period |
| `GET /staff/events` | staff | SSE stream for ticket created/updated events, action recorded, approval pending/decided, and remediation availability changed |

### Maintainer

Mounted at `/api/admin` and only when `MAINTAINER_KEY` is set — otherwise the routes are absent, not merely guarded. Requires `x-maintainer-key` and `x-maintainer-name` headers.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /admin/categories` | maintainer | List categories with their active guide version |
| `POST /admin/categories` | maintainer | Create a category and its first guide |
| `PUT /admin/categories/:name` | maintainer | Update category metadata |
| `DELETE /admin/categories/:name` | maintainer | Retire a category |
| `POST /admin/categories/:name/guide` | maintainer | Publish a new guide version |
| `GET /admin/categories/:name/guide/versions` | maintainer | List guide version history |

A `PATCH /test-support/...` router is additionally mounted when `APP_MODE` is `test` or `demo`. It is absent in `development` and production.

The detailed contracts are maintained in [`specs/004-staff-dashboard/contracts/api.md`](specs/004-staff-dashboard/contracts/api.md) and, for the remediation routes, [`specs/005-constrained-remediation/contracts/api.md`](specs/005-constrained-remediation/contracts/api.md).

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

The backend suite excludes `tests/benchmark/` by default; run those separately with `npm run test:benchmark`. Last observed on 2026-08-19:

| Gate | Result |
|---|---|
| Backend typecheck / lint | PASS / PASS (0 errors) |
| Backend Vitest | PASS — 76 files, 420 tests |
| Frontend typecheck | PASS |
| Frontend Vitest | PASS — 133 tests |

Role and access control specifically are covered by `tests/integration/access-control.test.ts`, `tests/integration/my-tickets.test.ts` (own-ticket isolation), and `tests/integration/test-support-guard.test.ts`. The default-deny remediation policy engine, the immutability of the audit trail, and the degraded-model refusal path are covered by `tests/unit/policy-engine.test.ts`, `tests/integration/audit-trail-view.test.ts`, and `tests/integration/degraded-model-remediation.test.ts`, among others.

Feature 004 staff-dashboard evidence and test traceability:

- [Dashboard and ticket-detail evidence](docs/implementation/staff-dashboard-us1.md)
- [Takeover and reassignment evidence](docs/implementation/staff-assignment-us2.md)
- [Staff takeover sequence diagram](docs/design/sequence-diagrams.md)
- [Chapter 5 test-case traceability](docs/testing/tc-tables.md)

## Current delivery scope

Feature 004 covers account authentication, staff-role enforcement, dashboard ticket management, live events, takeover/reassignment, roster availability, account-linked ticket history, self-service profiles/settings, staff profile actions, and Excel user import. See [`specs/004-staff-dashboard/tasks.md`](specs/004-staff-dashboard/tasks.md) and the [UAT record](docs/testing/feature-004-uat.md).

Feature 005 covers constrained automated remediation: the versioned action whitelist and default-deny policy engine, the SSH executor against isolated test endpoints, per-proposal reporter consent, staff approval for state-changing actions, the immutable action audit trail, the global/per-endpoint kill switch, outcome metrics, and the ordered LLM provider fallback chain with degraded-model refusal. See [`specs/005-constrained-remediation/tasks.md`](specs/005-constrained-remediation/tasks.md).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| API does not start | MongoDB is unavailable | Start MongoDB and verify `mongosh --eval "db.runCommand({ping:1})"` succeeds. |
| Import Apply reports MongoDB code 20 or “Transaction numbers are only allowed…” | MongoDB is running standalone | Start the single-node `rs0` setup above, confirm `db.hello().isWritablePrimary` is `true`, then set `MONGODB_URI` with `?replicaSet=rs0` and restart the backend. |
| Chat requests fail | Backend is not running | Start `npm run dev` in `backend` and check `/api/health`. |
| A staff route returns 401 or 403 | 401 = no valid session cookie; 403 = signed in but the account role is `user` | For 401, sign in again (the cookie may have expired, or the request omitted credentials). For 403, provision or promote the account with `npm run seed:staff` and sign in again so the session reflects the new role. |
| `/staff` shows “This area is only available to IT staff.” | The SPA route guard read `role: "user"` from `GET /auth/me` | Same fix as above. The guard mirrors the server check; the API refuses the call regardless of what the SPA renders. |
| `/api/admin/...` returns 404 | `MAINTAINER_KEY` is unset, so the admin router was never mounted | Set `MAINTAINER_KEY` in `backend/.env` and restart. A 401 instead of 404 means the key is set but the `x-maintainer-key` header did not match. |
| All issues escalate as unclassified | LLM provider is unavailable | Check `/api/health`, then verify `LLM_PROVIDER`, `LLM_MODEL`, and provider URL settings. |
| Microphone is unavailable | Permission, device, or local model issue | Allow browser microphone access; verify `STT_MODEL_DIR` if local transcription fails. Typing remains available. |
| Tests initially fail while downloading MongoDB binaries | `mongodb-memory-server` is preparing its binary | Run the suite again after the download completes. |
| Every proposed action is refused as `remediation_disabled` | `REMEDIATION_ENABLED=false`, or a staff member disabled the kill switch (globally or for that endpoint) | Check **Automation** (`/staff/remediation`) and re-enable it, or set `REMEDIATION_ENABLED=true` and restart the backend. |
| An action is refused as `no_matching_entry`, `unregistered_target`, or `endpoint_not_permitted` | The test endpoint containers are not running, or the endpoint registry is stale relative to them | Run `powershell -File backend/test-endpoints/reset.ps1` and confirm the containers are up with `docker compose -f backend/test-endpoints/docker-compose.yml ps`. |
| A remediation action fails with an SSH host key or authentication error | The client keypair or `authorized_keys` is stale relative to the running containers | Re-run `backend/test-endpoints/reset.ps1` — it regenerates the keypair (if missing), restages `authorized_keys`, and recaptures host-key fingerprints into the pinned endpoint registry after `docker compose down -v`. |
| A proposed action is refused as `degraded_model` | The primary LLM provider was unavailable and the request fell back to a later provider in `LLM_PROVIDERS` | Expected behaviour, not a bug (FR-025): no automated action ever executes on a classification made while the model was degraded. Check `/api/health` and the primary provider's own status; the proposal can be retried once it recovers. |
| A state-changing action never runs even after the reporter consents | It is a `state_changing` tier action, which additionally requires a staff decision at **Approvals** (`/staff/approvals`) | Expected behaviour. If it is missing from the queue, it may have expired past `REMEDIATION_APPROVAL_TTL_MINUTES` and was auto-refused. |

## License

This project is **not open source**. It is published for educational, reference, portfolio, and demonstration purposes only. All rights are reserved by the copyright holder; see [LICENSE](LICENSE) for the complete terms.
