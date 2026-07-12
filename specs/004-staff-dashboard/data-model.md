# Data Model: Staff Dashboard & User Accounts

**Feature**: `004-staff-dashboard` | **Date**: 2026-07-13

All collections are Mongoose schemas under `backend/src/models/`, zod-validated at API
boundaries (Principle VI). Existing models are **extended, never rewritten**.

## New Entities

### UserAccount (`user-account.ts`)

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | required, unique (case-insensitive index), valid email format |
| `displayName` | string | required, 1–80 chars |
| `role` | `'user' \| 'staff'` | required, default `'user'`; never settable via any HTTP endpoint (FR-002) |
| `passwordHash` | string | scrypt hash, never serialised in any API response |
| `passwordSalt` | string | per-account random, never serialised |
| `usingInitialPassword` | boolean | `true` when the current password was provisioned (registration sets `false`; import/seed/reset set `true`); flips `false` on self-service change (FR-018) |
| `availability` | `'available' \| 'busy' \| 'away'` | staff only; default `'available'` (FR-021) |
| `createdAt` / `updatedAt` | Date | timestamps |

Validation: registration rejects duplicate email with a plain-language message and no
account-existence leak beyond "already in use" (spec edge case). Password min 8 chars.

### AuthSession (`auth-session.ts`)

| Field | Type | Rules |
|---|---|---|
| `tokenHash` | string | SHA-256 of the opaque cookie token; unique index |
| `accountId` | ObjectId → UserAccount | required |
| `createdAt` | Date | |
| `expiresAt` | Date | TTL index; rolling expiry on activity |

Every authenticated request re-reads the `UserAccount` — role revocation and password
reset take effect on the next action (spec edge case). Password change/reset deletes all
other sessions for the account.

### SupportProfile (`support-profile.ts`)

| Field | Type | Rules |
|---|---|---|
| `accountId` | ObjectId → UserAccount | required, unique (one profile per account) |
| `remoteAccessIds` | `{ tool: string, id: string }[]` | e.g. `{ tool: 'TeamViewer', id: '...' }`; user-editable |
| `location` | string | building/room/desk; user-editable |
| `hardware` | string | free-text device/asset description; user-editable |
| `staffEntries` | `StaffEntry[]` | append-only; see below |
| `updatedAt` | Date | |

Only support-relevant fields exist — nothing else is requested or stored (FR-015,
NFR-5). Access: owner + staff only.

**StaffEntry** (embedded, append-only — FR-012 hybrid form):

| Field | Type | Rules |
|---|---|---|
| `kind` | `'note' \| 'correction'` | note = attributed free text; correction = value recorded alongside a user field |
| `field` | `'remoteAccessIds' \| 'location' \| 'hardware'` | required when `kind='correction'` |
| `value` | string | the note text or corrected value |
| `staffId` / `staffName` | ObjectId / string | attribution (FR-008) |
| `at` | Date | timestamp |

Corrections never overwrite the user's own values; both render side by side, visibly
distinct and visible to the owner.

### StaffActionRecord (`staff-action.ts`)

Append-only attribution log for every dashboard action (FR-008, Principle II audit
discipline — separate from debug logging, not disableable).

| Field | Type | Rules |
|---|---|---|
| `staffId` / `staffName` | ObjectId / string | acting staff member |
| `action` | `'takeover' \| 'reassign' \| 'status_change' \| 'resolve' \| 'profile_append' \| 'credential_reset' \| 'import_apply'` | |
| `targetType` | `'ticket' \| 'profile' \| 'account' \| 'import'` | |
| `targetId` | ObjectId | |
| `details` | object | action-specific (e.g. old→new status, assignee ids) |
| `at` | Date | |

### ProfileImport (`profile-import.ts`)

| Field | Type | Rules |
|---|---|---|
| `staffId` / `staffName` | ObjectId / string | initiator |
| `filename` | string | original upload name |
| `status` | `'mapping' \| 'previewed' \| 'applied' \| 'aborted'` | state machine below |
| `columns` | string[] | header row as read from the sheet |
| `rows` | string[][] | raw cell values (bounded: reject files > 1000 rows) |
| `mapping` | `Record<column, field>` | staff-chosen; fields: email (required), displayName, initialPassword, remoteAccessId, location, hardware |
| `rowOutcomes` | `{ row: number, outcome: 'created' \| 'updated' \| 'rejected', reason?: string, email?: string }[]` | per-row report (FR-016) |
| `createdAt` / `appliedAt` | Date | |

State transitions: `mapping → previewed → applied` (forward only; re-mapping returns to
`mapping`; anything can move to `aborted`). Apply is idempotent per import document.
Row validation: duplicate email within file → reject row; missing required value →
reject row; email matching an existing account → update that profile (no duplicate
account, password untouched); unreadable file → refuse upload before any state exists.

## Extended Entities

### Ticket (existing `ticket.ts` — additive fields only)

| New field | Type | Rules |
|---|---|---|
| `reporterAccountId` | ObjectId → UserAccount, **optional** | absent on legacy tickets (FR-014); set from the signed-in session at creation (FR-003) |
| `assignee` | `{ accountId, displayName, since }`, optional | set by takeover; cleared never (no hand-back to agent, FR-019) |
| `assignmentHistory` | `{ assigneeId, assigneeName, byId, byName, at, kind: 'takeover' \| 'reassign' }[]` | append-only (FR-019) |

Handling-mode rule (extends existing state machine in
`backend/src/services/ticket/state-machine.ts`): takeover forces
`handlingMode = 'human'`; once human-involved, transitions back to automated handling
are **invalid** (FR-019). Status changes remain governed by the existing state machine;
staff status updates and resolution go through it so chat-side behaviour stays
consistent (spec edge case: the agent never pretends to work a taken-over case).

Concurrency: takeover/reassign use conditional `findOneAndUpdate` on the expected
current `assignee` (research R6); losing writer receives 409 + current assignee.

### Conversation (existing — additive)

| New field | Type | Rules |
|---|---|---|
| `accountId` | ObjectId → UserAccount, optional | new conversations require a signed-in account (FR-003); legacy conversations lack it |

## Relationships

```
UserAccount 1 ─── 1 SupportProfile
UserAccount 1 ─── * AuthSession
UserAccount 1 ─── * Ticket (as reporterAccountId)
UserAccount 1 ─── * Ticket (as assignee.accountId, staff)
Ticket      1 ─── * assignmentHistory entries (embedded)
UserAccount 1 ─── * StaffActionRecord (as staffId)
ProfileImport * ── * UserAccount (rows create/update accounts by email)
```

## Access rules (enforced in middleware/services, tested per SC-003)

| Resource | Regular user | Staff | Signed out |
|---|---|---|---|
| Own tickets/conversations/profile | read/write | read + append/correct | — |
| Others' tickets/conversations/profiles | **refused** | read + act | **refused** |
| Dashboard, imports, credential status/reset, availability roster | **refused** | full | **refused** |
| Start new conversation | allowed | allowed | **refused** (FR-003) |
