# API Contract: Maintainer Admin Console & Staff-Authoritative Account Editing

**Feature**: `007-admin-console-account-editing` | Base path: `/api` (existing Express app)

Conventions unchanged from features 001, 004, and 005: JSON bodies, zod-validated at the boundary;
errors as `{ error: { code, message } }`; plain-language messages (NFR-2). Account auth is an opaque
session token in an `httpOnly` cookie — `401` when signed out, `403` when role-refused, and a refusal
carries a clear message and **no resource data**.

Three contract-level rules govern everything below.

1. **The maintainer axis and the account axis never meet.** Maintainer endpoints authenticate by
   `x-maintainer-key` + `x-maintainer-name` headers only, and ignore session cookies entirely. Account
   endpoints ignore maintainer headers entirely. No endpoint accepts both, and no maintainer endpoint
   can read a ticket, a conversation, an account, or a profile, or alter a role (FR-015, Principle
   III).
2. **No endpoint modifies or deletes a profile field history entry, a maintainer sign-in attempt
   record, or a published guide version.** These paths do not exist, in any role (FR-018 append-only
   discipline, guide version immutability).
3. **A staff save reports its outcome per field.** There is no endpoint whose success or failure is
   all-or-nothing across fields (FR-029, `research.md` R7).

---

## Maintainer console (no account, no session)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/maintainer/status` | **none** | Is maintainer administration enabled? |
| `GET` | `/api/maintainer/categories` | key + name | List categories with active guide version |
| `POST` | `/api/maintainer/categories` | key + name | Create a category with its first guide |
| `PUT` | `/api/maintainer/categories/:name` | key + name | Edit display name / classification description |
| `DELETE` | `/api/maintainer/categories/:name` | key + name | Retire a non-mandated category |
| `POST` | `/api/maintainer/categories/:name/guide` | key + name | Publish a new guide version |
| `GET` | `/api/maintainer/categories/:name/guide/versions` | key + name | Read guide version history |

All but `/status` are the **existing** `adminGuidesRouter` handlers (`backend/src/api/routes/
admin-guides.ts`) reached under this namespace. No new maintainer capability is added (FR-015, spec
assumption; `research.md` R12).

### `GET /api/maintainer/status`

Unauthenticated and **always mounted**, including when `MAINTAINER_KEY` is unset — that is the whole
point of it (FR-005, `research.md` R2).

```json
{ "enabled": false }
```

Discloses only whether the feature is switched on. No key, no key length, no data, no account.

`200` always. There is no error response.

### Maintainer authentication

Every maintainer endpoint except `/status` requires both headers:

| Header | Rule |
|---|---|
| `x-maintainer-key` | Compared in constant time against `MAINTAINER_KEY` (existing `maintainer-auth.ts`) |
| `x-maintainer-name` | Non-empty after trim. Attribution only, never authentication (FR-003) |

| Condition | Status | Code | Body rule |
|---|---|---|---|
| Key absent or wrong | `401` | `MAINTAINER_KEY_INVALID` | **One fixed message.** MUST NOT vary with key length, prefix, or format (FR-004) |
| Name absent or blank | `400` | `MAINTAINER_NAME_REQUIRED` | |
| Cooling-off in force | `429` | `MAINTAINER_SIGNIN_THROTTLED` | Carries `retryAfterSeconds` (FR-034) |
| Administration not enabled | `404` | — | Routes unmounted. Clients MUST read `/status` first rather than interpreting this (FR-005) |

**FR-004 is a contract obligation, not a UI one.** A single message string is returned for every
invalid key. No validation runs on the key before comparison, because a `400 too short` before a
`401 wrong` would itself narrow the key.

### Throttling and refused-attempt records

- Every refused attempt appends one `MaintainerSignInAttempt` record: hashed client identity,
  timestamp, outcome. **The supplied key is never written**, to the record or to any log (FR-035).
- At or above `MAINTAINER_SIGNIN_MAX_FAILURES` refusals inside the window, further attempts return
  `429` with `retryAfterSeconds` until the window passes (FR-034).
- A `429` is returned **before** the key is compared, so the throttle cannot be used as an oracle.

```json
{
  "error": {
    "code": "MAINTAINER_SIGNIN_THROTTLED",
    "message": "Too many failed attempts. Sign-in is paused for a short period."
  },
  "retryAfterSeconds": 240
}
```

### Category and guide payloads

Unchanged from the existing router. Reproduced for the console client:

`GET /api/maintainer/categories` → `200`

```json
{
  "categories": [
    {
      "name": "password_login",
      "displayName": "Password and login",
      "classificationDescription": "…",
      "mandated": true,
      "retired": false,
      "activeGuideVersion": 3
    }
  ]
}
```

`POST /api/maintainer/categories` → `201`. Body: `name` (lowercase snake_case slug, 1–60),
`displayName` (1–60), `classificationDescription` (10–500), `guide.steps`, optional
`guide.changeNote` (≤ 300).

`PUT /api/maintainer/categories/:name` → `200`. At least one of `displayName`,
`classificationDescription`.

`DELETE /api/maintainer/categories/:name` → `200`. Retires; does not delete.

| Condition | Status | Code |
|---|---|---|
| Slug malformed | `400` | `VALIDATION_ERROR`, naming the field |
| Slug already exists | `409` | `CATEGORY_EXISTS` |
| Category unknown | `404` | `CATEGORY_NOT_FOUND` |
| Retire attempted on a mandated category | `409` | `CATEGORY_MANDATED` |

**The mandated refusal must never be the console's first line of defence.** FR-012 requires the
interface not offer the action at all; this response exists so the rule holds if the request is made
directly.

`POST /api/maintainer/categories/:name/guide` → `201` `{ "version": 4, "active": true }`.

**FR-013 obligation on guide validation**: a rejected guide MUST identify the offending **step index
and field**, not just report that the guide is invalid:

```json
{
  "error": {
    "code": "GUIDE_STEP_INVALID",
    "message": "Step 3 needs a success hint."
  },
  "stepIndex": 2,
  "field": "successHint"
}
```

The current schema types steps as `z.array(z.unknown())` and delegates to the service. If the service
does not yet return step-level detail, adding it is in scope for FR-013 and is a backend change, not
a client-side guess (`research.md` R12).

`GET /api/maintainer/categories/:name/guide/versions` → `200` with `version`, `changedBy`,
`changedAt`, `changeNote`, `active`, `steps` per version.

**No endpoint revives, reverts, edits, or deletes a past version.** Those paths do not exist.

---

## Staff: account directory (role: staff)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/staff/accounts` | session, staff | List and search all user accounts |

Query: `q` (optional, ≤ 120 chars) — case-insensitive substring of display name or email (FR-031).

`200`:

```json
{
  "accounts": [
    { "id": "…", "displayName": "Sara Alkaff", "email": "sara.alkaff@example.org", "role": "user" }
  ]
}
```

**Exactly these four attributes** (FR-030, NFR-5). No credential status, no availability, no case
counts, no profile content. Not a superset of `/api/staff/roster`, which serves a different audience
(`research.md` R10).

| Condition | Status | Code |
|---|---|---|
| Not signed in | `401` | `UNAUTHENTICATED` |
| Signed in, not staff | `403` | `FORBIDDEN` (FR-033) |

No match returns `200` with an empty array, not `404`. An empty result is a valid answer.

---

## Staff: profile viewing and authoritative editing (role: staff)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/staff/users/:id/profile` | session, staff | Read a profile with provenance and control |
| `PUT` | `/api/staff/users/:id/profile/fields` | session, staff | Set one or more fields authoritatively |
| `POST` | `/api/staff/users/:id/profile/fields/:field/release` | session, staff | Return a field to owner control |
| `GET` | `/api/staff/users/:id/profile/fields/:field/history` | session, staff | Read one field's history |
| `POST` | `/api/staff/users/:id/profile/entries` | session, staff | **Existing.** Append a free-text note |

`:field` is one of `location`, `hardware`, `remoteAccessIds`.

### `GET /api/staff/users/:id/profile` → `200`

Extends the existing response; existing consumers keep working.

```json
{
  "profile": {
    "location": "Block C, desk 14",
    "hardware": "HP ProBook 450 G9, 16 GB",
    "remoteAccessIds": [{ "tool": "UltraViewer", "id": "812 442 190" }],
    "fieldState": {
      "location": {
        "setByKind": "staff",
        "setByName": "Ayesha Khan",
        "setAt": "2026-08-28T14:20:11.000Z",
        "controlledBy": "staff"
      },
      "hardware":        { "setByKind": "owner", "setByName": "Sara Alkaff", "setAt": "…", "controlledBy": "owner" },
      "remoteAccessIds": { "setByKind": "owner", "setByName": null, "setAt": null, "controlledBy": "owner" }
    },
    "staffEntries": [ /* unchanged, including pre-feature corrections */ ]
  }
}
```

`setByName: null` with `setAt: null` is a profile written before this feature. It is a real state the
client must render, not an error (`research.md` R8).

An account with no profile yet returns the empty profile with all fields owner-controlled — `200`, not
`404` (spec edge case).

### `PUT /api/staff/users/:id/profile/fields`

Sets one or more fields authoritatively (FR-016). Each submitted field carries the `setAt` the client
loaded, as its concurrency token (FR-029, `research.md` R7).

```json
{
  "fields": {
    "location": { "value": "Block C, desk 14", "expectedSetAt": "2026-08-20T09:02:00.000Z" },
    "hardware": { "value": "HP ProBook 450 G9, 16 GB", "expectedSetAt": null }
  }
}
```

- `expectedSetAt: null` means "this field had never been set when I loaded it". If it has been set
  since, the field is refused. This is what stops last-write-wins on a previously empty field.
- `remoteAccessIds` takes the **whole list** as its value. Adding or removing an entry is a change to
  this one field (FR-019, `research.md` R11).

**Response `200` — a per-field outcome map. This is the normal shape, including when a field was
refused.**

```json
{
  "results": {
    "location": { "outcome": "applied" },
    "hardware": {
      "outcome": "conflict",
      "currentValue": "Dell Latitude 5440",
      "currentSetByName": "Omar Haddad",
      "currentSetAt": "2026-08-28T14:31:07.000Z"
    }
  },
  "profile": { /* the full profile as it now stands, shape as above */ }
}
```

| `outcome` | Meaning |
|---|---|
| `applied` | Saved. Field is now staff-controlled; provenance updated; history appended |
| `conflict` | **Not** saved. The field changed since `expectedSetAt`. The current value, author, and time are returned so the staff member can see what they would have overwritten (FR-029) |

**A mixed result is a `200`, never a `4xx`.** Some fields were applied; reporting that as a failure
would misdescribe what the server did. A `4xx` is reserved for a request that applied nothing because
it was malformed or refused outright.

| Condition | Status | Code |
|---|---|---|
| Not staff | `403` | `FORBIDDEN` (FR-027) |
| Unknown account | `404` | `ACCOUNT_NOT_FOUND` |
| Unknown field name in `fields` | `400` | `VALIDATION_ERROR` |
| Value breaches a length or count limit | `400` | `VALIDATION_ERROR`, naming the field |
| Remote entry with a tool but no id, or vice versa | `400` | `REMOTE_ACCESS_ENTRY_INVALID`, with `entryIndex` |
| More than 10 remote entries | `400` | `VALIDATION_ERROR` |
| `fields` empty | `400` | `VALIDATION_ERROR` |

**Side effects on every applied field**: `fieldState` updated with the acting staff member and now;
`controlledBy` set to `staff`; a `ProfileFieldHistory` `value` entry appended; a `control` entry
appended if control moved; and one `StaffActionRecord` with `action: "profile_edit"` listing **only
the applied fields** (FR-026).

### `POST /api/staff/users/:id/profile/fields/:field/release` → `200`

Returns a field to owner control (FR-023). Body empty.

Response is the updated profile, same shape as `GET`.

| Condition | Status | Code |
|---|---|---|
| Field is already owner-controlled | `409` | `FIELD_NOT_STAFF_CONTROLLED` |
| Not staff | `403` | `FORBIDDEN` |
| Unknown field | `400` | `VALIDATION_ERROR` |

The `409` exists so the rule holds against a direct request; the interface does not offer release on
an owner-controlled field at all (spec edge case).

**Side effects**: `controlledBy` → `owner`; `setBy*` and `setAt` **unchanged**; one
`ProfileFieldHistory` `control` entry; one `StaffActionRecord` with `action: "profile_release"`.

### `GET /api/staff/users/:id/profile/fields/:field/history` → `200`

```json
{
  "history": [
    {
      "changeKind": "control",
      "newControlledBy": "owner",
      "actorKind": "staff", "actorName": "Ayesha Khan",
      "at": "2026-08-28T15:02:00.000Z"
    },
    {
      "changeKind": "value",
      "previousValue": "Block B, desk 7",
      "previousSetByKind": "owner", "previousSetByName": "Sara Alkaff",
      "previousSetAt": "2026-07-02T11:14:00.000Z",
      "actorKind": "staff", "actorName": "Ayesha Khan",
      "at": "2026-08-28T14:20:11.000Z"
    }
  ]
}
```

Newest first. `previousValue` is typed per field — a string for `location` and `hardware`, an array of
`{tool, id}` for `remoteAccessIds` (`research.md` R11).

**Staff only, with no owner-facing equivalent.** `403` for a non-staff account, and **no route exists**
under `/api/my/` that returns history (FR-018). Its absence is the enforcement.

Pre-feature `staffEntries` corrections do **not** appear here (FR-025).

---

## Account owner: own profile (role: any signed-in account)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/my/profile` | session | Read own profile with provenance |
| `PUT` | `/api/my/profile` | session | Edit own **owner-controlled** fields |

### `GET /api/my/profile` → `200`

Same profile shape as the staff read, **minus nothing and plus nothing**: the owner sees each field's
current value with `setByName` and `setAt`, and `controlledBy` so the client knows what is editable
(FR-017, FR-020).

**No `history` key, ever.** FR-018 makes history staff-only; there is no owner route that returns it.

`staffEntries` continue to be visible to the owner exactly as today (FR-025).

### `PUT /api/my/profile`

Body unchanged from today: any of `location`, `hardware`, `remoteAccessIds`.

**Per-field control check.** A field whose `controlledBy` is `staff` is refused; owner-controlled
fields in the same request are applied. Same per-field outcome map as the staff endpoint:

```json
{
  "results": {
    "hardware": { "outcome": "applied" },
    "location": { "outcome": "locked", "currentSetByName": "Ayesha Khan", "currentSetAt": "…" }
  },
  "profile": { /* … */ }
}
```

| `outcome` | Meaning |
|---|---|
| `applied` | Saved. `setBy*` records the owner (FR-024). Control stays with the owner |
| `locked` | Refused: staff control this field. Who set it and when are returned so the page can explain (FR-021, FR-022) |

This is the "owner submits a change to a field locked after they opened the page" case: refused with
an explanation, never applied silently, and never silently discarded (spec edge case).

**An owner write never changes `controlledBy`** and never appends a `StaffActionRecord`. It does
append a `ProfileFieldHistory` `value` entry, because FR-018 retains every field's previous value
regardless of who wrote it — the owner simply cannot read it back.

| Condition | Status | Code |
|---|---|---|
| Not signed in | `401` | `UNAUTHENTICATED` |
| Attempting another account's profile | — | **No such route.** `/api/my/*` is scoped to the session's account (FR-027) |

---

## Access control summary (SC-006)

| Surface | user (owner) | user (other) | staff | maintainer key |
|---|---|---|---|---|
| `/api/maintainer/status` | ✅ | ✅ | ✅ | ✅ (unauthenticated by design) |
| `/api/maintainer/*` | ❌ 401 | ❌ 401 | ❌ 401 | ✅ |
| `/api/staff/accounts` | ❌ 403 | ❌ 403 | ✅ | ❌ (no session) |
| `/api/staff/users/:id/profile*` | ❌ 403 | ❌ 403 | ✅ | ❌ |
| `…/fields/:field/history` | ❌ 403 | ❌ 403 | ✅ | ❌ |
| `/api/my/profile` | ✅ own only | n/a | ✅ own only | ❌ |
| Any ticket, conversation, or account route | per 001/004 | per 001/004 | per 004 | ❌ **no path exists** (FR-015) |

A staff member is also an account owner and reaches their own profile through `/api/my/profile` like
anyone else. Staff editing their own profile through the staff surface is permitted and recorded
identically (spec edge case).

---

## Endpoints deliberately absent

Naming these is part of the contract; each is a path someone will otherwise assume exists.

| Not built | Why |
|---|---|
| Owner-facing field history | FR-018 — staff-only |
| Any route that promotes an account or grants staff | Principle III — the seed script only |
| Any maintainer route touching accounts, tickets, or roles | FR-015 |
| Delete or edit on a `ProfileFieldHistory` entry | Append-only (FR-018) |
| Delete or edit on a `MaintainerSignInAttempt` record | Append-only (FR-035) |
| Revert or delete on a guide version | Versions are immutable |
| A change-request queue for owners asking to unlock a field | Spec Out of Scope — the existing chat escalation covers it |
| Staff creation or deletion of accounts | Spec Out of Scope |
| Bulk profile edit or profile import | Spec Out of Scope (import remains 004's Excel path) |
| A maintainer session, token, or cookie | Principle III, FR-014 |
