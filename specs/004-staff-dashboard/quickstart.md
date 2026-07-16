# Quickstart: Staff Dashboard & User Accounts

**Feature**: `004-staff-dashboard`

Validation guide — proves each user story end-to-end. Contracts:
[contracts/api.md](contracts/api.md) · Entities: [data-model.md](data-model.md).

## Prerequisites

- MongoDB running locally as a replica set. US5 Apply uses a transaction and cannot
  run against a standalone server. For the documented single-node demo setup, run:

  ```powershell
  docker run -d --name helpdesk-mongo -p 27017:27017 -v helpdesk-mongo-data:/data/db mongo:7 --replSet rs0 --bind_ip_all
  docker exec helpdesk-mongo mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
  docker exec helpdesk-mongo mongosh --quiet --eval "db.hello().isWritablePrimary"
  ```

  The last command must return `true`. Set `MONGODB_URI=mongodb://127.0.0.1:27017/helpdesk?replicaSet=rs0` in `backend/.env` before starting the backend.
- `backend/.env` from `.env.example` (LLM provider optional for these flows; the
  dashboard works even with the agent degraded).
- Install once per side: `npm install` in `backend/` and `frontend/`.

## Setup

```powershell
# 1. Seed a staff account (maintainer action — FR-002)
cd backend
npm run seed:staff -- --email staff@demo.local --name "Demo Staff" --password <initial>

# 2. Start both sides
npm run dev                # backend  (Express + SSE)
cd ../frontend; npm run dev  # frontend (Vite)
```

## Automated checks (quality gates)

```powershell
cd backend;  npx tsc --noEmit; npm test
cd frontend; npx tsc --noEmit; npm test
```

Expected: all suites green, including new auth/access-control tests (access-control
tests are the safety-critical, test-first set — SC-003).

## Scenario walkthroughs

### US1 — Staff sign in and manage tickets (P1)

1. Browser A: register a regular user, start a chat, report a printer issue → ticket
   created.
2. Browser B: sign in as `staff@demo.local` → `/staff` lists the ticket with number,
   category, status, handling mode, reporter, timestamps; filter by status/category.
3. Open the ticket: full conversation, classification, attempted steps visible on one
   page. Mark it resolved → Browser A's chat shows the plain-language update within 5 s
   without reload (SC-004).
4. In Browser A (regular user), navigate to `/staff` → refused with a clear message, no
   ticket data (SC-003).

### US2 — Takeover with profile at hand (P2)

1. As the regular user, fill `/profile` (TeamViewer ID, desk, hardware).
2. In chat, escalate a ticket (existing 001/003 flow).
3. As staff: escalated ticket is visually distinct at the top of `/staff`; open it →
   profile panel shows remote-access ID, location, hardware automatically (SC-002).
4. Take over → handling mode becomes human-involved; reporter's chat announces the named
   handler (FR-020). A second staff account attempting takeover gets a clear conflict,
   not a silent steal.
5. Reassign via the picker → availability + open-case counts shown, default suggested,
   human confirms; reporter sees the new name within 5 s (SC-008).

### US3 — Users follow their own tickets (P3)

1. Register a second regular user → `/tickets` shows only their own tickets.
2. Attempt to open the first user's ticket by URL → refused (SC-003).
3. Staff updates a ticket → owner's list/status updates live.

### US4 — Profiles with staff-appended details (P4)

1. Staff opens the user's profile from a ticket, appends a correction ("Asset #
   corrected") → entry is attributed + timestamped, user's own value untouched.
2. The user sees the staff entry on `/profile`, visibly distinct from their own fields.

### US5 — Excel bulk import (P5)

1. `/staff/import`: upload a sample `.xlsx` (~50 rows incl. one duplicate email and one
   missing-email row).
2. Map columns (e.g. "Column C → location"), preview → duplicates/invalid rows rejected
   with reasons, rest listed as create/update.
3. Apply → sign in as an imported user with the issued initial password; change it in
   `/settings`; staff credential view now shows "changed" (FR-018).
4. Timebox check: whole import flow under 5 minutes (SC-007).

## Demo-path regression (Principle IV release gate)

The scripted end-to-end demo (report → classify → ticket → guided fix → escalate →
**dashboard takeover → resolve**) must pass on the demo machine — the dashboard steps
extend the existing gate, not a separate script.

## Documentation evidence to capture while validating (Principle V)

- Screenshots: sign-in, dashboard list (escalated grouping), ticket detail with profile
  panel, assignment picker, import mapping/preview → `docs/`.
- TC tables for the new test suites (Chapter 5 format).
- Updated ERD/schema + sequence diagram (takeover flow) for Chapter 4.

## Observed demo-machine record — 2026-07-16

The complete US1–US5 walkthrough was executed on the Windows demo machine. The
durable browser captures and the detailed outcome record are in
[`docs/testing/feature-004-uat.md`](../../docs/testing/feature-004-uat.md) and
[`docs/testing/feature-004-browser/`](../../docs/testing/feature-004-browser/).

- **US1:** a regular user registered and created escalated ticket `HD-0003`; staff saw
  it in the escalated group, took it over, resolved it, and the reporter received the
  live plain-language update without a reload.
- **US2:** the profile fields were visible to staff; reassignment showed availability
  and workload, while a competing takeover was refused rather than silently stealing
  the case.
- **US3:** the second regular account saw only its own tickets; attempting the first
  account's ticket URL was refused with no ticket data.
- **US4:** staff appended an attributed profile correction without overwriting the
  reporter-owned values.
- **US5:** upload, mapping, and preview showed create/reject outcomes. Under the
  documented `rs0` replica set, Apply completed, issued credentials were used to sign
  in, the password was changed, and the new password was verified on a subsequent sign-in.
