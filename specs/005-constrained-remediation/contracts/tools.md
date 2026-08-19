# Tool Registry Contract: Constrained Automated Remediation

**Feature**: `005-constrained-remediation`

This is the model-facing interface. Under Principle VIII, tool descriptions are load-bearing
interface text, because the model selects tools by reading them. They are versioned,
code-reviewed, and covered by the prompt regression tests exactly like the prompt modules.

Location: `backend/src/services/agent/tools/`, one module per tool.

## Registration shape

```ts
export interface RegisteredTool {
  name: string;                 // matches ActionPolicyEntry.id for every side-effecting tool
  description: string;          // accurate, plain language, no capability the policy does not grant
  argumentSchema: ZodSchema;    // validated before any policy match is attempted
  policyEntryId: string;        // 1:1 with a whitelist entry (FR-013)
}
```

## Rules

- **Every state-changing tool maps 1:1 onto an action policy entry.** A tool with no matching
  entry fails startup validation. An entry with no tool is permitted (an entry may exist purely
  as a `verifiedBy` verification action the model never selects).
- **A tool never executes.** Selecting a tool produces a *proposal*. The proposal goes through
  argument validation, then exact policy matching, then endpoint resolution, then the
  authorisation tier, and only then reaches the executor. The executor is called from the
  policy engine and from nowhere else (FR-002, FR-006).
- **Descriptions state what the action observes or changes, and on what.** A description may
  not imply reach the policy does not grant. The printer and peripheral tools say they inspect
  the test endpoint, not the employee's own hardware, and the password tools say they act on a
  local test account (R11, FR-019).
- **Arguments are enums or anchored patterns, never free text**, matching the `ArgumentSpec`
  in `data-model.md` §1. Model output is untrusted input, so an argument that fails its schema
  is refused and audited before any policy match is attempted (FR-006).
- **At most one tool call executes per loop step**, under `AGENT_MAX_STEPS` per employee turn.
  Reaching the cap, or making no progress, escalates (FR-011, FR-012).
- **A tool that has already failed for a ticket is not re-proposed for that ticket.** The
  agent never silently retries (FR-012, edge case).

## Initial registry

| Tool name | Tier | Policy entry | Observes or changes |
|---|---|---|---|
| `account_status` | read_only | `account-status` | Whether a local test account on the endpoint is locked, and whether its password is flagged for change. |
| `unlock_account` | state_changing | `unlock-account` | Unlocks a locked local test account on the endpoint. Verified by `account_status`. |
| `expire_password` | state_changing | `expire-password` | Forces a password change at next sign-in for a local test account on the endpoint. Verified by `account_status`. |
| `network_probe` | read_only | `network-probe` | Reachability and DNS resolution as seen from the endpoint. |
| `print_queue_status` | read_only | `print-queue-status` | Jobs currently queued on the endpoint's print service. |
| `clear_print_queue` | state_changing | `clear-print-queue` | Clears the endpoint's print queue. Verified by `print_queue_status`. |
| `peripheral_list` | read_only | `peripheral-list` | Devices visible to the endpoint. |
| `service_status` | read_only | `service-status` | State of a named approved service on the endpoint. |
| `restart_service` | state_changing | `restart-service` | Restarts a named approved service on the endpoint. Service name drawn from an enumeration in the policy entry. Verified by `service_status`. |

Nine entries: six read-only, three state-changing, each state-changing one verified.

## What the registry does not contain

- No tool that names or accepts a host, address, or port.
- No tool that reads, writes, or reloads the policy file or endpoint registry.
- No tool that reads or writes the audit trail.
- No tool that changes remediation availability, assigns a ticket, or alters a ticket's status
  outside the existing pipeline.
- No general-purpose "run a command" tool, in any form, under any name.
