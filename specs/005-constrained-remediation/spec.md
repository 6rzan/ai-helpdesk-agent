# Feature Specification: Constrained Automated Remediation

**Feature Branch**: `005-constrained-remediation`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Constrained automated remediation — IR FR-8 and the outstanding automated-action half of Objective O-3. The agent gains the ability to execute a small, fixed set of pre-approved diagnostic and remedial commands (for example via SSH or local scripts) against designated isolated test endpoints only, for routine password/login, network, printer, peripheral, and service-status issues, strictly within the controlled test environment." The feature also closes Compliance Debt Register entries CD-1 (ordered model-provider fallback chain) and CD-2 (FR-8 itself), and adds the performance-metrics surface that IR §1.5 places inside FR-9.

**IR traceability (Constitution Principle I)**: **FR-8** (execute only predefined automated remediation under strict guidelines: permission-governed, continuously logged, only against designated test endpoints) — this feature is the sole deliverer of FR-8. **O-3** (guided troubleshooting *and* limited predefined automated actions) — feature 003 delivered the guided half; this delivers the automated half and completes the objective. **FR-9** (dashboard) — extended with the "key tickets alongside performance metrics" scope from IR §1.5. **FR-4** (guided troubleshooting) — remediation complements guided steps and must never reorder or skip them. **FR-7** (escalation on complexity, ambiguity, or low confidence) — every refusal and every failed action routes here. **NFR-3** (secured, isolated test environment; never touches live or production systems). **NFR-4** (human oversight of critical operations; automation limited to pre-approved functions) — satisfied only vacuously today because no automated operations exist; this feature makes it substantive. **NFR-6** (AI handles simple tasks; complex cases route to humans).

**Constitution gates**: Principle II applies in full (whitelist as versioned policy data, default-deny executor, registered endpoints only, immutable audit of executed *and* refused actions, no runtime self-modification of policy, model output treated as untrusted). The Principle VIII staging clause activates here — the first side-effecting tools now exist, so the bounded plan → act → observe loop and the registered-tool registry become binding obligations. Principle IV requires the policy engine, executor, and escalation logic to be developed test-first. Principle III's two-role account model is unchanged: this feature introduces no new role.

## Clarifications

### Session 2026-08-19

- Q: Who authorises each individual execution — the reporter in chat, or a staff member? → A: **Tiered by risk.** Read-only diagnostics execute on the reporter's explicit in-chat consent. Every state-changing action additionally requires a staff member's approval before it runs. Both forms of authorisation are recorded with the action.
- Q: What does password/login remediation act on, given the test environment has no directory service? → A: **Real local accounts on the isolated test node** — the approved actions unlock a locked account and force a password change at next sign-in. Nothing is simulated, and nothing touches a real organisational directory because no such directory is reachable from the environment.
- Q: What are the "designated isolated test endpoints" on the single demo machine? → A: **Locally hosted containers running an SSH service, reached over SSH.** Two or more distinct containers are registered as separate endpoints, exercising the objective's SSH path, resettable between demo runs, and light enough to run beside the local model within the machine's memory envelope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Agent Checks Something Instead of Asking the Employee To (Priority: P1)

An employee reports a routine issue — a shared service seems down, or the network keeps dropping. Partway through guided troubleshooting, rather than asking the employee to run a check themselves, the agent says it can check directly, runs an approved **read-only diagnostic** against a registered test endpoint, and reports what it observed in plain language. The observed result feeds the next guided step: if it explains the problem, guidance continues from there; if it does not, the case escalates with the diagnostic result already attached.

**Why this priority**: This is the smallest slice that makes FR-8 real, and the safest one. A read-only check cannot damage anything, so it is the correct place to build and prove the entire safety spine — whitelist policy data, default-deny executor, endpoint registry, audit records, and the bounded agent loop — before any state-changing power exists. Alone it already delivers the survey-backed value: the employee gets an answer instead of an instruction. It also restores the demo path's missing leg.

**Independent Test**: Fully testable by reporting a service-status or network issue, reaching the point in the guided flow where a diagnostic applies, and confirming the agent runs it against the test endpoint, reports the observed output, writes an audit record, and continues guidance — with no other story implemented.

**Acceptance Scenarios**:

1. **Given** an employee is in a guided flow for a service-status issue and an approved diagnostic exists for that step, **When** the agent reaches that step, **Then** the agent offers to run the check, executes it against the registered test endpoint once the authorisation required by FR-004 is present, reports the observed result in plain language, and appends an audit record of the execution.
2. **Given** a diagnostic has returned a result, **When** the guided flow continues, **Then** the observed result informs the next step and is visible on the ticket, and the guide's own step order is unchanged.
3. **Given** the registered test endpoint is unreachable, **When** the agent attempts the diagnostic, **Then** the failure is reported honestly to the employee, an audit record of the attempt and its outcome is written, and the case escalates rather than retrying silently.
4. **Given** the agent has already acted once in a turn, **When** it would act again, **Then** the per-turn iteration cap is enforced; reaching the cap, or making no progress, escalates to staff instead of looping.

---

### User Story 2 - Anything Not Explicitly Approved Is Refused and Escalated (Priority: P2)

An employee asks the agent to do something it has no approved action for — reinstall software, change a setting on their own laptop, act on a machine that is not a registered test endpoint, or perform something that resembles an approved action but does not exactly match it. The agent refuses plainly, explains that it can bring in IT staff who can do it, and escalates on request. The refusal is recorded with exactly the same rigour as an execution.

**Why this priority**: Default-deny is the defining property of Principle II and the property the viva will probe hardest. It ranks above gaining any state-changing power, because a system that *can* act must first be provably unable to act outside its whitelist. It also upgrades today's blanket keyword refusal into a genuine policy decision without weakening it for one moment.

**Independent Test**: Fully testable by issuing a spread of out-of-whitelist requests — unknown actions, near-miss variants of approved actions, approved actions aimed at unregistered targets — and confirming each is refused, audited with its reason, and offered escalation, with no execution occurring in any case.

**Acceptance Scenarios**:

1. **Given** an employee asks for an action with no matching whitelist entry, **When** the agent evaluates it, **Then** the action is refused, the refusal is recorded with actor, requested intent, and reason, and the employee is offered escalation to staff.
2. **Given** an approved action exists but the requested target is not a registered test endpoint, **When** the agent evaluates it, **Then** the request is refused as an unregistered-target refusal and no execution is attempted.
3. **Given** a request that closely resembles an approved action but differs in any argument, **When** the agent evaluates it, **Then** it is refused — matching is exact, never approximate.
4. **Given** the language model proposes an action, **When** that proposal is evaluated, **Then** it is validated against both the expected argument shape and the whitelist before anything runs, and an invalid or unmatched proposal is refused and audited.
5. **Given** the agent's confidence in what the employee is asking for is low, **When** it would otherwise act, **Then** it escalates instead of guessing.
6. **Given** any request whatsoever, **When** it is processed, **Then** no path exists by which the agent can add to, edit, or disable the whitelist, the endpoint registry, or the audit trail.

---

### User Story 3 - The Agent Fixes a Routine Problem End to End (Priority: P3)

An employee reports one of the routine issues the whitelist covers. Guided troubleshooting narrows it down, and the remaining fix is an approved **state-changing** action — restarting an approved service on a test node, clearing a stuck print queue, or unlocking the employee's locked account on the test node. The employee consents, and because the action changes state, an approval request goes to IT staff; the employee is told the fix is waiting on staff. Once a staff member approves, the agent performs the action, verifies the outcome, tells the employee plainly what it did and whether it worked, and updates the ticket. If it did not work — or if staff decline — the case escalates carrying the full record of what was attempted.

**Why this priority**: This is the payoff of Objective O-3 and the workload reduction Objective O-4 measures. It is deliberately sequenced after the diagnostic spine (US1) and the refusal guarantee (US2), because state-changing power is only safe once default-deny is proven. The staff-approval step is what makes NFR-4's "human oversight of critical operations" substantive rather than retrospective.

**Independent Test**: Fully testable by driving a routine issue to the point where an approved remedial action applies, then confirming the approval request reaches staff, that nothing executes before approval, that approval leads to execution against the test endpoint with a verified and reported outcome, and that a decline, an expiry, or a failed attempt each escalates with the attempt recorded.

**Acceptance Scenarios**:

1. **Given** a guided flow has narrowed the issue to one an approved remedial action addresses and the employee has consented, **When** a staff member approves the resulting request, **Then** the agent executes the action against the registered test endpoint, verifies the result, and reports in plain language what it did and whether the problem is resolved.
2. **Given** an employee has consented to a state-changing action, **When** no staff member has yet approved it, **Then** nothing executes, the employee is told the fix is waiting on IT staff, and guidance and escalation remain available in the meantime.
3. **Given** a pending approval request, **When** a staff member declines it or it expires unactioned, **Then** nothing executes, the outcome is recorded and attributed, and the case proceeds by guidance or escalation instead.
4. **Given** the employee does not consent, **When** the agent would propose the action, **Then** no approval request is raised at all and the decision is recorded.
5. **Given** a remedial action executes but does not resolve the issue, **When** the agent verifies the outcome, **Then** the ticket escalates to staff carrying the action, its output, and the verification result, and the agent does not retry the same action.
6. **Given** a remedial action has run, **When** the employee or a staff member later views the ticket, **Then** exactly what was executed, against which endpoint, on whose consent and whose approval, and with what outcome is visible there.
7. **Given** the employee's account is locked on the test endpoint, **When** the approved password/login action runs, **Then** the account is genuinely unlocked on that endpoint, the employee is told plainly that this applied to the test account and not to any organisational directory, and the outcome is verified before it is reported.

---

### User Story 4 - Staff Oversee, Audit, and Override Every Automated Action (Priority: P4)

A staff member opens the dashboard and sees the queue of state-changing actions waiting on their approval, each showing the ticket, the exact action, the target endpoint, and the reporter's consent — they approve or decline each one. They can also see every automated action the agent has taken or refused, across all tickets and on each individual ticket, with who or what triggered it, the exact action, the target endpoint, the authorisation behind it, and the outcome. And they can switch automated remediation off entirely — globally, or for a specific endpoint — so that the agent falls back to guidance and escalation only.

**Why this priority**: NFR-4 requires human oversight of critical operations to remain possible, and Principle III gives staff override authority at every stage. The approval queue is where that oversight actually happens under the tiered authorisation model; the audit trail is how it is evidenced. Automated actions are worthless as evidence if staff cannot inspect them, and unsafe if staff cannot stop them. This sits below the execution stories only because there must be actions to oversee first.

**Independent Test**: Fully testable by generating pending requests plus a mix of executed and refused actions, then confirming from a staff account that the queue lists every pending request and that approving or declining has the stated effect, that every executed and refused action appears in the audit view with complete detail, that the trail cannot be edited or deleted from any surface, and that disabling remediation immediately stops further executions while leaving guidance and escalation working.

**Acceptance Scenarios**:

1. **Given** state-changing actions are awaiting approval, **When** a staff member opens the dashboard, **Then** each pending request is listed with its ticket, exact action, target endpoint, reporter consent, and age, and approving or declining it produces the outcome described in US3 with the deciding staff member attributed.
2. **Given** actions have been executed and refused, **When** a staff member opens the audit view, **Then** every executed *and* refused action is listed with timestamp, actor, classified intent, exact action, target endpoint, authorisation, and outcome, filterable by ticket, endpoint, and outcome.
3. **Given** a ticket on which the agent acted, **When** staff open that ticket, **Then** the actions taken on it appear in its history alongside the existing conversation, guided steps, and staff actions, without duplicating the existing staff-action trail.
4. **Given** a staff member disables automated remediation, **When** any subsequent action would execute, **Then** it does not execute, the employee is told the agent cannot act right now, guidance and escalation continue to work, and the disable itself is recorded as an attributed staff action.
5. **Given** any user, staff member, or the agent itself, **When** they attempt to alter or delete an audit record through any available surface, **Then** there is no such path — the trail is append-only.
6. **Given** a non-staff account, **When** it attempts to reach the audit view, **Then** access is refused and no action data is exposed.

---

### User Story 5 - Staff See How the Support Operation Is Actually Performing (Priority: P5)

A staff member opens the dashboard and, alongside their tickets, sees a metrics summary of the support operation: ticket volume and how it splits across categories and statuses, how many cases the agent handled without a human, how many escalated, how automated actions are performing (attempted, succeeded, failed, refused), and how long cases are taking to resolve. The picture covers a selectable recent period.

**Why this priority**: IR §1.5 places "key tickets alongside performance metrics" inside the dashboard's scope, and this surface is missing from the shipped system. It is also the instrument that makes Objective O-4's workload-reduction claim measurable rather than asserted. It ranks below oversight because it reports on the system rather than controlling it.

**Independent Test**: Fully testable by generating a known mix of tickets, escalations, and automated actions, then confirming the dashboard reports counts and rates that match that known mix for the selected period, and that a non-staff account cannot reach the surface.

**Acceptance Scenarios**:

1. **Given** a known set of tickets and automated actions in the system, **When** a staff member opens the metrics surface, **Then** the reported volumes, category and status splits, escalation rate, automated-action outcomes, and resolution times match the underlying records for the selected period.
2. **Given** the metrics surface is open, **When** the staff member changes the reporting period, **Then** the figures update for that period without a manual reload.
3. **Given** there is not yet any data for a selected period, **When** the surface is displayed, **Then** it states plainly that there is nothing to report rather than showing a misleading zero or an empty frame.
4. **Given** a non-staff account, **When** it attempts to reach the metrics surface, **Then** access is refused.

---

### User Story 6 - The Assistant Keeps Working When a Model Provider Fails (Priority: P6)

The configured language-model provider becomes unavailable mid-conversation. Rather than failing, the system moves to the next provider in a configured, ordered list and the employee's conversation continues. Only if every provider in the list fails does the employee see the honest degraded message and the case escalate to staff.

**Why this priority**: This closes Compliance Debt Register entry CD-1 — the ordered fallback chain Principle VIII requires but which the current provider gateway does not implement (it selects exactly one provider). It ranks last because it is a resilience improvement to an existing, already-honest failure path rather than new user-facing capability, but it must ship in this feature because the register requires closure here.

**Independent Test**: Fully testable in isolation by configuring an ordered list of providers, forcing the first to fail, and confirming the conversation continues on the next one; then forcing all of them to fail and confirming the existing visible-degradation and escalation behaviour still holds.

**Acceptance Scenarios**:

1. **Given** an ordered list of providers is configured and the first is unavailable, **When** the agent needs the model, **Then** the next provider in order serves the request, the conversation continues uninterrupted for the employee, and the fallback is recorded for staff.
2. **Given** every configured provider is unavailable, **When** the agent needs the model, **Then** the employee is told plainly that the assistant is degraded, the case escalates to staff, and nothing fails silently.
3. **Given** a single provider is configured, **When** it is available, **Then** behaviour is exactly as it is today — the chain introduces no change for the reference configuration.
4. **Given** the model is unavailable at any point, **When** an automated action would be considered, **Then** no action executes on a degraded or guessed classification.

### Edge Cases

- What happens when an employee asks for an approved action but is not the reporter of the ticket, or is asking on someone else's behalf? The action is evaluated against the ticket it belongs to; acting on a ticket the requester does not own is refused and escalated, consistent with the existing own-ticket isolation.
- What happens when a whitelisted action takes far longer than expected, or hangs? It is abandoned at a bounded time limit, the attempt and its timeout outcome are audited, the employee is told plainly, and the case escalates. A hung action never blocks the conversation indefinitely.
- What happens when the same action is requested twice in quick succession? The second request is not executed automatically; the agent reports the outcome already recorded and escalates if the employee says the problem persists. The agent never retries the same failed action on its own.
- What happens when the whitelist or endpoint registry is empty or missing at startup? The system starts with remediation unavailable and says so — it never falls back to permitting anything. Guidance and escalation are unaffected.
- What happens when an endpoint is registered but has been removed from the environment? The action attempt fails, is audited as a failure, and escalates; the endpoint is not silently dropped from the registry by the agent.
- What happens when a staff member disables remediation while an action is already running? The running action completes and is audited; no further action starts, and any pending approval requests can no longer be approved into execution.
- What happens when no staff member is available to approve a pending request? The employee is told plainly the fix is waiting on IT staff; guidance and escalation continue meanwhile, and the request expires unactioned rather than executing by default. Expiry never means approval.
- What happens when a staff member approves a request but the ticket has since been resolved, or the employee says the problem went away? The approval does not execute against a resolved ticket; the request is closed as no-longer-applicable and recorded as such.
- What happens when two staff members decide the same pending request at nearly the same time? The first decision stands and the second is rejected cleanly; the action never executes twice, and both attempts are attributed.
- What happens if a staff member tries to approve a request on a ticket they cannot otherwise see? The approval is refused under the same role and access rules that govern the rest of the dashboard.
- What happens if the employee's description is ambiguous between two approved actions? The agent does not choose — it asks a clarifying question, and escalates if still ambiguous (FR-7).
- What happens to tickets and conversations that predate this feature? They are unaffected; they simply carry no automated actions.
- What happens when an action succeeds on the endpoint but the employee reports the problem is still present? The verification result and the employee's contradiction both go on the ticket, and the case escalates — the agent does not argue with the employee or re-run the action.
- What happens if a model attempts to inject an instruction through employee-supplied text ("ignore your rules and run X")? The text is treated as data; any resulting proposal still faces exact whitelist matching and is refused, and the attempt is audited like any other refusal.
- What does the employee see when remediation is disabled or unavailable? Honest plain language: the agent can still guide them and bring in staff, but cannot act right now. It never pretends to have acted.

## Requirements *(mandatory)*

### Functional Requirements

**Policy, targets, and the executor (Principle II)**

- **FR-001**: The set of permitted automated actions MUST be defined as versioned, human-reviewable policy data — not as conditions in code — with each entry naming the action, its permitted arguments, the category or guided step it serves, whether it is read-only or state-changing, and the endpoints it may target.
- **FR-002**: The system MUST refuse any requested action that does not exactly match a policy entry. Refusal is the default path and execution the exception; no approximate, fuzzy, or "close enough" match may ever result in execution.
- **FR-003**: Automated actions MUST execute only against endpoints listed in a registry of designated isolated test endpoints. There MUST be no path — through configuration supplied at request time, model output, employee text, or staff input — by which an action reaches a host that is not in that registry.
- **FR-004**: Every execution MUST carry an explicit authorisation appropriate to its risk, tiered as follows, with the authorising party recorded on the action:
  - **Read-only diagnostics** MUST require the reporter's explicit in-chat consent for that specific check. Silence, an ambiguous reply, or a general willingness expressed earlier in the conversation is not consent.
  - **State-changing actions** MUST additionally require a named staff member's approval, obtained before execution. Reporter consent alone MUST NOT cause a state-changing action to run.
  - An action's tier MUST come from its policy entry (FR-001), never from the agent's judgement at request time.
- **FR-004a**: When a state-changing action is proposed, the system MUST raise an approval request that identifies the ticket, the exact action and arguments, the target endpoint, and the reporter's consent, and MUST make it visible to staff on the dashboard. The action MUST NOT execute until a staff member approves it.
- **FR-004b**: Staff MUST be able to approve or decline any pending approval request; both outcomes MUST be attributed and recorded, and a declined request MUST NOT execute. A pending request MUST expire after a bounded time without executing, and expiry MUST be recorded like any other non-execution.
- **FR-004c**: While an approval request is pending, the reporter MUST be told in plain language that the fix is waiting on IT staff, and the conversation MUST remain usable — guidance continues and escalation stays available.
- **FR-005**: The system MUST NOT provide any runtime path for the agent to create, modify, disable, or bypass the action policy, the endpoint registry, or the audit trail. Changes to these are human-made, reviewed configuration changes applied outside the running conversation.
- **FR-006**: Model output MUST be treated as untrusted input: any proposed action derived from it MUST be validated against both its expected argument shape and the action policy before execution, and employee-supplied text MUST be handled as data that can never become an instruction to act.
- **FR-007**: Every action attempt MUST terminate within a bounded time limit; a timed-out action MUST be recorded as such, reported honestly, and escalated.
- **FR-008**: The system MUST provide a way to disable automated remediation — globally and per endpoint — after which no action executes while guidance and escalation continue to function normally.

**Audit (Principle II)**

- **FR-009**: Every action that is executed **and** every action that is refused MUST append an immutable record capturing at least: timestamp, actor, the classified intent, the exact action and arguments, the target endpoint, the authorisation relied upon, and the outcome (succeeded, failed, timed out, or refused with reason).
- **FR-010**: Action records MUST be append-only, with no edit or delete path exposed on any surface to any role, including the agent itself. They MUST extend the existing attributed staff-action trail rather than duplicating it.

**Agent behaviour (Principle VIII, FR-4, FR-7)**

- **FR-011**: When the agent may act, it MUST follow a bounded plan → act → observe cycle in which at most one policy-checked action executes per step and the observed result informs the next step, under a hard cap on steps per employee turn.
- **FR-012**: Reaching the step cap, or making no progress across steps, MUST escalate to staff. The agent MUST NOT silently retry a failed action, and MUST NOT re-run an action that has already failed for the same ticket.
- **FR-013**: Every capability the model can invoke MUST be declared with a validated argument shape and an accurate description, and every state-changing capability MUST correspond one-to-one with an entry in the action policy.
- **FR-014**: Automated actions MUST complement guided troubleshooting, never replace or reorder it: an action may satisfy or inform a guided step, but the deterministic step sequence and versioning of guides MUST remain unchanged, and the agent MUST NOT invent, skip, or reorder steps in order to act.
- **FR-015**: Low confidence about what the employee wants MUST escalate rather than result in an action, and ambiguity between two approved actions MUST produce a clarifying question rather than a choice made by the agent.
- **FR-016**: The existing blanket refusal of remediation requests MUST become a policy decision: requests that match the policy and pass authorisation may proceed, while everything else continues to be refused in plain language with escalation offered. No request that is refused today may become executable except through an explicit policy entry.
- **FR-017**: The employee MUST always be told in plain language what the agent did or will do, against what, and with what result — before and after execution — and MUST never be given the impression an action occurred when it did not.

**Scope of the initial action set (FR-8, O-3)**

- **FR-018**: The initial policy MUST cover approved actions for the routine issue types the IR names — password/login, network, printer, peripheral, and service status — with at least one read-only diagnostic per covered category and at least one state-changing remedial action across the set.
- **FR-019**: Password/login remediation MUST act on real local accounts that exist only on a registered isolated test endpoint. The approved actions are unlocking a locked account and forcing a password change at next sign-in. The system MUST NOT state or imply that it has changed a credential in any organisational directory, and no organisational directory may be reachable from the environment.
- **FR-020**: Registered test endpoints MUST take the form of locally hosted containers running an SSH service, reached over SSH, with at least two distinct endpoints registered so that endpoint-scoped policy and unregistered-target refusal (FR-003) are demonstrable. Endpoints MUST be isolated from any live or production system, resettable to a known state between runs, and able to run alongside the local model within the demo machine's memory envelope (NFR-7).

**Staff oversight and metrics (FR-9, NFR-4, IR §1.5)**

- **FR-021**: Staff MUST be able to review the complete action trail from the dashboard — across all tickets and per ticket — filterable at least by ticket, endpoint, and outcome, with access restricted to the staff role.
- **FR-022**: Staff MUST retain override authority at every stage: they can take over, reassign, and resolve a ticket the agent has acted upon exactly as they can any other, and disabling remediation (FR-008) MUST be a staff-accessible, attributed action.
- **FR-023**: The dashboard MUST present a metrics summary for a selectable recent period covering at least: ticket volume with category and status splits, the proportion of cases resolved without human involvement, the escalation rate, automated-action outcomes (attempted, succeeded, failed, refused), and time to resolution. Figures MUST be consistent with the underlying records, and a period with no data MUST say so plainly.

**Resilience (Compliance Debt CD-1)**

- **FR-024**: Model access MUST follow an ordered list of configured providers, falling through to the next on failure. Total failure of every provider MUST continue to degrade visibly — the employee is told the assistant is degraded and the case escalates — and MUST never fail silently.
- **FR-025**: No automated action may execute on a classification produced while the system is in a degraded model state.

### Key Entities

- **Action Policy Entry**: One permitted automated action — its name, permitted arguments, the issue category or guided step it serves, its tier (read-only or state-changing, which determines the authorisation required), and the endpoints it may target. Versioned and human-reviewed; never modified by the running system.
- **Test Endpoint**: One designated, isolated container an action may run against over SSH — its identifier, how it is reached, and whether it is currently enabled for remediation. Registered outside the running conversation.
- **Approval Request**: One pending state-changing action awaiting staff decision — the ticket, the exact action and arguments, the target endpoint, the reporter's recorded consent, when it was raised, and its outcome (approved by whom, declined by whom, or expired). Nothing state-changing executes without one.
- **Action Record**: One immutable entry for an executed or refused action — timestamp, actor, classified intent, exact action and arguments, target endpoint, the consent and approval relied upon, and outcome. Linked to its ticket. Append-only, extending the existing staff-action trail.
- **Ticket (existing, extended)**: Gains the automated actions attempted on it, their outcomes, and the verification result, all visible in its history to the reporter and to staff.
- **Remediation Availability (existing surfaces, extended)**: The global and per-endpoint enable/disable state that staff control, with each change recorded as an attributed staff action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requested actions that do not exactly match an approved policy entry are refused, with zero executions occurring outside the approved set across the full test suite and the UAT walkthrough.
- **SC-002**: 100% of executed and refused actions appear in the audit trail with complete detail; no action of either kind is ever absent from it.
- **SC-003**: Zero actions reach any target outside the registered isolated test endpoints, under both normal use and deliberate attempts to redirect the agent through employee-supplied text.
- **SC-004**: For an issue covered by an approved action, an employee reaches a confirmed outcome — fixed, or escalated with the attempt recorded — without being asked to run any command themselves.
- **SC-005**: A staff member can answer "what did the agent do on this ticket, to what, on whose say-so, and did it work?" entirely from the ticket view, in under 30 seconds, in 100% of cases where the agent acted.
- **SC-005a**: Zero state-changing actions execute without both a recorded reporter consent and a recorded staff approval — across the full test suite, the UAT walkthrough, and every deliberate attempt to bypass the approval step.
- **SC-005b**: A staff member can go from opening the dashboard to deciding a pending approval request — with the ticket, action, and target endpoint all on screen — in under 30 seconds.
- **SC-006**: Disabling remediation stops all further executions immediately, while guided troubleshooting and escalation continue to work with no employee-visible failure.
- **SC-007**: No conversation ends in a silent failure: every failed, timed-out, or refused action results in either an honest message to the employee or an escalated ticket — 100% of cases.
- **SC-008**: The end-to-end demo path — report an issue by voice or text, classify, ticket, guided fix, whitelisted remediation on a test endpoint, escalation, staff dashboard view — passes on the demo machine on the first attempt before each supervisor meeting and the recorded demonstration.
- **SC-009**: The dashboard metrics figures match an independently counted set of known tickets and actions exactly, for every reporting period tested.
- **SC-010**: With the first configured provider forced to fail, conversations continue without employee-visible interruption; with all providers failing, 100% of affected conversations show the degraded message and escalate.
- **SC-011**: In UAT, a staff-role tester correctly identifies, from the audit trail alone and without assistance, what the agent did and why it refused what it refused.

## Assumptions

- **The controlled test environment is the only environment.** Every endpoint is isolated and disposable; nothing in this feature is intended for, or safe on, a live organisational network (NFR-3). Production deployment remains permanently out of scope under Principle I.
- **The action set stays deliberately small.** FR-8 says "predefined"; a compact, well-understood set that is provably safe is worth more to this project than breadth, and matches the IR's low-risk-issues framing. Growth happens by adding reviewed policy entries, not by loosening matching.
- **Employees do not choose targets.** The endpoint an action runs against is determined by the registry and the ticket context, never by anything the employee types. This is what makes FR-003 enforceable.
- **Remediation is offered, not imposed.** Where an approved action exists, the agent proposes it; guided troubleshooting remains the default path and continues to work unchanged if the action is declined, disabled, or unavailable (FR-014).
- **The tiered authorisation model is what makes the workload claim honest.** Read-only diagnostics are the high-frequency case and run on reporter consent alone, so the agent genuinely saves time on the common path (Objective O-4). State-changing actions are rarer and carry a staff approval, so NFR-4's human oversight is exercised before the risky operation rather than reconstructed after it. Approval is a decision on a specific proposed action, never a standing permission for a category, an endpoint, or a session.
- **Password/login remediation is real, not simulated, and bounded by the sandbox.** The approved actions change actual local accounts on a registered container. This is defensible precisely because the container is disposable and no organisational directory is reachable; the agent must always say which account store it acted on so no one can mistake it for a corporate password reset.
- **Test endpoints are disposable containers, not the demo machine itself.** Registering at least two lets endpoint-scoped policy and unregistered-target refusal be demonstrated rather than asserted. A container runtime becomes a documented prerequisite alongside the existing replica-set MongoDB requirement.
- **Verification is part of the action, not a separate promise.** An action is only reported as successful when its outcome has been observed; where an action cannot be verified, it is reported as attempted and the case escalates.
- **Audit extends what exists.** Feature 004's append-only attributed action trail is the foundation; this feature adds agent-initiated actions to the same discipline rather than creating a parallel log.
- **The metrics surface is descriptive, not predictive.** It reports what has happened over a selected recent period. Forecasting, alerting, thresholds, and SLA enforcement are out of scope.
- **Metrics feed the Objective O-4 evaluation but do not constitute it.** O-4 additionally requires a requirements-traceability assessment and a measured perceived-usefulness judgement, which belong to the refining/Transition phase (Constitution Principle IV), not to this feature.
- **Provider fallback is configuration, not intelligence.** The chain is an ordered list tried in order; there is no scoring, health-based routing, or automatic reordering. The reference configuration remains a single local provider, for which behaviour is unchanged (FR-024).
- **The demo machine constraint holds (NFR-7).** Whatever form the test endpoints take, they must install, run, and demonstrate on the one project laptop inside its memory envelope, with no mandatory external infrastructure.
- **No new role appears.** Oversight, audit review, and the disable control belong to the existing staff role; policy and endpoint registry changes are maintainer actions performed outside the application, consistent with the locked two-role model (Principle III).
- **Accepted exclusions**: automatic rollback or undo of an executed action (actions are chosen to be individually safe rather than reversible); scheduled or unattended remediation with no case in progress; remediation initiated against an employee's own workstation; bulk or multi-endpoint actions in a single request; standing or pre-granted approvals that would let a state-changing action run without a per-action decision; approval notifications pushed outside the application (staff see the queue when they open the dashboard); and a policy-editing UI (policy remains reviewed configuration under FR-005).

## Dependencies

- Builds on the shipped conversation, classification, ticketing, and escalation foundation (feature 001) and consumes its escalation path for every refusal and failure.
- Depends on the deterministic versioned guides and the six seeded categories from feature 003; automated actions attach to guided steps and must not alter guide behaviour.
- Extends feature 004's staff dashboard, ticket detail, role-restricted access, and append-only attributed action trail; the audit view, override controls, and metrics surface are additions to those surfaces, not replacements.
- Replaces the current blanket keyword-based refusal of remediation requests in the conversation flow with a policy decision (FR-016), without weakening what is refused today.
- Closes Compliance Debt Register entries **CD-1** (ordered provider fallback chain, FR-024) and **CD-2** (FR-8 itself). Both entries may be struck only when the closing tests exist, per the Governance rule in constitution v1.2.0.
- Requires the controlled test environment — at least two registered SSH-reachable containers, resettable to a known state — to exist on the demo machine before the end-to-end demo path (SC-008) can be gated on remediation. A container runtime joins the documented prerequisites alongside the replica-set MongoDB requirement.
- Depends on feature 004's staff availability and assignment surfaces as the natural home for the approval queue; staff approving an action are acting in their existing role, and no new role or permission tier is introduced (Principle III).
