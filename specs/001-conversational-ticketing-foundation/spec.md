# Feature Specification: Conversational & Ticketing Foundation

**Feature Branch**: `001-conversational-ticketing-foundation`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Core conversational + ticketing foundation for the AI Help Desk Agent — the text chat through which employees report IT issues, automatic classification into the six fixed support categories, automatic ticket creation, plain-language ticket status visibility, and clarification/escalation when the agent is unsure. This foundation precedes all per-category troubleshooting features (Constitution Principle VII)."

## Clarifications

### Session 2026-07-08

- Q: How should reporter identity work across chat sessions? → A: Persistent lightweight identity via organisational ID — the same ID supplied in a later session finds the reporter's existing tickets; no passwords or accounts.
- Q: Which status lifecycle should tickets follow? → A: Standard 4-state: Open → In Progress → Resolved → Closed; Resolved awaits user confirmation and returns to In Progress if the user reports the problem persists; Closed is final. Handling mode remains a separate orthogonal field. (Amended post-analysis 2026-07-08: Open → Closed is additionally allowed when a report is withdrawn or identified as a duplicate.)
- Q: Does this foundation include any staff-facing capability? → A: No — escalation sets the flag, switches handling mode, and preserves context; staff viewing/acting arrives with the dashboard feature. Until then, staff-side transitions are exercised via tests and the scripted demo.
- Q: What response-time target should agent replies meet? → A: The agent visibly begins replying within 3 seconds and completes a typical reply within 10 seconds on the demo environment (quantifies IR NFR-1).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Report an IT issue and receive a ticket (Priority: P1)

An employee experiencing an IT problem opens the help desk chat at any time of day, describes the problem in their own words, and the agent understands the report, sorts it into the correct support category, opens a ticket automatically, and confirms this back in plain language with a ticket reference.

**Why this priority**: This is the reason the system exists (IR FR-1, FR-2, FR-3, FR-5). Every other feature — guided troubleshooting, remediation, the staff dashboard — attaches to a conversation and a ticket. With only this story implemented, the project already has a demoable MVP: an always-available intake channel that turns free-form problem reports into structured, categorised tickets.

**Independent Test**: Feed the chat a prepared set of problem descriptions covering all six categories and verify each produces a correctly categorised ticket carrying a timestamp, the reporter's description, and a plain-language confirmation with a ticket reference.

**Acceptance Scenarios**:

1. **Given** an open chat session with an identified reporter, **When** the user types "I forgot my password and can't log into my computer", **Then** the agent replies in plain language confirming a ticket was created in the password/login category and includes a ticket reference the user can quote later.
2. **Given** any successfully classified report, **When** the ticket is created, **Then** the ticket records the creation timestamp, the assigned category, the reporter's own description, and the reporter's identity.
3. **Given** reports describing each of the six categories (password/login, internet/network, printer, peripheral devices, slow performance, service status), **When** each is submitted, **Then** each is classified into its correct category — all six categories are reachable.
4. **Given** an open chat session, **When** the user sends only a greeting ("hi"), **Then** the agent responds conversationally, invites the user to describe their IT problem, and does not create a ticket.

---

### User Story 2 - Follow ticket status in plain messages (Priority: P2)

A user who has reported an issue can always see where their ticket stands. Whenever the handling mode changes — being handled automatically, waiting on the user, or a human has taken over — the change appears in the conversation immediately, in plain language. The user can also simply ask about their tickets and get a clear answer.

**Why this priority**: Status opacity is a core frustration the IR survey documented; IR FR-6 makes visible status a hard requirement. It depends on tickets existing (Story 1) but is independent of any troubleshooting content.

**Independent Test**: Create a ticket, change its status and handling mode through each defined transition, and verify each change appears in the reporter's conversation without delay and in plain language; then ask the agent "what's happening with my ticket?" and verify a correct plain-language summary.

**Acceptance Scenarios**:

1. **Given** an open ticket, **When** its handling mode changes (automated → waiting on user, or → human involved), **Then** the reporter sees a plain-language message describing the change in their conversation without delay.
2. **Given** a reporter with one or more tickets, **When** they ask about their ticket status in their own words, **Then** the agent lists their tickets with current status and handling mode in plain, jargon-free language.
3. **Given** a ticket in "waiting on user" mode, **When** the user replies with the requested information, **Then** the ticket returns to active handling and the mode change is visible in the conversation.
4. **Given** a ticket in Resolved status, **When** the agent asks the reporter to confirm the fix, **Then** a confirmation closes the ticket, a "still broken" reply returns it to In Progress, and no response leaves it Resolved — each outcome visible in the conversation.

---

### User Story 3 - Unclear or complex reports reach a human without the user repeating themselves (Priority: P3)

When the agent cannot confidently work out what the problem is, it asks a short clarifying question instead of guessing. If the report remains unclear after clarification, spans something outside the six categories, or the user simply asks for a person, the ticket is flagged for human IT staff — carrying the whole conversation and classification attempt so the user never has to re-explain.

**Why this priority**: Escalation is a first-class feature by constitution (Principle III) and an IR requirement (FR-7). It protects trust in the system but only becomes exercisable once reporting (Story 1) exists.

**Independent Test**: Submit deliberately ambiguous, out-of-scope, and "I want a human" reports; verify each results in either a clarifying question or a ticket flagged for human attention with the full conversation transcript attached, and never a silently guessed category.

**Acceptance Scenarios**:

1. **Given** an ambiguous report ("my computer is acting weird"), **When** the agent's classification confidence is low, **Then** the agent asks a clarifying question rather than assigning a category.
2. **Given** a report that remains unclear after a bounded number of clarifying exchanges, **When** the limit is reached, **Then** a ticket is created flagged for human attention, its handling mode shows "human involved", and the full conversation is attached to it.
3. **Given** any point in a conversation, **When** the user explicitly asks for a human ("can I just talk to IT staff?"), **Then** the ticket is escalated immediately and the user is told a person will take over.
4. **Given** an escalated ticket, **When** it is later viewed by staff, **Then** the ticket carries the conversation transcript, the classification result (or the failure to classify), and everything already attempted — nothing must be re-asked of the user.

---

### Edge Cases

- **Empty, gibberish, or non-language input**: the agent asks the user to describe their problem; no ticket is created from content-free input.
- **Multiple problems in one message** ("my password expired and also the printer is jammed"): the agent handles one issue at a time — it acknowledges both, asks which to address first, and offers to open the second as a separate ticket.
- **User goes silent mid-clarification**: the conversation and any draft ticket remain in "waiting on user" mode; the ticket is not lost, and the user can resume in the same session or a later one under the same organisational identifier (session expiry ends the session, never the conversation or ticket).
- **Understanding component unavailable** (the automated classification service cannot respond): the system still accepts the report, creates an unclassified ticket flagged for human attention, and tells the user their report is recorded — intake never fully fails while the system is running.
- **Off-topic or unsafe requests** (non-IT questions, requests to run commands or change systems): the agent politely declines and restates what it can help with; it never attempts actions — this feature contains no remediation capability at all (IR FR-8 is a later, separately safeguarded feature).
- **Duplicate report of an existing open issue by the same reporter**: a new report matching the category of one of the reporter's not-closed tickets triggers the agent to surface that ticket and ask whether this is the same problem before opening a new one.
- **Very long report**: the agent processes reports up to a stated generous length and asks the user to summarise beyond it, rather than failing silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let an identified user report an IT problem as free-form text in a chat conversation. *(IR FR-1 — text path; voice is a later input feature, see Assumptions.)*
- **FR-002**: System MUST classify each problem report into exactly one of the six fixed categories — password/login, internet/network connectivity, printer, peripheral devices, slow device performance, basic service status — or explicitly mark it unclassified when confidence is insufficient. Confidence sufficiency is judged against a configurable operational threshold (default 0.7). It MUST never silently guess. *(IR FR-2, FR-3, FR-7.)*
- **FR-003**: System MUST automatically create a ticket for each classified (or escalated-unclassified) report, carrying at minimum: creation timestamp, assigned category (or unclassified flag), the reporter's own description, and the reporter's identity. *(IR FR-3.)*
- **FR-004**: Each ticket MUST carry a status — Open, In Progress, Resolved, or Closed — and a handling mode — automated, waiting on user, or human involved. Resolved means a fix was applied or suggested and awaits user confirmation: the agent asks the reporter to confirm; confirmation closes the ticket, a report that the problem persists returns it to In Progress, and no response leaves it Resolved. Open tickets MAY move directly to Closed when withdrawn by the reporter or identified as duplicates. Closed is final. Every change of status or handling mode MUST be timestamped and reflected in the reporter's conversation without perceptible delay. *(IR FR-6.)*
- **FR-005**: When classification confidence is low, the agent MUST ask clarifying questions — at most two per problem report (a configurable operational limit, default 2; the count resets once a ticket is created or escalated) — after which the ticket MUST be flagged for human attention. *(IR FR-7.)*
- **FR-006**: A user MUST be able to escalate to human staff at any point by expressing the preference in plain language, and the system MUST honour it immediately. *(IR FR-7 — explicit user preference.)*
- **FR-007**: The full conversation transcript, classification outcome, and any clarification exchanges MUST be preserved and attached to the ticket, so a human taking over sees everything without the user repeating information. *(Constitution Principle III.)*
- **FR-008**: A reporter MUST be able to ask about their tickets in plain language within the chat and receive current status and handling mode for each — including tickets created in earlier sessions under the same organisational identifier. *(IR FR-6.)*
- **FR-009**: The system MUST accept new reports and conversations at any time of day without staff presence, within the controlled test environment. *(IR FR-5.)*
- **FR-010**: All agent-authored messages MUST use plain, jargon-free language with logically ordered content. *(IR NFR-2.)*
- **FR-011**: The system MUST collect no personal information beyond what the ticket needs: a reporter display name, an organisational identifier (the persistent key that links a reporter's tickets across sessions), and the problem details the user chooses to share. *(IR NFR-5.)*
- **FR-012**: This feature MUST contain no capability to execute commands, scripts, or remediation of any kind; requests for such actions are politely declined and, where relevant, escalated. *(Boundary of IR FR-8; Constitution Principle II — refusal is the default path.)*
- **FR-013**: If automated understanding is unavailable, the system MUST still record the report as an unclassified ticket flagged for human attention and inform the user their report is saved. *(Supports IR FR-5 availability; NFR-6 division of labour.)*

### Key Entities

- **Reporter**: The person raising an issue — display name and organisational identifier, linked to their tickets and conversations. The organisational identifier is the persistent identity: supplying the same identifier in a later session retrieves the same reporter's tickets. Deliberately minimal — no passwords, accounts, or verification (IR NFR-5).
- **Conversation**: A chat session between one reporter and the agent — an ordered sequence of messages with timestamps and authorship (user or agent); linked to any tickets it produced.
- **Message**: A single utterance within a conversation — author, text, timestamp.
- **Ticket**: The structured record of one reported problem — reference identifier, creation timestamp, category (one of six, or unclassified), reporter, original description, status (Open → In Progress → Resolved → Closed, with Resolved returning to In Progress when the user reports the problem persists), handling mode, escalation flag, and the linked conversation; carries a timestamped history of every status/handling-mode change.
- **Issue Category**: The fixed six-value classification set from IR FR-2. Fixed — not user-extensible in this feature.
- **Handling Mode**: Who is dealing with the ticket right now — automated, waiting on user, or human involved (IR FR-6); every transition is recorded with a timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can report an issue and receive a plain-language ticket confirmation with a reference in under 2 minutes of conversation, without instructions or training.
- **SC-002**: 100% of created tickets carry a creation timestamp, a category or an explicit unclassified flag, the reporter's description, and the reporter's identity — verified across the full test set.
- **SC-003**: At least 80% of a prepared benchmark set of problem reports (covering all six categories, plus ambiguous and out-of-scope cases) are classified into the correct category on the first attempt; the remainder end in a clarifying question or human flag — never a wrong category presented as certain more than 5% of the time.
- **SC-004**: Every status or handling-mode change is visible in the reporter's conversation within 2 seconds of the change.
- **SC-005**: 100% of low-confidence, out-of-scope, or "I want a human" cases result in a clarifying question or a human-flagged ticket with the full conversation attached — zero silent guesses in the test set.
- **SC-006**: The system accepts and records new reports at any hour without human presence: an unattended availability check spread across a 24-hour window in the test environment succeeds on every attempt.
- **SC-007**: In UAT (minimum 3 testers per constitution Principle IV), all testers successfully report an issue and locate its status unaided, and rate the agent's language as clear (no unexplained technical jargon reported). *(UAT is conducted at project level before final submission; this feature contributes its scenarios and must be UAT-ready.)*
- **SC-008**: Across the benchmark test set on the demo environment, the agent visibly begins replying within 3 seconds and completes replies within 10 seconds, both measured at the 90th percentile. *(Quantifies IR NFR-1.)*

## Assumptions

- **Voice input is deferred**: IR FR-1 requires text or voice, with voice always transcribed to text before analysis. Since all processing is text-based, this foundation delivers the text path; voice arrives as a later input feature that feeds the same conversation without changing this feature's behaviour.
- **Per-category guided troubleshooting (IR FR-4) is deferred**: each support category's step-by-step guidance ships with that category's own feature (priority order per Constitution Principle VII). This foundation provides the conversation, classification, and ticketing rails those features plug into; after classification the agent confirms the ticket and states that guidance/human help follows.
- **The staff dashboard (IR FR-9) is deferred and this feature contains no staff-facing capability at all**: escalation records the flag, switches the handling mode, and preserves context — that is this feature's complete responsibility. Staff viewing, taking over, and resolving arrive with the dashboard feature; until then, staff-side state transitions are exercised through automated tests and the scripted demo path.
- **Automated remediation (IR FR-8) is explicitly excluded**: no command execution capability of any kind exists in this feature.
- **Reporter identification is lightweight but persistent**: the user supplies a display name and an organisational identifier at the start of a session; the identifier links their tickets across sessions so status can be followed and duplicates detected later. No account system, passwords, or verification — impersonation risk is accepted inside the isolated test environment (IR NFR-3, NFR-5). Staff-side access control arrives with the dashboard feature.
- **Single organisation, English-language operation** inside the secured, isolated test environment (IR NFR-3); no production systems are touched.
- **Role-restricted access to stored data is deferred**: IR NFR-5 also requires access to stored logs restricted to approved roles; no staff roles exist in this feature, so that restriction arrives with the dashboard feature's access control, and until then all data stays inside the secured, isolated test environment (IR NFR-3). Relatedly, IR NFR-4 (human oversight of critical operations) and the constitution's audit mandate are satisfied vacuously here: no automated or critical operations exist in this feature.
- **The six categories are fixed** exactly as enumerated in IR FR-2 and are not user-configurable.
