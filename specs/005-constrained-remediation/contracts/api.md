# API Contract: Constrained Automated Remediation

**Feature**: `005-constrained-remediation` | Base path: `/api` (existing Express app)

Conventions unchanged from features 001 and 004: JSON bodies, zod-validated at the boundary;
errors as `{ error: { code, message } }`; plain-language messages (NFR-2). Auth is an opaque
session token in an `httpOnly` cookie. `401` when signed out, `403` when role-refused, and a
refusal carries a clear message and **no resource data**.

Two contract-level rules govern everything below.

1. **No endpoint accepts a host, address, port, or connection detail.** Targets are named
   only by registry `endpointId`, and most requests do not name a target at all because it is
   resolved from the policy entry and the ticket. There is no request shape by which a caller
   reaches an unregistered host (FR-003).
2. **No endpoint modifies or deletes an action record, an approval decision already made, the
   action policy, or the endpoint registry.** These paths do not exist, in any role, including
   staff and maintainer (FR-005, FR-010).

---

## Employee surfaces (role: any signed-in user, own ticket only)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/tickets/:id/actions/consent` | session, ticket owner | Record explicit consent for one specific proposed action. Body `{ proposalId, granted: boolean }`. Granting a read-only proposal permits execution; granting a state-changing proposal raises an approval request (FR-004, FR-004a). Declining records the decision and raises nothing (US3 AS4). |
| GET | `/tickets/:id/actions` | session, ticket owner or staff | Action records and pending approvals for this ticket, in plain-language form for the reporter (US3 AS6). |

`proposalId` identifies the specific action the agent proposed in this conversation turn. A
consent call carrying an unknown, stale, or already-consumed `proposalId` is refused. Consent
is per proposal, never per category, endpoint, or session.

Acting on a ticket the caller does not own is refused with `not_ticket_owner` and audited,
consistent with the existing own-ticket isolation (edge case).

---

## Staff surfaces (role: staff)

### Approval queue

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/staff/approvals` | staff | Pending approval requests. Each carries ticket reference, policy entry id and its plain description, exact command and arguments, target endpoint, reporter consent, `raisedAt`, and `expiresAt`. Requests past `expiresAt` are transitioned to `expired` on read and are not returned as pending (R6). Supports `?status=` filtering for history. |
| POST | `/staff/approvals/:id/approve` | staff | Approve and execute. Conditional on `status: "pending"`. |
| POST | `/staff/approvals/:id/decline` | staff | Decline. Body `{ reason? }`. Never executes. |

Both decision endpoints:

- return `409 APPROVAL_ALREADY_DECIDED` when the request is no longer `pending`, which is how
  two staff deciding at nearly the same moment resolves. Both attempts are attributed
  (edge case).
- return `409 APPROVAL_NO_LONGER_APPLICABLE` when a precondition fails at approval time:
  ticket already resolved, remediation disabled globally or for the endpoint, or the same
  action already executed for this ticket. The request closes as `no_longer_applicable` (R6).
- write a `StaffActionRecord` with action `approval_decision`, attributed to the deciding
  staff member (FR-004b).
- are refused under the same role and ticket-access rules that govern the rest of the
  dashboard, so a staff member cannot decide a request on a ticket they could not otherwise
  reach (edge case).

Approval is a decision on one specific proposed action. There is no endpoint that grants a
standing or category-wide approval, by design (spec assumption).

### Audit trail

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/staff/actions` | staff | The complete action trail across all tickets. Filters: `ticketId`, `endpointId`, `outcome`, `from`, `to`. Paginated. Executed and refused actions both appear, and both are returned by default (FR-021). |

There is deliberately **no** `PATCH`, `PUT`, or `DELETE` on `/staff/actions` or
`/staff/actions/:id`. Requests to those methods fall through to the existing 404 handler.
A test asserts this, because the absence is the requirement (FR-010, SC-002).

Non-staff callers receive `403` with no action data in the body (US4 AS6).

### Remediation availability

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/staff/remediation` | staff | Current posture: `{ globallyEnabled, endpoints: [{ id, label, enabled, description }] }`. |
| POST | `/staff/remediation/toggle` | staff | Body `{ scope: "global" }` or `{ scope: "endpoint", endpointId }`, plus `{ enabled: boolean }`. Writes a `StaffActionRecord` with action `remediation_toggle` (FR-008, FR-022). |

Disabling takes effect against anything not already executing. An action already running
completes and is audited; nothing new starts (R6, edge case).

### Metrics

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/staff/metrics?period=7d\|30d\|90d\|all` | staff | The metrics summary for the period (FR-023). Shape is the Metrics Summary in `data-model.md` §7. |

- Figures are computed on demand from the underlying records, never cached (R8, SC-009).
- A period with no data returns `hasData: false` and empty groupings, so the surface can say
  so plainly rather than render a misleading zero (US5 AS3).
- `period` outside the preset set is a `400`.
- Non-staff callers receive `403` (US5 AS4).

---

## Server-sent events (existing `/api/events` stream, extended)

New event types on the existing SSE channels, consumed by `frontend/src/services/useEvents.ts`.

| Event | Channel | Payload | Purpose |
|---|---|---|---|
| `action_proposed` | employee | `{ ticketId, proposalId, tier, description, endpointLabel }` | The agent offers an action. Drives the in-chat consent block. |
| `action_recorded` | employee, staff | `{ ticketId, actionRecordId, outcome, summary }` | An action executed or was refused. |
| `approval_pending` | employee, staff | `{ ticketId, approvalId, description }` | Employee sees "waiting on IT staff"; staff queue count updates (FR-004c). |
| `approval_decided` | employee, staff | `{ ticketId, approvalId, status, decidedBy? }` | Approved, declined, expired, or no longer applicable. |
| `remediation_availability_changed` | staff | `{ globallyEnabled, disabledEndpointIds }` | Drives the persistent disabled banner. |

Extending `EventHandlers` and `StaffEventHandlers` must not break the shipped `ticket_created`
and `ticket_updated` handlers, which are covered by existing tests (Design Direction,
regression risk table).

---

## Not exposed, deliberately

These absences are part of the contract and each has a test asserting the route does not exist.

| Absent surface | Why |
|---|---|
| Any endpoint that creates, edits, or disables a policy entry | FR-005. Policy is reviewed configuration changed outside the running system. |
| Any endpoint that registers, edits, or removes a test endpoint | FR-003, FR-005. Same reason, and it is the guarantee that no request can name a new host. |
| Any endpoint that edits or deletes an action record | FR-010. Append-only means no path, for any role. |
| Any endpoint that executes an action directly, bypassing consent, policy match, or approval | FR-002, FR-004. Execution is reachable only through the policy engine. |
| Any endpoint that grants a standing or category-wide approval | Spec assumption. Approval is per proposed action. |
| Any maintainer-key surface for remediation | Principle III. The `MAINTAINER_KEY` axis covers categories and guides, and gains nothing here. |

---

## Error codes introduced

| Code | Status | Meaning |
|---|---|---|
| `ACTION_REFUSED` | 200 in chat, recorded | Not an HTTP error: a refusal is a normal, audited outcome reported in plain language, never a 500. |
| `APPROVAL_ALREADY_DECIDED` | 409 | Another staff member decided first. |
| `APPROVAL_NO_LONGER_APPLICABLE` | 409 | A precondition failed at approval time. |
| `APPROVAL_NOT_FOUND` | 404 | Unknown or not visible to this staff member. |
| `PROPOSAL_INVALID` | 400 | Unknown, stale, or already-consumed `proposalId`. |
| `REMEDIATION_UNAVAILABLE` | 200 in chat, recorded | Disabled, or the policy or registry failed to load. Guidance and escalation continue (FR-008, edge case). |
| `METRICS_PERIOD_INVALID` | 400 | `period` outside the preset set. |

`ACTION_REFUSED` and `REMEDIATION_UNAVAILABLE` are listed as codes because they are recorded
and reported, not because they are HTTP failures. A refusal is the system working correctly
(Principle II), and the UI renders it neutrally rather than as an error (Design Direction).
