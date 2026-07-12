# API Contract: Staff Dashboard & User Accounts

**Feature**: `004-staff-dashboard` | Base path: `/api` (existing Express app)

Conventions (unchanged from feature 001): JSON bodies, zod-validated at the boundary;
errors as `{ error: { code, message } }`; plain-language messages (NFR-2).
Auth: opaque session token in an `httpOnly` cookie; `401` when signed out, `403` when
role-refused — refusals carry a clear message and **no resource data** (SC-003).

## Auth & Accounts

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | none | Create account `{ email, displayName, password }` → signs in (sets cookie). Duplicate email → 409 plain message. |
| POST | `/auth/login` | none | `{ email, password }` → sets cookie. Invalid → 401 (no user-existence leak). |
| POST | `/auth/logout` | session | Clears session + cookie. |
| GET | `/auth/me` | session | `{ id, email, displayName, role, availability?, usingInitialPassword }`. |
| POST | `/auth/change-password` | session | `{ currentPassword, newPassword }` → flips `usingInitialPassword` to `false`, invalidates other sessions (FR-017). |

## User surfaces (role: any signed-in user)

| Method | Path | Purpose |
|---|---|---|
| GET | `/my/tickets` | Own tickets only: number, category, status, handling mode, assignee display name, timestamps (FR-010, FR-020). |
| GET | `/my/tickets/:id` | Own ticket detail incl. status history + current handler name. Others' → 403. |
| GET | `/my/profile` | Own profile incl. staff-appended entries with attribution (FR-012). |
| PUT | `/my/profile` | Update own fields only (`remoteAccessIds`, `location`, `hardware`) — never staff entries (FR-011, FR-015). |

Conversation start (existing `POST /sessions` / conversations flow): now requires a
session cookie (FR-003); the created conversation/ticket carries `accountId` /
`reporterAccountId`. Existing message endpoints unchanged otherwise.

## Staff surfaces (role: staff — every route behind `requireStaff`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/staff/tickets` | All tickets; query `status`, `category`, `escalated`, sort keys (FR-004). Each row: number, category, status, handling mode, reporter (or "no linked account", FR-014), assignee, created/updated. |
| GET | `/staff/tickets/:id` | Full context: conversation transcript, classification, attempted steps, status history, assignment history, and the reporter's profile (or explicit `profile: null`, FR-006/FR-013). |
| POST | `/staff/tickets/:id/takeover` | Sets assignee = caller, handling mode → human (FR-007). Already assigned → 409 `{ currentAssignee }` (US2-5). |
| POST | `/staff/tickets/:id/assignee` | `{ toAccountId }` reassign (FR-019). Precondition mismatch → 409. Never accepts "agent" as target. |
| POST | `/staff/tickets/:id/status` | `{ status }` via existing state machine; resolution included (FR-007). Invalid transition → 422. |
| GET | `/staff/roster` | All staff: `{ id, displayName, availability, openCaseCount }` + `suggestedAssigneeId` (available, fewest cases; advisory — FR-021). |
| PUT | `/staff/availability` | `{ availability: 'available' \| 'busy' \| 'away' }` for the caller (FR-021). |
| GET | `/staff/users/:id/profile` | Any user's profile (FR-012). |
| POST | `/staff/users/:id/profile/entries` | Append `{ kind: 'note' \| 'correction', field?, value }` — attributed + timestamped, never overwrites user fields (FR-012). |
| GET | `/staff/users/:id/credentials` | `{ usingInitialPassword }` only — no password material ever (FR-018). |
| POST | `/staff/users/:id/credentials/reset` | `{ newInitialPassword }` → re-issued initial password, `usingInitialPassword = true`, sessions invalidated, action attributed (FR-018). |

Every mutating staff route appends a `StaffActionRecord` (FR-008) and publishes SSE
events + a plain-language reporter notification where the reporter is affected (FR-009,
FR-020).

## Bulk import (staff)

| Method | Path | Purpose |
|---|---|---|
| POST | `/staff/imports` | multipart `.xlsx` upload → parses columns/rows → `{ importId, columns, sampleRows }`. Unreadable file → 400 before any state (FR-016). |
| PUT | `/staff/imports/:id/mapping` | `{ mapping: { [column]: field } }`; `email` mapping required. |
| POST | `/staff/imports/:id/preview` | Dry-run → per-row outcomes (created / updated / rejected + reason). Repeatable after re-mapping. |
| POST | `/staff/imports/:id/apply` | Applies previewed outcome: creates accounts (email + initial password), updates existing by email, reports rejected rows (FR-016, FR-017). |

## SSE events (extends existing `/api/events` bus)

| Stream | Audience | Events |
|---|---|---|
| Existing per-session stream | Reporter's chat / "my tickets" | existing events + `ticket:assignee` `{ ticketId, assigneeName }`, `ticket:status`, `ticket:handlingMode` — plain-language mirror lands in the conversation (FR-009, FR-020, SC-004/SC-008) |
| `/staff/events` | Staff dashboard (requireStaff) | `ticket:created`, `ticket:updated` `{ ticketId, changed }` — list refreshes without reload (FR-009, US1-6) |

## Error codes used by this feature

`401 UNAUTHENTICATED` · `403 FORBIDDEN` (role/ownership) · `404 NOT_FOUND` ·
`409 CONFLICT` (duplicate email, assignment race) · `422 INVALID_TRANSITION` ·
`400 VALIDATION` (zod) / unreadable import file.
