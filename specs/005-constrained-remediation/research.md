# Phase 0 Research: Constrained Automated Remediation

**Feature**: `005-constrained-remediation` | **Date**: 2026-08-19

Every unknown in the plan's Technical Context is resolved below. No `NEEDS CLARIFICATION`
markers remain. Decisions are recorded with the alternative that was rejected, because the
viva will ask why for most of them.

---

## R1. Test endpoint runtime on the demo machine

**Decision**: Two or more Linux containers running OpenSSH, orchestrated by a committed
Docker Compose file, on Docker Desktop with the WSL2 backend. Endpoint definitions live in
`backend/test-endpoints/` (compose file, image build context, and a reset script).

Chosen images and roles:

| Endpoint id | Role | Extra software |
|---|---|---|
| `test-node-a` | General service and account node | OpenSSH, a systemd-free service supervisor, one approved dummy service, local test accounts |
| `test-node-b` | Print node, and the unregistered-target contrast case | OpenSSH, CUPS |

**Rationale**:

- Containers are the lightest form that still exercises the real SSH path the IR names
  (O-3, FR-020). An idle Debian-slim container running `sshd` sits in the tens of megabytes
  of RSS, so two of them are negligible against the 16 GB envelope that LM Studio's
  `qwen2.5-7b-instruct` already occupies (NFR-7).
- `docker compose down -v && docker compose up -d` returns the environment to a known state
  between demo runs, which FR-020 requires. That is a single documented command, which
  matters for the release-gated demo path (SC-008).
- Two distinct endpoints are the minimum that makes endpoint-scoped policy and
  unregistered-target refusal (FR-003, US2 AS2) demonstrable rather than asserted.

**Alternatives considered**:

- *Podman Desktop*: rootless and daemonless, which is genuinely nicer security posture, but
  the Windows setup path is rougher and less recognisable to a marker. The isolation
  benefit is redundant here because the whole environment is already disposable.
- *Full VMs (VirtualBox / Hyper-V)*: several gigabytes of RAM each. Directly conflicts with
  NFR-7 while the local model is loaded.
- *Windows OpenSSH server on the demo machine itself*: rejected outright. The machine
  hosting the app is not an isolated test endpoint, and the spec's own assumptions exclude
  it. Registering it would make NFR-3 false.

**Consequence for the plan**: a container runtime joins the documented prerequisites
alongside the existing replica-set MongoDB requirement, and `quickstart.md` must carry the
setup and reset commands.

---

## R2. How commands reach the endpoint

**Decision**: the `ssh2` npm package (plus `@types/ssh2`), used directly. Key-based
authentication with a keypair generated during environment setup; the private key path and
passphrase come from environment configuration and are never committed. Host keys captured
at setup and pinned through `ssh2`'s `hostVerifier`.

**Rationale**:

- `ssh2` is pure JavaScript, so there is no native build step to break on the Windows demo
  machine.
- Decisively: `ssh2` takes host, port, and user as **structured parameters**. There is no
  command line to assemble, so there is no place for an injected host to appear. FR-003
  says there must be no path by which an action reaches an unregistered host, and a
  structured API makes that a property of the code rather than a property of careful string
  handling.
- It exposes per-connection and per-channel lifecycle control, which is what FR-007's
  bounded execution needs.
- Host-key pinning turns "the registry says this is endpoint A" into "this is verifiably
  endpoint A".

**Alternatives considered**:

- *Spawning the Windows `ssh.exe` binary*: requires building a command line from a target
  and a command. That is exactly the injection surface FR-003 and FR-006 exist to remove.
  Rejected on safety grounds, not convenience.
- *`node-ssh`*: a thin wrapper over `ssh2`. Adds a dependency layer and hides the lifecycle
  control the timeout requirement needs.

**Command construction rule that follows from this**: no employee text and no model output
ever becomes part of a command string. A policy entry holds a fixed command template; the
only variable parts are arguments drawn from an enumeration or a strict pattern declared in
that same entry, zod-validated before substitution. See R3.

---

## R3. Where the action policy and endpoint registry live

**Decision**: two committed JSON files loaded once at startup, validated by zod, and frozen
in memory:

- `backend/src/policy/action-policy.json` - the whitelist, carrying a top-level `version`.
- `backend/src/policy/test-endpoints.json` - the endpoint registry. Identifiers, host, port,
  user, and which policy entries may target it. **No secrets**: key paths and passphrases
  come from environment configuration.

There is no code path that writes either file, and no Mongo collection mirrors them.

**Rationale**:

- Principle II requires the whitelist to be "versioned, reviewable policy data, never
  conditions scattered through code". A file in git satisfies both halves literally: git
  history *is* the version record and the diff *is* the review.
- FR-005 forbids any runtime path to create, modify, or disable the policy. If the policy
  is a file read at boot and never written, that guarantee is architectural rather than
  disciplinary. It is also trivially demonstrable in the viva: there is no write call to
  point at.
- JSON needs no new parser dependency. The zod schema at load time is the same
  validate-at-the-boundary discipline Principle VI already mandates.

**Alternatives considered**:

- *A MongoDB `actionPolicies` collection seeded from a script*: rejected. Anything in the
  database is mutable at runtime by definition, so FR-005 would degrade from a structural
  guarantee to a promise that no one adds a write path later.
- *YAML*: more comment-friendly for reviewers, but adds a dependency for a file that a JSON
  `description` field already documents adequately.
- *Policy entries as TypeScript constants*: this is the "conditions in code" form Principle
  II names explicitly. Rejected.

---

## R4. Ordered model provider fallback chain (closes CD-1)

**Decision**: mirror the shipped speech-to-text chain exactly. Add `LLM_PROVIDERS`, an
ordered comma-separated list, to the config schema. `LLM_PROVIDER` stays as a deprecated
single-value input: when `LLM_PROVIDERS` is absent, the chain is derived from it, so every
existing `.env` keeps working unchanged (FR-024 AS3). A `ChainedLlmProvider` implements the
existing `LlmProvider` interface, so no caller changes.

Per-method fallback semantics:

| Method | Behaviour on provider failure |
|---|---|
| `classifyAndReply` | Try the next provider. Return `{ ok: false, reason: "llm_unavailable" }` only when every provider has failed. |
| `interpretStepReply` | Same as above. |
| `streamReply` | Fall through to the next provider **only before the first token has been emitted**. After the first token, a failure ends the stream and degrades visibly. |
| `health` | Healthy if any provider in the chain is healthy. |

**Rationale**:

- `backend/src/services/stt/stt-service.ts` already implements this shape, with a parsed
  chain, a per-provider timeout wrapper, per-provider warn logging, and a chain-exhausted
  error. Reusing a proven in-repo pattern is cheaper and more defensible than inventing a
  second one.
- The stream rule is the subtle part. Silently switching provider mid-stream would splice
  two different models' half-sentences together and present the result as one answer. That
  is a correctness and honesty failure, not a resilience win. Ending the stream and
  degrading visibly is the behaviour FR-024 actually asks for.
- Keeping `LLM_PROVIDER` working means closing CD-1 introduces no migration step before the
  demo.

**Recording the fallback for staff (US6 AS1)**: structured log entry at `warn` on every
fallback, always. Additionally, when the fallback happens inside a conversation that already
has a ticket, a system entry lands on that ticket's history. A `providerFallbacks` count
appears in the metrics period summary.

The fallback is deliberately **not** written to the action audit trail. That trail's value
comes from SC-002's claim that it contains every executed and refused action and nothing
else. Diluting it with infrastructure events weakens the exact property the feature is
built to prove.

**Alternatives considered**:

- *Health-scored or latency-based routing*: rejected by the spec's own assumption. The chain
  is configuration, tried in order, with no scoring or reordering.
- *A new `SystemEvent` collection*: a whole model for one event type that structured logging
  and the metrics counter already cover.

---

## R5. Bounded plan → act → observe loop and the tool registry

**Decision**: a dedicated agent loop module under `backend/src/services/agent/`, invoked
**only** at the points in the guided flow where an approved action may apply. It does not
replace the deterministic classification and guidance pipeline.

One iteration:

1. **Plan** - the model is asked to propose at most one tool call from the registered tool
   set, or none.
2. **Validate** - the proposal is zod-checked against the tool's argument schema, then
   matched exactly against the action policy and the endpoint registry. Anything that fails
   either check is refused and audited (FR-006, US2 AS4).
3. **Authorise** - the tier from the policy entry decides what is required: reporter consent
   for read-only, reporter consent plus staff approval for state-changing (FR-004).
4. **Act** - the executor runs it. The executor is called from the policy engine and from
   nowhere else.
5. **Observe** - the result feeds the next iteration and the guided flow.

Bounds: `AGENT_MAX_STEPS` per employee turn, default **3**. Hitting the cap escalates
(FR-012). No-progress detection escalates too, and is defined concretely as either the same
`(tool, arguments)` pair proposed twice in one turn, or two consecutive iterations that
propose no tool call while the turn is unresolved.

**Tool registry**: `backend/src/services/agent/tools/`, one module per tool, each exporting
`{ name, description, argumentSchema, policyEntryId }`. Every state-changing tool maps 1:1
onto a policy entry (FR-013). Descriptions are load-bearing interface text under Principle
VIII, so they are reviewed like code and covered by the prompt regression tests.

**Rationale**: Principle VIII's staging clause activates here precisely because
side-effecting tools now exist. Scoping the loop to the moments where an action is
applicable keeps the shipped deterministic pipeline (and its passing test suite) intact,
which matters because FR-014 forbids reordering or skipping guided steps to make room for
an action.

**Alternatives considered**:

- *Replacing the whole conversation pipeline with a general agent loop*: a large regression
  surface across three shipped features, in exchange for capability the feature does not
  need. Rejected.
- *An off-the-shelf agent framework*: the constitution's technology table explicitly rules
  out a heavyweight agent framework, and a framework's own tool-calling path would sit
  between the model and the policy engine, which is the one place nothing may sit.

---

## R6. Approval request lifecycle, expiry, and concurrent decisions

**Decision**:

- **Expiry is lazy, not scheduled.** A pending request carries `expiresAt`
  (`REMEDIATION_APPROVAL_TTL_MINUTES`, default 30). It is treated as expired when the queue
  is listed or when a decision is attempted on it, and the transition to `expired` is
  recorded at that moment. There is no background worker.
- **Concurrent decisions resolve by conditional update.** Deciding is a single
  `findOneAndUpdate({ _id, status: "pending" }, ...)`. MongoDB makes a single-document
  update atomic, so the first writer wins and the second receives a clean conflict response.
  Both attempts are attributed (edge case: two staff deciding at once).
- **Preconditions are re-checked at approval time, not only at request time.** Approval
  executes only if the ticket is still open, remediation is enabled globally and for the
  target endpoint, and the same action has not already been executed for this ticket.
  Otherwise the request closes as `no_longer_applicable` and is recorded as such.
- **Disable during a running action**: the enable check happens immediately before
  execution. A running action finishes and is audited; nothing new starts (edge case, FR-008).

**Rationale**: a scheduler is an extra moving part in a system whose release gate is a live
demo, and it buys nothing here because a request that no one has looked at has no
observable difference between "expired" and "expired the moment someone looks". Lazy expiry
also makes the behaviour deterministic under test, with no timer to fake. A conditional
update avoids needing a transaction for what is a single-document invariant, though the
replica set remains available if a later operation genuinely spans documents.

---

## R7. Enforcing an append-only audit trail

**Decision**: three layers, in order of importance.

1. **No write path exists.** No route, service function, or repository helper updates or
   deletes an action record. This is the actual guarantee (FR-010).
2. **The schema refuses anyway.** Mongoose `pre` hooks on `findOneAndUpdate`, `updateOne`,
   `updateMany`, `deleteOne`, `deleteMany`, and `findOneAndDelete` throw, and the schema is
   `strict: "throw"`. Future code that tries fails loudly instead of quietly succeeding.
3. **Tests assert it.** A test exercises each of those paths and asserts it throws.

**Rationale**: layer 1 is what the requirement asks for, but a reviewer cannot see an
absence. Layer 2 turns the absence into something demonstrable, and layer 3 turns it into
evidence for Chapter 5. The UI carries the same property visually: no edit, delete, or
overflow affordance anywhere in the audit view, not even disabled ones (Design Direction).

**Alternative considered**: MongoDB role-based permissions denying `update` and `delete` on
the collection. Genuinely stronger, but it requires enabling authentication on the demo
`mongod` and keeping credentials in sync with the replica-set setup, adding environment
fragility before a release-gated demo for a guarantee already covered three ways.

---

## R8. Computing the metrics surface

**Decision**: computed on demand with MongoDB aggregation pipelines over the tickets and
action records collections, scoped by a period. No precomputed collection, no cache.

Period selector: fixed presets (last 7 days, last 30 days, last 90 days, all time).

Metric definitions, fixed here so the tests and the surface cannot drift apart:

| Metric | Definition |
|---|---|
| Ticket volume | Tickets with `createdAt` inside the period. |
| Category split | Volume grouped by `category`. |
| Status split | Volume grouped by `status`. |
| Resolved without human involvement | Tickets reaching `status: "resolved"` in the period with `escalated === false` and no `handlingMode` transition to `human_involved` anywhere in `history`. |
| Escalation rate | Tickets in the period with `escalated === true`, over volume. |
| Automated-action outcomes | Action records in the period grouped by outcome: attempted, succeeded, failed, timed out, refused. |
| Time to resolution | Difference between `createdAt` and the `history` entry recording the transition to `resolved`. Reported as median and as a distribution, never as a mean alone. |
| Provider fallbacks | Count of fallback events in the period (R4). |

**Rationale**: SC-009 demands the figures match an independently counted set of records
*exactly*. A cache is a mechanism for being confidently wrong, and at demo scale (hundreds
of tickets) aggregation is fast enough that there is nothing to optimise. Median rather than
mean for resolution time because a single stale demo ticket would otherwise dominate the
figure and misrepresent the system in the report.

Fixed presets rather than an arbitrary date-range picker keeps the surface bounded, testable
against known fixtures, and consistent with "a selectable recent period" in FR-023.

---

## R9. Bounded execution time

**Decision**: two timeouts, following the shape already used in `stt-service.ts`:

- `REMEDIATION_CONNECT_TIMEOUT_MS` (default 5000) for connection and handshake.
- `REMEDIATION_COMMAND_TIMEOUT_MS` (default 15000) for command execution.

On either timeout the channel and connection are force-closed, the outcome is recorded as
`timed_out`, the employee is told plainly, and the case escalates (FR-007). A hung action
never blocks the conversation.

**Rationale**: the split matters because an unreachable endpoint and a hanging command are
different failures with different remedies, and the audit record should say which happened.
The existing `withTimeout` wrapper in the STT service is the in-repo precedent for the
mechanism.

---

## R10. Verifying that a state-changing action worked

**Decision**: every state-changing policy entry names a **verification entry**, which is
itself a read-only policy entry. After the state-changing action runs, its verification
entry runs, and the observed result decides the outcome:

- verification confirms the intended state → `succeeded`
- verification contradicts it → `failed`, escalate with the full record
- no verification entry, or verification itself fails → `attempted_unverified`, escalate

**Rationale**: the spec assumes "verification is part of the action, not a separate
promise". Encoding the verification as a policy field makes that structural: an action
cannot be added to the whitelist without someone deciding how its success is observed. It
also means the verification step is itself whitelisted and audited, rather than being an
unaudited side channel that runs commands outside the policy.

---

## R11. The initial approved action set

**Decision** (FR-018 requires at least one read-only diagnostic per covered category, and at
least one state-changing action across the set):

| Category | Read-only diagnostic | State-changing action | Verified by |
|---|---|---|---|
| password_login | `account_status` - is the local test account locked, and is its password flagged for change | `unlock_account`, `expire_password` | `account_status` |
| network | `network_probe` - reachability and DNS resolution from the endpoint | none | n/a |
| printer | `print_queue_status` - jobs currently queued on the endpoint's CUPS instance | `clear_print_queue` | `print_queue_status` |
| peripherals | `peripheral_list` - devices visible to the endpoint | none | n/a |
| service_status | `service_status` - state of a named approved service | `restart_service` - name drawn from an enumerated list in the policy entry | `service_status` |

Six read-only entries, three state-changing entries, nine total. Every argument is either
absent or drawn from an enumeration declared in the entry.

**Honesty note that must survive into the report and the UI**: printer and peripheral
actions operate on the container's own view. The print queue is real, because the endpoint
genuinely runs CUPS and the queue genuinely holds and clears jobs. The peripheral listing
reports the devices visible to the container, which is a narrower thing than a user's
physical desk. The agent must describe what it checked accurately and must not imply it
inspected the employee's own hardware. This is the same discipline FR-019 imposes on the
password case, applied consistently.

`performance` is deliberately absent: FR-018 lists password, network, printer, peripheral,
and service status, and adding an action per category for its own sake would work against
the spec's "the action set stays deliberately small" assumption.

**Rationale**: this set covers exactly the categories FR-018 names, keeps state-changing
power to three well-understood operations, and gives every state-changing entry a
verification entry per R10. Growth happens by adding reviewed policy entries, never by
loosening matching.

---

## R12. Frontend charting for the metrics surface

**Decision**: no charting library is added. Stat tiles plus labelled horizontal bar rows,
backed by real text values.

**Rationale**: recorded in full in `DESIGN-DIRECTION.md`. Summarised: the metric set is
counts, rates, splits, and durations rather than time series; `frontend/package.json` has no
charting dependency today and taste-skill §3.F forbids assuming one; and every added
megabyte competes with the local model for the demo machine's envelope (NFR-7). Bars backed
by real text values also stay accessible and screenshot cleanly for Chapter 4 evidence.

**Escape hatch**: if a genuine time-series trend later proves necessary, that is a plan
amendment with an explicit dependency decision, not an in-flight import.

---

## Summary of new configuration

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDERS` | derived from `LLM_PROVIDER` | Ordered provider chain (R4, CD-1) |
| `AGENT_MAX_STEPS` | `3` | Hard iteration cap per employee turn (R5, FR-011) |
| `REMEDIATION_ENABLED` | `false` | Global default posture. Off until deliberately enabled |
| `REMEDIATION_SSH_KEY_PATH` | none | Private key for endpoint access. Never committed |
| `REMEDIATION_SSH_KEY_PASSPHRASE` | none | Optional |
| `REMEDIATION_CONNECT_TIMEOUT_MS` | `5000` | Connection and handshake bound (R9) |
| `REMEDIATION_COMMAND_TIMEOUT_MS` | `15000` | Command execution bound (R9, FR-007) |
| `REMEDIATION_APPROVAL_TTL_MINUTES` | `30` | Pending approval expiry (R6, FR-004b) |

All are added to the zod config schema and to the committed `.env.example`. No secrets enter
version control.

## New dependency

`ssh2` and `@types/ssh2` on the backend only:

```bash
npm --prefix backend install ssh2
npm --prefix backend install -D @types/ssh2
```

No new frontend dependency (R12).
