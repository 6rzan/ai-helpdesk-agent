# Phase 1 Data Model: Constrained Automated Remediation

**Feature**: `005-constrained-remediation` | **Date**: 2026-08-19

Two storage classes appear here and the split is load-bearing.

- **Policy data** lives in committed files, is validated at startup, and is never written by
  the running system (FR-005, Principle II). Files: the action policy and the endpoint
  registry.
- **Operational data** lives in MongoDB via Mongoose, alongside the existing collections.

Anything the agent could conceivably modify at runtime must not be policy. Anything that
defines what the agent may do must not be operational.

---

## 1. Action Policy Entry (file: `backend/src/policy/action-policy.json`)

The whitelist. One entry per permitted automated action. Read once at startup, zod-validated,
frozen. No write path exists anywhere in the codebase.

```jsonc
{
  "version": "1.0.0",
  "entries": [ /* ActionPolicyEntry[] */ ]
}
```

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique, stable, kebab-case. Referenced by tools, records, and requests. Never reused after removal. |
| `description` | string | Plain-language statement of what the action does. Shown to the employee (NFR-2) and used in the tool description. |
| `category` | string | The issue category this serves, or `null` if it serves any. Must exist in the categories collection. |
| `guidedStepRef` | string \| null | Optional guided step this action can satisfy or inform. Never lets the action reorder or skip steps (FR-014). |
| `tier` | `"read_only"` \| `"state_changing"` | Determines the authorisation required (FR-004). Comes from the entry, never from agent judgement. |
| `command` | string | Fixed command template. Contains only literals and named argument placeholders. |
| `arguments` | ArgumentSpec[] | Declared arguments. Empty for actions with none. |
| `allowedEndpointIds` | string[] | Non-empty. Endpoint ids from the registry this entry may target. |
| `verifiedBy` | string \| null | For `state_changing` entries, the `id` of a `read_only` entry that observes whether it worked (R10). |
| `timeoutMs` | number \| null | Per-entry override of the default command timeout. |

### ArgumentSpec

| Field | Type | Rules |
|---|---|---|
| `name` | string | Matches a placeholder in `command`. |
| `kind` | `"enum"` \| `"pattern"` | No free-text argument kind exists. |
| `values` | string[] | Required when `kind` is `enum`. The complete permitted set. |
| `pattern` | string | Required when `kind` is `pattern`. Anchored regex, no alternation into whitespace or shell metacharacters. |

**Validation rules**

- Every placeholder in `command` has a matching `ArgumentSpec`, and every `ArgumentSpec` has
  a matching placeholder. No orphans in either direction.
- Every `allowedEndpointIds` value exists in the endpoint registry. Startup fails otherwise.
- Every `state_changing` entry either names a valid `read_only` `verifiedBy` entry, or the
  outcome of executing it can only ever be `attempted_unverified` (R10).
- `id` values are unique.
- A policy file that fails validation means remediation is **unavailable**, never permissive
  (edge case: empty or missing policy). Guidance and escalation are unaffected.

**Matching is exact.** An action executes only when its `id`, every argument, and the target
endpoint all match an entry exactly. There is no fuzzy, prefix, or nearest-neighbour match
anywhere in the path (FR-002, US2 AS3).

---

## 2. Test Endpoint (file: `backend/src/policy/test-endpoints.json`)

The registry of designated isolated endpoints. Registered outside the running conversation.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique, stable. The only way an action names a target. |
| `label` | string | Human-readable name shown to staff. |
| `host` | string | Container host reachable from the demo machine. |
| `port` | number | SSH port. |
| `username` | string | Account the executor connects as. |
| `hostKeyFingerprint` | string | Pinned at setup. Verified on every connection (R2). |
| `description` | string | What this endpoint is for, shown in the audit view. |

Secrets are absent by construction: the private key path and passphrase come from
environment configuration, never from this file.

**Rules**

- An action's target is resolved from the policy entry and the ticket context. Nothing an
  employee types, and nothing the model emits, can name a host (FR-003, spec assumption).
- An endpoint missing from the registry is not reachable. There is no fallback host, no
  default target, and no configuration path that supplies one at request time.
- An endpoint that is registered but absent from the environment produces a failed, audited
  attempt and an escalation. The agent never removes it from the registry (edge case).

---

## 3. Remediation Availability (Mongo: `remediationSettings`)

The staff-controlled kill switch (FR-008, FR-022). Operational, not policy: staff change it
at runtime, which is exactly why it may not live in the policy files.

| Field | Type | Notes |
|---|---|---|
| `_id` | fixed singleton key | One document. |
| `globallyEnabled` | boolean | Default from `REMEDIATION_ENABLED`, default `false`. |
| `disabledEndpointIds` | string[] | Endpoint ids currently disabled individually. |
| `updatedAt` | Date | |

An action may execute only when `globallyEnabled` is true **and** its target endpoint is not
in `disabledEndpointIds`. The check runs immediately before execution, so a disable takes
effect against anything not already running (R6).

Every change is also written to the existing `StaffActionRecord` trail, attributed to the
staff member who made it (FR-022). This requires two new values in `STAFF_ACTIONS`:
`remediation_toggle` and `approval_decision`, and one new value in `STAFF_ACTION_TARGETS`:
`remediation`.

---

## 4. Approval Request (Mongo: `approvalRequests`)

One pending state-changing action awaiting a staff decision (FR-004a, FR-004b). Nothing
state-changing executes without one.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ticketId` | ObjectId → Ticket | Indexed. |
| `conversationId` | ObjectId → Conversation | For returning the outcome into the chat. |
| `policyEntryId` | string | The exact action. |
| `arguments` | Record<string, string> | Already validated against the entry when the request was raised. |
| `endpointId` | string | Resolved target. |
| `consent` | ConsentRecord | The reporter's recorded consent. Required at creation. |
| `status` | enum | `pending`, `approved`, `declined`, `expired`, `no_longer_applicable`. |
| `raisedAt` | Date | |
| `expiresAt` | Date | `raisedAt + REMEDIATION_APPROVAL_TTL_MINUTES`. |
| `decidedBy` | { accountId, displayName } \| null | Set on approve or decline. |
| `decidedAt` | Date \| null | |
| `closureReason` | string \| null | Set for `expired` and `no_longer_applicable`. |
| `resultingActionRecordId` | ObjectId \| null | Set once execution produces a record. |

### ConsentRecord (embedded, also used on Action Record)

| Field | Type | Notes |
|---|---|---|
| `given` | boolean | |
| `byAccountId` | ObjectId → UserAccount | The reporter. |
| `at` | Date | |
| `messageId` | ObjectId → Message | The exact message that constituted consent. Silence, ambiguity, or earlier general willingness is not consent (FR-004). |

### State transitions

```
                    ┌─ approve ──→ approved ──→ (execute) ──→ Action Record
pending ────────────┼─ decline ──→ declined
                    ├─ expiry ───→ expired
                    └─ precondition fails ──→ no_longer_applicable
```

**Rules**

- Only `pending` requests may transition. Every transition is a conditional update on
  `status: "pending"`, so concurrent decisions resolve with the first writer winning and the
  second receiving a clean conflict (R6).
- `expired` is evaluated lazily when the queue is listed or a decision is attempted. **Expiry
  never means approval** (edge case, FR-004b).
- On approval, preconditions are re-checked before execution: ticket still open, remediation
  enabled globally and for the endpoint, and the same action not already executed for this
  ticket. Failure closes the request as `no_longer_applicable` (R6).
- A declined, expired, or no-longer-applicable request produces no execution and the case
  proceeds by guidance or escalation (US3 AS3).
- Approval is a decision on one specific proposed action. There is no standing, per-category,
  per-endpoint, or per-session approval (spec assumption).

---

## 5. Action Record (Mongo: `actionRecords`)

The immutable audit entry for every executed **and** every refused action (FR-009, FR-010).
This is the evidence artifact the whole feature is judged on.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `at` | Date | Indexed. |
| `actor` | `"agent"` \| `"user"` \| `"staff"` \| `"system"` | Reuses the existing `ACTORS` enum. |
| `ticketId` | ObjectId → Ticket \| null | Indexed. Null only for actions refused before a ticket exists. |
| `conversationId` | ObjectId → Conversation \| null | |
| `classifiedIntent` | string | What the agent understood the request to be. |
| `policyEntryId` | string \| null | Null when nothing in the whitelist matched. |
| `tier` | `"read_only"` \| `"state_changing"` \| null | From the matched entry. |
| `requestedAction` | string | Exact command as it would run, or the unmatched request as classified. |
| `arguments` | Record<string, string> | |
| `endpointId` | string \| null | Null for unmatched or unregistered-target refusals. |
| `authorisation` | AuthorisationRecord | Consent and approval relied upon. |
| `outcome` | enum | See below. |
| `refusalReason` | enum \| null | See below. |
| `observedOutput` | string \| null | Captured command output, length-bounded. |
| `verification` | { entryId, outcome, observedOutput } \| null | Result of the verification action (R10). |
| `durationMs` | number \| null | |

### Outcome vocabulary

`succeeded`, `failed`, `timed_out`, `attempted_unverified`, `refused`.

This vocabulary is **separate from ticket status**. `StatusBadge.tsx` stays the single
source of ticket-status colour and does not absorb these values (Design Direction).

### Refusal reason vocabulary

`no_matching_entry`, `argument_mismatch`, `unregistered_target`, `endpoint_not_permitted`,
`missing_consent`, `missing_approval`, `remediation_disabled`, `low_confidence`,
`degraded_model`, `not_ticket_owner`, `already_attempted`, `step_cap_reached`.

Each maps to a specific requirement. `degraded_model` exists because FR-025 forbids acting
on a classification produced while the model is degraded. `not_ticket_owner` covers the
edge case where someone acts on a ticket they do not own.

### AuthorisationRecord (embedded)

| Field | Type | Notes |
|---|---|---|
| `consent` | ConsentRecord \| null | |
| `approval` | { requestId, byAccountId, displayName, at } \| null | Present for every executed state-changing action, without exception (SC-005a). |

### Immutability

- No route, service, or repository function updates or deletes an action record.
- Mongoose `pre` hooks on `findOneAndUpdate`, `updateOne`, `updateMany`, `deleteOne`,
  `deleteMany`, and `findOneAndDelete` throw. Schema is `strict: "throw"`.
- Tests assert each of those paths throws (R7).

### Relationship to the existing staff-action trail

Action records **extend** the audit discipline; they do not duplicate
`StaffActionRecord` (FR-010). The split is clean:

- `StaffActionRecord` - what a **human** did on the dashboard (takeover, reassign, resolve,
  and now approval decisions and remediation toggles).
- `ActionRecord` - what the **agent** executed or was refused from executing.

The ticket detail view interleaves both into the one existing history timeline. It does not
build a second timeline and does not print the same event twice (Design Direction).

---

## 6. Ticket (existing, extended by reference only)

No schema change. Action records link to tickets by `ticketId`, so:

- Tickets that predate this feature are unaffected and simply carry no action records
  (edge case).
- The ticket detail response gains an `actions` array assembled from `actionRecords`, and a
  `pendingApprovals` array from `approvalRequests`.
- The reporter and staff both see, on the ticket, exactly what was executed, against which
  endpoint, on whose consent and whose approval, and with what outcome (US3 AS6, SC-005).

---

## 7. Metrics Summary (derived, not stored)

Computed on demand by aggregation over `tickets` and `actionRecords` for a selected period
(R8). No collection, no cache, no materialised view. Shape:

| Field | Source |
|---|---|
| `period` | The requested preset and its resolved date bounds. |
| `ticketVolume` | Count of tickets created in the period. |
| `categorySplit` | Volume grouped by `category`. |
| `statusSplit` | Volume grouped by `status`. |
| `resolvedWithoutHuman` | Count and proportion, per the R8 definition. |
| `escalationRate` | Escalated tickets over volume. |
| `actionOutcomes` | Action records grouped by outcome, including refusals. |
| `timeToResolution` | Median and distribution buckets. |
| `providerFallbacks` | Count of provider fallback events (R4). |
| `hasData` | Boolean. Drives the honest no-data state rather than a zero-filled frame (FR-023, US5 AS3). |

---

## Entity relationship summary

```
ActionPolicyEntry (file) ──allowedEndpointIds──→ TestEndpoint (file)
        │                                              │
        │ policyEntryId                                │ endpointId
        ↓                                              ↓
ApprovalRequest ──resultingActionRecordId──→ ActionRecord ──ticketId──→ Ticket
        │                                              │                   │
        └──ticketId───────────────────────────────────┘                   │
                                                                           │
RemediationAvailability (singleton) ──gates execution                      │
StaffActionRecord (existing) ──targetId──────────────────────────────────┘
```
