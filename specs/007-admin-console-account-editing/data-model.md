# Data Model: Maintainer Admin Console & Staff-Authoritative Account Editing

**Feature**: `007-admin-console-account-editing` | **Date**: 2026-08-28

Phase 1 output. Derived from the spec's Key Entities and the decisions in `research.md`. Mongoose +
MongoDB, per Principle VI. Every shape below is zod-validated at the HTTP boundary before it reaches
these schemas.

**Summary of change**: two entities already exist and are untouched (Category, Guide Version). One
existing entity gains sub-documents (Support Profile). Two collections are new (Profile Field
History, Maintainer Sign-In Attempt). One entity is a projection with no storage of its own (Account
Directory Entry). One entity is deliberately **not persisted at all** (Maintainer Session).

---

## 1. Category — unchanged

`backend/src/models/` (existing). Machine name, display name, classification description, mandated
flag, retired flag.

**This feature adds no attributes and no new operations.** The console is a surface over
`guide-admin-service.ts`. Recorded here so the point is explicit: SC-007 requires the six mandated
categories survive any sequence of console operations, and the cheapest way to guarantee that is for
the console to introduce no new write path.

---

## 2. Guide Version — unchanged

Existing. Numbered, immutable step set per category; exactly one active; carries `changedBy`,
`changedAt`, `changeNote`.

**No attributes added.** `changedBy` is already populated from the `x-maintainer-name` header by
`admin-guides.ts`, which is what makes FR-003 (attribution to the name given at sign-in) true without
schema change.

---

## 3. Support Profile — extended

`backend/src/models/support-profile.ts`. Existing document, one per account, unique on `accountId`.

### 3.1 Unchanged fields

| Field | Type | Note |
|---|---|---|
| `accountId` | ObjectId → UserAccount, unique, indexed | Unchanged |
| `remoteAccessIds` | `[{ tool, id }]`, `_id: false` | Shape unchanged. **Treated as one field** for provenance, control, concurrency, and history (R11) |
| `location` | String, default `""` | Unchanged |
| `hardware` | String, default `""` | Unchanged |
| `staffEntries` | `[staffEntrySchema]` | **Retained with all existing data** (FR-025). See 3.4 |

### 3.2 New: per-field provenance and control

One new sub-document per support field, on the profile:

```
fieldState: {
  location:        FieldState,
  hardware:        FieldState,
  remoteAccessIds: FieldState,
}
```

`FieldState` (sub-schema, `_id: false`, all optional so existing documents read correctly):

| Field | Type | Required | Meaning |
|---|---|---|---|
| `setByKind` | `"owner" \| "staff"` | no | Who last wrote the current value |
| `setById` | ObjectId → UserAccount | no | The author's account |
| `setByName` | String | no | Author's display name, denormalised at write time |
| `setAt` | Date | no | When the current value was written. **Doubles as the concurrency token** (R7) |
| `controlledBy` | `"owner" \| "staff"`, default `"owner"` | no | Who may edit the field now |

**Denormalising `setByName`** matches the existing `staffEntries.staffName` precedent: the byline must
still read correctly if a display name later changes, and the profile must render without a join.

**Reading a document written before this feature** (R8): every `FieldState` is absent. The service's
`view()` presents an absent state as
`{ setByKind: "owner", setById: null, setByName: null, setAt: null, controlledBy: "owner" }`.
No backfill runs.

### 3.3 Derived rules (enforced in the service, not the schema)

- **Owner may write field F** ⟺ `fieldState[F].controlledBy === "owner"`.
- **Staff may write any field**, and a staff write sets `controlledBy = "staff"` (FR-021).
- **Release** sets `controlledBy = "owner"` and changes nothing else — `setByKind`, `setById`,
  `setByName`, `setAt`, and the value are all preserved (R5, FR-017 + AS10 together).
- **Release is only available when `controlledBy === "staff"`.** Releasing an owner-controlled field
  is rejected as invalid, and the interface does not offer it (spec edge case).
- **Every write, by anyone, updates `setBy*` and `setAt`** — including an owner write, which records
  the owner as author (FR-024).
- **Clearing a field is a write**, not a delete: the empty value gets provenance and the previous value
  goes to history (spec edge case).

### 3.4 `staffEntries` — retained, one write path retired

The sub-schema is unchanged and no stored entry is modified, moved, or reinterpreted (FR-025).

| Aspect | Before | After |
|---|---|---|
| `kind: "note"` | Free-text staff note | **Unchanged.** Staff keep this (FR-025) |
| `kind: "correction"` | Value recorded beside a field, never overwriting | **No new ones are written.** Existing entries stay, stay readable, stay attributed |
| Effect on field value | None | Still none. A correction **never** becomes a value (FR-025) |
| Effect on field history | n/a | **None.** Corrections do not seed `ProfileFieldHistory` (FR-025) |
| Effect on control | None | **None.** A correction does not make a field staff-controlled (FR-025) |

The `correction` enum value stays on the schema so existing documents validate. The write path stops
accepting it. See `research.md` R9 for the 004 FR-012 supersession this implies.

### 3.5 Validation

Inherited unchanged from the existing `my.ts` profile schema, and now applied to the staff write path
too so both paths enforce one set of limits:

| Field | Rule |
|---|---|
| `location` | trimmed, ≤ 160 chars |
| `hardware` | trimmed, ≤ 500 chars |
| `remoteAccessIds` | ≤ 10 entries; each `tool` trimmed 1–80 chars, each `id` trimmed 1–160 chars |
| A remote entry with a tool but no id, or an id but no tool | Rejected, naming the offending entry (spec edge case) |

---

## 4. Profile Field History — new collection

`ProfileFieldHistory`. Append-only. One document per change to one field. Staff-readable only
(FR-018).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `accountId` | ObjectId → UserAccount | yes | Whose profile |
| `field` | `"location" \| "hardware" \| "remoteAccessIds"` | yes | Which field |
| `changeKind` | `"value" \| "control"` | yes | A value was replaced, or control moved |
| `previousValue` | Mixed (String, or `[{tool,id}]`) | no | The value being replaced. Typed per field (R11). Absent for a `control` change |
| `previousSetByKind` | `"owner" \| "staff"` | no | Author of the value being replaced |
| `previousSetByName` | String | no | Their display name |
| `previousSetAt` | Date | no | When the replaced value was written |
| `newControlledBy` | `"owner" \| "staff"` | no | Present on a `control` change: where control moved to |
| `actorKind` | `"owner" \| "staff"` | yes | Who made this change |
| `actorId` | ObjectId → UserAccount | yes | |
| `actorName` | String | yes | Denormalised, as above |
| `at` | Date, default now | yes | |

**Index**: `{ accountId: 1, field: 1, at: -1 }` — every read is "this field's history, newest first".

**Append-only, and visibly so.** No update path and no delete path exists at any layer, in any role,
matching the audit discipline Principle II establishes and 005 applied to its action records. The
Design Direction forbids an edit or delete affordance in the history disclosure, including a disabled
one.

**Written on**:

| Event | `changeKind` | Notes |
|---|---|---|
| Owner or staff writes a new value | `value` | Records the value being *replaced*, with its author and time |
| Staff writes a field the owner controlled | `value` + `control` | Two entries: the value replacement, and the control transfer to staff |
| Staff releases a field | `control` | `newControlledBy: "owner"`. No value change |
| A field is cleared | `value` | Previous value preserved (spec edge case) |
| A pre-feature correction exists | **nothing** | Corrections do not seed history (FR-025) |
| The first ever write to an empty field | `value` with `previousValue` absent | Distinguishable from "cleared to empty", which has an empty-string `previousValue` |

**Not written for the owner's own reads, and never returned to the owner.** FR-018 makes this
staff-only; R6 makes it a routing property rather than a projection rule.

---

## 5. Maintainer Sign-In Attempt — new collection

`MaintainerSignInAttempt`. Append-only record of refused console sign-ins (FR-035), and the source of
truth for the throttle count (FR-034, R4).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `clientKey` | String, indexed | yes | Hash of `req.ip`. Groups attempts by client |
| `at` | Date, default now, indexed | yes | When the attempt was refused |
| `outcome` | `"refused"` | yes | Present for future extension; only refusals are recorded |

**Index**: `{ clientKey: 1, at: -1 }`.

**There is no field for the supplied key, and none may be added.** FR-035 forbids recording it, and
the absence of a field is a stronger guarantee than a rule about not filling one in. The same applies
to any debug logging on this path (Principle VI keeps audit logging separate from debug logging;
neither may carry the key).

**Throttle evaluation**: count documents for `clientKey` with `at` inside the configured window. At or
above the threshold, refuse with the remaining cooling-off period. Successful sign-ins write nothing;
the count is time-windowed rather than reset, which keeps the collection append-only.

**Configuration** (committed defaults in `.env.example`, per Principle VI):

| Setting | Default | Meaning |
|---|---|---|
| `MAINTAINER_SIGNIN_MAX_FAILURES` | 5 | Consecutive refusals before cooling-off |
| `MAINTAINER_SIGNIN_COOLDOWN_SECONDS` | 300 | Cooling-off duration |

The console renders the server's reported remaining time; it does not hardcode these (Design
Direction, Open decisions).

---

## 6. Account Directory Entry — projection, not storage

No collection. A read-only projection over `UserAccount` (R10):

| Field | Source |
|---|---|
| `id` | `UserAccount._id` |
| `displayName` | `UserAccount.displayName` |
| `email` | `UserAccount.email` |
| `role` | `UserAccount.role` |

**Nothing else is projected** — not credential status, not availability, not ticket counts, not
profile content (NFR-5, FR-030). Anything more is a separate request the staff member deliberately
makes.

Search matches a case-insensitive substring of `displayName` or `email` (FR-031).

---

## 7. Maintainer Session — deliberately not persisted

The key and display name a maintainer supplies. **No collection, no document, no server-side session,
no cookie, no token.**

- Held in React state for as long as the console is open, and sent per request as
  `x-maintainer-key` + `x-maintainer-name`, which the existing `maintainer-auth.ts` already expects
  (R3, FR-014).
- Reload or reopen discards it and requires re-entry, because there is nothing to discard from.
- It creates no account and no role. Principle III's two-role model is untouched: the maintainer key
  remains "a shared-secret request header on a different axis entirely".

Listed as an entity because the spec lists it, and because the design-significant fact about it is
that it has **no** persistent representation.

---

## Entity relationships

```
UserAccount ──1:1──> SupportProfile
     │                     ├── fieldState.location        (FieldState)
     │                     ├── fieldState.hardware        (FieldState)
     │                     ├── fieldState.remoteAccessIds (FieldState)
     │                     └── staffEntries[]             (existing, untouched)
     │
     ├──1:N──> ProfileFieldHistory   (by accountId + field; staff-read only)
     │
     └──1:N──> StaffActionRecord     (existing; gains profile_edit and profile_release)

MaintainerSignInAttempt              (no relationship to any account, by design)

Category ──1:N──> GuideVersion       (existing, unchanged)
```

---

## 8. Staff Action Record — two new action values

`backend/src/models/staff-action.ts`, existing. FR-026 requires every staff edit and every field
release be recorded there alongside the other staff actions.

| Action value | When | `details` |
|---|---|---|
| `profile_edit` | A staff member saves one or more fields | `{ fields: ["location", ...] }` — the fields **actually applied**, not the fields submitted |
| `profile_release` | A staff member releases a field | `{ field: "location" }` |

The existing `profile_append` value stays for notes.

**Only applied fields are recorded.** In a partial save where one field was refused for conflict
(R7), the record must not claim the refused field was edited. This is the same honesty rule the
Design Direction applies to the response rendering.

---

## State transitions: field control

```
                    staff writes a value
   ┌────────────────────────────────────────────────┐
   │                                                ▼
OWNER-CONTROLLED                            STAFF-CONTROLLED
   ▲  • owner may edit                       • owner may view, not edit
   │  • staff may edit (→ transitions)       • staff may edit (stays here)
   │  • release unavailable                  • release available
   │                                                │
   └────────────────────────────────────────────────┘
                    staff releases the field
```

- Every profile starts owner-controlled, including profiles that predate this feature (R8).
- Each transition is one `ProfileFieldHistory` entry with `changeKind: "control"`. Set → release →
  set produces three entries, and control ends where the last one left it (spec edge case).
- Transitions are per field. The remote access list transitions as a whole (R11).
- A pre-feature `correction` entry causes no transition (FR-025).

---

## Migration

**None.** No script, no backfill, no data rewrite. Existing `SupportProfile` documents are read with
lazy defaults (R8, §3.2); the two new collections start empty. Rollback is removing the new fields
and collections, with no stored data reinterpreted in the meantime.
