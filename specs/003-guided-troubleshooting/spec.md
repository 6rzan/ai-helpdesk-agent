# Feature Specification: Guided Troubleshooting

**Feature Branch**: `003-guided-troubleshooting`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Guided troubleshooting — step-by-step guidance per support category, starting with password/login (IR FR-4, roadmap item 1). Includes the ability to add new categories or edit existing ones."

## Clarifications

### Session 2026-07-12

- Q: What form should the maintainer management surface take? → A: Management API endpoints only (no UI this increment); maintainer uses a REST client or provided scripts; dashboard UI comes later.
- Q: How are maintainers authorised, given no user accounts exist yet? → A: Real user accounts (with self-service user profiles: remote-access IDs, location, hardware, staff-appended details) are deferred to the staff-dashboard feature — recorded in the roadmap so they need no re-explaining. This increment uses a single environment-configured maintainer credential required on every management operation; audit records the maintainer name supplied with the change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Step-by-step guidance for password/login issues (Priority: P1)

An employee reports that they cannot log in to their work account. Immediately after the assistant classifies the issue as password/login and creates a ticket, it begins walking the employee through a curated sequence of troubleshooting steps — one step at a time, in plain language — waiting after each step for the employee to say what happened before offering the next one.

**Why priority**: Password/login is the most frequently reported issue category in the project's survey data and is the IR-mandated starting category. Delivering one complete guided flow end-to-end proves the whole guidance mechanism and is a demonstrable MVP on its own.

**Independent Test**: Can be fully tested by reporting a login problem in the chat, observing that the assistant presents the first troubleshooting step immediately after categorisation, and stepping through the full flow by replying to each step.

**Acceptance Scenarios**:

1. **Given** a new conversation, **When** the user reports "I can't log into my account" and the issue is classified as password/login, **Then** the assistant presents the first troubleshooting step of the password/login guide in the same reply flow, without the user having to ask for help again.
2. **Given** a guided session is in progress, **When** the user replies that the current step did not fix the problem, **Then** the assistant presents the next step in the guide, phrased in plain, jargon-free language.
3. **Given** a guided session is in progress, **When** the user replies that the problem is fixed, **Then** the assistant confirms the resolution, the ticket is marked resolved, and the record shows which steps were attempted.
4. **Given** a guided session is in progress, **When** the user's reply is ambiguous (neither clearly "worked" nor "didn't work"), **Then** the assistant asks a short clarifying question about the current step rather than guessing or skipping ahead.

---

### User Story 2 - Escalation with attempted-steps context (Priority: P2)

An employee works through every step of a guide without success, or gets stuck and asks for a human. The assistant hands the ticket to IT staff carrying the full guidance history — which steps were attempted and what the user reported for each — so the employee never has to repeat themselves.

**Why priority**: Escalation already exists in the foundation; this story makes guided sessions terminate safely instead of dead-ending, and preserves the context-carrying handover the constitution requires. It builds directly on User Story 1.

**Independent Test**: Can be tested by exhausting all steps of the password/login guide (replying "didn't work" to each) and verifying the ticket escalates with the attempted-steps record attached; and separately by asking for a human mid-guide.

**Acceptance Scenarios**:

1. **Given** the user has reported that the final step of a guide did not resolve the problem, **When** the guide has no further steps, **Then** the assistant escalates the ticket to human staff, tells the user this in plain language, and the ticket record lists every step attempted with the user's reported outcome for each.
2. **Given** a guided session is in progress, **When** the user asks for a human at any point (e.g., "just get me a person"), **Then** the guidance stops immediately and the ticket escalates with the partial attempted-steps record attached.
3. **Given** an escalated ticket that went through guidance, **When** its details are viewed, **Then** the attempted steps and outcomes are readable alongside the conversation history.

---

### User Story 3 - Guided flows for the remaining categories (Priority: P3)

Employees reporting network connectivity, printer, peripheral device, slow performance, or service status issues each receive a guided flow tailored to that category, using the same one-step-at-a-time mechanism proven for password/login.

**Why priority**: The IR requires guidance across all six support categories; once the mechanism exists, each additional category is content plus tests. Ordered after the mechanism (US1) and safe termination (US2) are proven.

**Independent Test**: Can be tested per category by reporting a representative issue (e.g., "the office printer won't print") and stepping through that category's guide to both a resolved and an escalated outcome.

**Acceptance Scenarios**:

1. **Given** a new conversation, **When** the user reports an issue in any of the five remaining categories, **Then** the assistant begins that category's guide immediately after categorisation.
2. **Given** guides exist for all six categories, **When** an issue is classified into any category, **Then** the presented steps belong to that category's guide and no other.
3. **Given** an issue classified with low confidence or into no supported category, **When** guidance would normally begin, **Then** the assistant escalates instead of presenting steps from a wrong guide.

---

### User Story 4 - Add and edit categories and their guides (Priority: P3)

An authorised maintainer (the developer or an IT administrator — never an end user or the assistant itself) adds a new support category with its own guide, or edits the steps of an existing category's guide. From the next conversation onward, issues matching the new or updated category are classified into it and receive the updated guidance — with no code change required.

**Why priority**: The IR mandates "at least six" categories, so extensibility strengthens FR-2 rather than expanding scope. It also proves that guides are genuinely maintained as curated content (FR-004) rather than being baked into the system. Ordered after the guidance mechanism and the six mandated categories exist.

**Independent Test**: Can be tested by adding a new category (e.g., "email/calendar") with a three-step guide, reporting a matching issue in a fresh conversation, and observing correct classification and guidance; and separately by editing a step of the password/login guide and observing the changed wording in a new session.

**Acceptance Scenarios**:

1. **Given** the six mandated categories exist, **When** a maintainer adds a new category with a valid guide, **Then** a subsequently reported matching issue is classified into the new category and receives that guide's steps.
2. **Given** an existing category's guide, **When** a maintainer edits, adds, or removes steps, **Then** new guided sessions use the updated guide while sessions already in progress finish on the version they started with, and each ticket's attempted-steps record still reflects the version actually used.
3. **Given** a maintainer submits a category or guide that is invalid (e.g., no steps, duplicate category name, missing required detail), **Then** the change is rejected with a clear reason and the previous content remains in effect.
4. **Given** any category or guide change, **When** it takes effect, **Then** the change is recorded (who, when, what changed) and previous versions remain retrievable.
5. **Given** the six IR-mandated categories, **When** a maintainer attempts to delete one, **Then** the system prevents it (mandated categories may be edited but not removed).

---

### Edge Cases

- User reports a second, different problem mid-guide: the assistant acknowledges it, finishes or explicitly abandons the current guided session (recording it as such), and does not silently mix steps from two guides.
- User goes silent mid-guide and returns later (possibly after a restart): the session resumes at the step where it stopped, with progress intact.
- User replies to a step with a question about the step ("where do I find that setting?"): the assistant answers the question about the current step without advancing to the next one.
- User claims resolution and then immediately reports the same problem again: a new guided session starts and prior attempts remain visible on the ticket history.
- The category has a guide but the user has already tried some of its steps ("I already restarted it"): the assistant acknowledges and moves past the step the user says they have done, recording it as attempted-by-user.
- Guidance content is missing or invalid for a classified category: the assistant escalates rather than improvising unvetted steps.
- A guide is edited while a user is mid-session on it: the in-progress session completes on the version it started with; only new sessions pick up the change.
- A newly added category overlaps an existing one (e.g., "VPN" vs "network"): classification picks exactly one category per issue; the maintainer is responsible for keeping category descriptions distinguishable, and low-confidence classification still escalates (FR-012).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST begin presenting guided troubleshooting immediately after an issue is classified into a supported category and its ticket is created, without requiring a further user request. (IR FR-4)
- **FR-002**: The system MUST present troubleshooting steps one at a time, in plain, jargon-free language, and wait for the user's response before presenting the next step. (IR NFR-2)
- **FR-003**: Each of the six support categories (password/login, network connectivity, printer, peripheral devices, slow performance, service status) MUST have its own guide; delivery order starts with password/login. (IR FR-2, FR-4)
- **FR-004**: Guide content MUST be curated, versioned content maintained as reviewable data — not improvised per conversation — so every user with the same category receives the same vetted steps. The assistant may rephrase presentation but MUST NOT invent, reorder, or omit steps.
- **FR-005**: The system MUST record, per guided session, which steps were presented and the user's reported outcome for each (worked / didn't work / already tried / skipped), and this record MUST be attached to the ticket.
- **FR-006**: When the user reports the problem resolved during guidance, the system MUST mark the ticket resolved and reflect the status change to the user without delay. (IR FR-6)
- **FR-007**: When guide steps are exhausted without resolution, the system MUST escalate the ticket to human staff and inform the user in plain language. (IR FR-7)
- **FR-008**: The user MUST be able to exit guidance and request a human at any point; guidance stops immediately and the ticket escalates with the partial attempted-steps record. (IR FR-7)
- **FR-009**: Escalated tickets MUST carry the full guidance history (steps attempted and outcomes) alongside the existing conversation and classification context, so users never repeat themselves.
- **FR-010**: Guidance MUST be advisory only: it instructs the user what to try and MUST NOT execute any action on any machine (automated remediation is a separate, later feature). (IR FR-8 boundary, NFR-3)
- **FR-011**: A guided session MUST survive interruption: if the conversation is resumed later, guidance continues from the last recorded step.
- **FR-012**: If no valid guide exists for a classified category, or classification confidence is too low to select one, the system MUST escalate rather than present steps from an unrelated guide.
- **FR-013**: Interpreting the user's reply to a step (worked / didn't work / question / request for human) MUST handle ambiguity by asking a short clarifying question, never by guessing an outcome.
- **FR-014**: Authorised maintainers MUST be able to add a new support category (with its guide) and edit the guides of existing categories without any code change; new and updated content takes effect for subsequently started guided sessions. (strengthens IR FR-2 "at least six")
- **FR-015**: Category and guide changes MUST be validated before taking effect (a category needs a non-empty, well-formed guide; category names must be unique); invalid changes are rejected with a clear reason and the previous content stays in effect.
- **FR-016**: Every category or guide change MUST be recorded with who made it, when, and what changed, and prior guide versions MUST remain retrievable so a ticket's attempted-steps record can always be read against the guide version that produced it.
- **FR-017**: Guided sessions already in progress when a guide changes MUST complete on the guide version they started with.
- **FR-018**: The six IR-mandated categories MUST NOT be deletable; they may only be edited. Category and guide management MUST be restricted to authorised maintainers — never end users, and never the assistant itself at runtime. For this increment, authorisation means a single environment-configured maintainer credential presented on every management operation, with the maintainer's name recorded on each change; role-based accounts arrive with the staff dashboard.

### Key Entities

- **Support Category**: A reportable issue type the assistant can classify into. Attributes: unique name, description used for classification, whether it is IR-mandated (undeletable) or maintainer-added. Has exactly one active guide.
- **Troubleshooting Guide**: The curated, versioned set of ordered steps for one support category. Attributes: category, version, ordered steps, change history (who/when/what). One active version per category; prior versions retained.
- **Guide Step**: A single instruction within a guide: what the user should try, phrased for a non-technical reader, plus what "worked" looks like.
- **Guided Session**: The live progress of one user through one guide within a conversation: current step, per-step outcomes, terminal state (resolved / escalated / abandoned). Linked to the conversation and its ticket.
- **Step Attempt Record**: The per-step history entry (step, outcome, timestamp) that travels with the ticket into resolution or escalation.

## Success Criteria *(mandatory)*

Measurable Outcomes

- **SC-001**: For every issue classified into a supported category, the first troubleshooting step appears in the assistant's very next reply after categorisation — 100% of the time in test runs.
- **SC-002**: A user with a scripted common password/login problem can go from first message to confirmed resolution through guidance alone, with no human involvement, in under 5 minutes.
- **SC-003**: 100% of tickets escalated from a guided session show the complete attempted-steps record; in UAT, no tester is asked to repeat information already given during guidance.
- **SC-004**: All six support categories deliver a category-appropriate guide; in a blind test of representative issue reports, no report receives steps from the wrong category's guide.
- **SC-005**: UAT testers (minimum 3) rate the guidance as clear and easy to follow (at least 4 out of 5 on average), consistent with the plain-language requirement.
- **SC-006**: An interrupted guided session resumes at the correct step after the conversation is reopened, in 100% of test runs.
- **SC-007**: A maintainer can add a new category with a working guide, or change an existing guide's steps, in under 10 minutes without any code change — and the change is live for the next conversation started.
- **SC-008**: 100% of category/guide changes in test runs are traceable to who made them and when, and every ticket's attempted-steps record can be matched to the exact guide version used.

## Assumptions

- Guide steps are authored by the developer as curated, reviewable content (analogous to the whitelist-as-policy-data principle); the language model presents and interprets but does not originate steps. This is the safety-consistent reading of "guided step-by-step troubleshooting" in the IR.
- Guides are linear ordered sequences for this increment; conditional branching within a guide (beyond skip/already-tried handling) is out of scope unless a category demonstrably needs it.
- The existing classification, ticketing, escalation, and status-visibility behaviours from the foundation feature are reused unchanged; this feature only adds the guidance stage between categorisation and resolution/escalation.
- Voice-originated messages flow through the same text pipeline (already shipped), so guidance requires no voice-specific handling.
- Guidance content targets the controlled test environment's fictional organisation; steps reference generic organisational IT (e.g., "the company sign-in page"), not any real production system.
- The staff dashboard (roadmap item 2) is not required for this feature; the attempted-steps record must be stored and visible via existing ticket detail surfaces, and will be surfaced richer in the dashboard later.
- Category and guide management is a maintainer-facing capability for this increment: "authorised maintainer" means the developer or a designated IT administrator. Per clarification, the management surface is service-level management operations only (no UI this increment), exercised via a REST client or provided scripts; rich in-dashboard management arrives with the staff dashboard feature. This satisfies the constitution's rule that the assistant never modifies its own operating content at runtime — all changes are human-made and recorded.
- Adding categories beyond the mandated six is an enhancement permitted by IR FR-2's "at least six" wording; classification behaviour for the mandated six must not regress when categories are added (the existing classification test set continues to pass).
