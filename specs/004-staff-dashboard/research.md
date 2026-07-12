# Research: Staff Dashboard & User Accounts

**Feature**: `004-staff-dashboard` | **Date**: 2026-07-13

All Technical Context unknowns resolved below. Stack fundamentals (TypeScript strict,
Express, React + Vite + Tailwind, MongoDB + Mongoose, Vitest) are locked by the
constitution and are not re-researched.

## R1. Authentication & session mechanism

**Decision**: Server-side sessions stored in MongoDB, referenced by an opaque token in
an `httpOnly` + `SameSite=Lax` cookie. Express middleware chain: `requireAuth` (resolves
the session to a fresh `UserAccount` read) and `requireStaff` (role gate on top).

**Rationale**:
- The spec's edge case "staff role revoked while signed in → next action refused"
  requires per-request authority checks. Server-side sessions that re-read the account
  record make this trivial; stateless JWTs make revocation a bolted-on blocklist.
- Fully local (NFR-7): no identity provider, no extra infrastructure — one Mongoose
  collection.
- `httpOnly` cookie keeps the token out of frontend JS; the SPA needs no token plumbing,
  and the existing `fetch` wrapper in `frontend/src/services/api.ts` only gains
  `credentials: 'include'`.

**Alternatives considered**:
- **JWT (stateless)**: rejected — role revocation and password-reset invalidation become
  extra machinery; no benefit on a single-machine deployment.
- **express-session + connect-mongo**: viable, but adds two dependencies for what is a
  ~50-line service with our own zod-validated shape; a bespoke session collection also
  keeps the audit/attribution story explicit.
- **External identity provider (OAuth)**: rejected per NFR-7 (no mandatory external
  infrastructure) and spec assumption (simple credential sign-in suffices).

## R2. Password hashing

**Decision**: Node built-in `crypto.scrypt` with per-user random salt and
`crypto.timingSafeEqual` comparison. Store `passwordHash`, `passwordSalt`, and a
`mustChangePassword`-style boolean `usingInitialPassword` for FR-018 credential status.

**Rationale**:
- Zero new dependencies, no native build step — important on the Windows 11 demo
  machine (NFR-7) and for the zipped-source deliverable (Principle V).
- scrypt is a memory-hard KDF recommended for password storage; OWASP-listed.
- Credential status (FR-018) is a boolean flipped on first user-initiated password
  change; staff re-issue sets a new initial password and flips it back. No one can ever
  read a stored password — only hashes exist.

**Alternatives considered**:
- **bcrypt (native)**: prebuilt binaries usually work, but native modules have burned
  this project before (sherpa-onnx); avoid when a built-in exists.
- **bcryptjs**: pure JS but effectively unmaintained and slow.
- **argon2**: strongest KDF but native build required — same objection as bcrypt.

## R3. Excel import parsing

**Decision**: Parse server-side with **`exceljs`** (npm). Upload the `.xlsx` file via the
existing `multer` dependency (already used for voice uploads). Flow: upload → server
extracts header row + all data rows into a pending `ProfileImport` document → staff maps
columns to fields → server returns a dry-run preview (created / updated / rejected per
row) → staff confirms → rows applied.

**Rationale**:
- `exceljs` is actively maintained, pure JS, reads `.xlsx` streams; fits the 16 GB
  envelope trivially at 50-row scale (SC-007).
- Server-side parsing keeps validation at the system boundary (zod on the mapped row
  values) per Principle VI; the browser only renders the mapping/preview UI.
- Re-import matching by email (spec edge case) is a natural upsert keyed on the
  normalised email column.

**Alternatives considered**:
- **SheetJS (`xlsx`)**: the npm-registry build is stale (maintainer moved distribution
  off npm; known CVE noise on the old package). Rejected.
- **Client-side parsing**: rejected — moves validation away from the boundary and
  duplicates the row-outcome logic the server needs anyway for auditability.
- **CSV-only**: rejected — spec explicitly says "existing Excel file".

## R4. Real-time propagation (chat ⇄ dashboard, ≤ 5 s)

**Decision**: Extend the existing SSE event bus (`backend/src/api/sse/event-bus.ts`,
consumed by `frontend/src/services/useEvents.ts`). Add: (a) a staff-scoped event stream
carrying ticket-list changes (created / status / handling-mode / assignment), gated by
`requireStaff`; (b) reporter-scoped events already exist for the chat — extend the
payload vocabulary with assignment-change notices so FR-020's "who is handling my case"
updates without reload.

**Rationale**:
- SSE is already shipped, tested (`status-updates.test.ts`), and one-directional push is
  all SC-004 needs. Reuse beats reinvention.
- The dashboard is a pure consumer; staff actions go through normal REST endpoints and
  the bus fans out the result to both sides.

**Alternatives considered**:
- **WebSockets (socket.io)**: rejected — bidirectional transport unneeded; new dependency
  and new failure modes.
- **Polling**: rejected — SC-004's 5-second bound is met more cheaply and demo-reliably
  by the push channel that already exists.

## R5. Frontend routing & role-gated shell

**Decision**: Add **`react-router-dom` v7** (library mode, `BrowserRouter`). Route map:
`/login`, `/register`, `/` (chat, auth-required per FR-003), `/tickets` (my tickets),
`/profile`, `/settings` (password change), `/staff` (dashboard list),
`/staff/tickets/:id`, `/staff/users/:id` (profile view/append), `/staff/import`.
An `AuthProvider` context loads `GET /api/auth/me` once; `RequireAuth` / `RequireStaff`
wrapper routes redirect or render a clear refusal.

**Rationale**:
- The app currently has zero routing (`App.tsx` → `ChatPage`); a router is the smallest
  structural change that yields role-separated surfaces in the same deployment (spec
  assumption: one app, roles differ by account).
- react-router-dom is the ecosystem default, tree-shakes well, no framework migration.

**Alternatives considered**:
- **TanStack Router**: type-safe but heavier conceptual lift; unnecessary for ~9 routes.
- **Conditional rendering without a router**: rejected — deep links to ticket details
  (SC-001's 60-second flow) and refusal semantics (FR-004) want real URLs.

## R6. Takeover / reassignment concurrency

**Decision**: Atomic conditional updates via Mongoose
`findOneAndUpdate({ _id, 'assignee.accountId': expected }, ...)` — a takeover requires
`assignee` to be unset; a reassignment requires the expected current assignee. A failed
precondition returns HTTP 409 with the current assignee so the second staff member sees
who won (spec edge case: no silent conflicting takeover; acceptance scenario US2-5).

**Rationale**: single-document atomicity is a MongoDB guarantee — no transactions,
locks, or version plugins needed for this shape.

**Alternatives considered**: optimistic `__v` versioning (broader than needed);
MongoDB multi-document transactions (requires replica set — overkill locally).

## R7. Suggested default assignee

**Decision**: Computed server-side at picker-open time: all staff with availability
status and their open assigned-ticket counts (single aggregation), suggestion = available
staff with fewest active cases (ties → alphabetical). Advisory only; the API returns the
roster + a `suggested` id, and the UI preselects but never auto-assigns (NFR-4).

**Rationale**: one aggregation query, honest even when availability is stale (count
still reflects real load — spec edge case), trivially testable.

## R8. Legacy (pre-account) tickets

**Decision**: `Ticket` gains an optional `reporterAccountId`. The existing
session/`Reporter` linkage stays untouched for old data. Dashboard list and detail
render a "No linked account" marker when absent (FR-014); profile panel states
"no profile on file" explicitly (FR-013, US2-3).

## R9. Plain-language reporter notifications

**Decision**: Reuse the existing notification path
(`backend/src/services/ticket/notifications.ts` → conversation message + SSE) for staff
actions: takeover ("A member of our IT team, {name}, is now handling your case."),
reassignment, status changes, resolution. No new mechanism; new message templates live
with the existing plain-language templates (NFR-2).

## R10. Seeding staff accounts

**Decision**: A maintainer-run seed script (`backend/scripts/` or npm script) creates
staff accounts with email + initial password (FR-002: staff role never self-assignable;
FR-017 provisioned credentials). The existing admin/maintainer mechanism from feature 003
(admin guides API) is the precedent; promotion of an existing account is a maintainer
script action too, not an HTTP surface.

**Rationale**: keeps the "administrative action" out of the web attack surface entirely
in this feature; an admin UI can grow in feature 005+ if needed.
