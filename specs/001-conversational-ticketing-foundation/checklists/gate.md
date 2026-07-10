# Requirements Gate Checklist: Conversational & Ticketing Foundation

**Purpose**: Formal requirements-quality gate before `/speckit-tasks` — validates that the written requirements (spec + design artifacts) are complete, clear, consistent, and measurable across safety/escalation, conversation/UX, API/data alignment, and non-functional coverage. Tests the requirements, not the implementation.
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md) · [data-model.md](../data-model.md) · [contracts/api.md](../contracts/api.md) · [research.md](../research.md)

## Requirement Completeness

- [x] CHK001 Is the mechanism that moves a ticket from Resolved to Closed specified — who or what confirms resolution (user confirmation message? timeout? staff)? The spec says Resolved "awaits user confirmation" but no requirement defines the confirmation act or a no-response outcome. [Gap, Spec §FR-004] — *Resolved 2026-07-08: FR-004 + new US2-AS4 define agent-prompted confirmation (confirm→Closed, still-broken→In Progress, silence→stays Resolved); task T048 added.*
- [ ] CHK002 Are requirements defined for how the multi-problem flow continues after the user picks which issue to address first — is the second problem's "offer to open a separate ticket" a requirement with an outcome, or only an edge-case note? [Completeness, Spec §Edge Cases]
- [ ] CHK003 Is the exact user-facing content requirement for the degraded mode defined — what the user is told when their report is saved unclassified (reference given? expectations set)? [Completeness, Spec §FR-013]
- [ ] CHK004 Are user-facing requirements defined for rejected reporter identification (orgId failing the format rules) — does the user see guidance or a dead end? [Gap, Contracts §POST /api/sessions, Data Model §Reporter]
- [x] CHK005 Is conversation inactivity expiry specified as a requirement with a duration and a user-visible effect? Research R8 mentions expiry but no number or behaviour exists anywhere. [Gap, Research §R8] — *Resolved 2026-07-08: SESSION_INACTIVITY_MINUTES (default 30) added to R8 + T001; spec edge case states expiry ends the session, never the conversation or ticket.*
- [ ] CHK006 Is the append-only/immutability property of ticket history stated as a requirement in the spec, or does it exist only in the data model? If it matters for the viva (audit spirit of Principle II), should FR-004 own it? [Gap, Spec §FR-004, Data Model §Ticket]

## Requirement Clarity

- [x] CHK007 Is "bounded number of clarifying exchanges" pinned to a number in the spec itself? FR-005 says "small fixed number"; only research R2 says 2. Decide which artifact owns the constant. [Ambiguity, Spec §FR-005, Research §R2] — *Resolved 2026-07-08: FR-005 now states at most two per problem report (configurable, default 2); spec owns the default.*
- [x] CHK008 Is the low-confidence threshold a requirement or a design choice? The spec says "insufficient confidence"; 0.7 lives in research R2. Confirm intended ownership so tests trace to the right artifact. [Clarity, Spec §FR-002, Research §R2] — *Resolved 2026-07-08: FR-002 declares a configurable operational threshold with default 0.7; spec owns the default, config owns the runtime value.*
- [ ] CHK009 Is "politely declines" for off-topic/unsafe requests given content criteria (what must the refusal include — restatement of scope? escalation offer?), and is the boundary between "decline" and "escalate where relevant" decidable? [Clarity, Spec §FR-012]
- [ ] CHK010 Is the "very long report" limit a stated number in requirements? The spec says "a stated generous length"; the data model states 4000 chars. Confirm the spec intends to delegate the number and that 4000 is the agreed value. [Ambiguity, Spec §Edge Cases, Data Model §Message]
- [x] CHK011 Are duplicate-report criteria decidable — what makes a new report "the same problem" (same category + same reporter + open status, or semantic similarity)? [Clarity, Spec §Edge Cases] — *Resolved 2026-07-08: spec edge case defines same reporter + same category + status ≠ closed; T040 updated to match.*
- [x] CHK012 Is "typical reply" in the latency target defined tightly enough to test (which input class, which percentile — e.g., P90 over the benchmark set)? [Clarity, Spec §SC-008] — *Resolved 2026-07-08: SC-008 now measures both targets at the 90th percentile across the benchmark set.*

## Requirement Consistency

- [x] CHK013 Do the allowed status transitions match between the spec's clarified lifecycle and the data model? The data model adds `open→closed` (withdrawn/duplicate) which the spec's clarification does not mention. [Conflict, Spec §Clarifications, Data Model §Ticket status] — *Resolved 2026-07-08: spec clarification amended + FR-004 now allows Open→Closed for withdrawn/duplicate reports; artifacts agree.*
- [x] CHK014 Is the "resume later within the same session" wording for silent users consistent with cross-session persistent identity — can a waiting conversation be resumed in a NEW session under the same orgId, or does it expire? [Conflict, Spec §Edge Cases vs §Clarifications] — *Resolved 2026-07-08: edge case now allows resumption in a later session under the same orgId; expiry ends only the session.*
- [ ] CHK015 Do the escalation triggers align exactly between spec (FR-005/FR-006/FR-013) and the data model's trigger table (user_request, low_confidence, out_of_scope, llm_unavailable) — is `out_of_scope` traceable to a spec requirement? [Consistency, Spec §FR-002/§FR-012, Data Model §Escalation triggers]
- [ ] CHK016 Is one-way escalation (no hand-back from human_involved in this feature) stated consistently in both spec and data model, so the dashboard feature inherits a documented boundary rather than an accident? [Consistency, Data Model §Handling mode, Spec §Assumptions]
- [ ] CHK017 Do the six category names match exactly (wording and count) across spec FR-002, the data-model `IssueCategory` enum, and contract payloads? [Consistency, Spec §FR-002, Data Model §Enumerations, Contracts §Shared Types]
- [ ] CHK018 Is ticket visibility scope consistent between session start (`openTickets` = status ≠ closed) and FR-008/ticket listing ("any status", "including earlier sessions")? Is showing only open tickets at session start the intended requirement? [Consistency, Contracts §POST /api/sessions, Spec §FR-008]
- [ ] CHK019 Does the demo/test-only state-transition endpoint stay compatible with the clarified "no staff-facing capability" boundary — is its non-product status and mode guard stated as a requirement, not just contract prose? [Consistency, Contracts §Test-Support, Spec §Clarifications]

## Acceptance Criteria Quality

- [ ] CHK020 Is SC-003 fully measurable — is the benchmark set's size, composition (per-category counts, ambiguous/out-of-scope share), and labelling method defined so 80%/5% are computable and repeatable? [Measurability, Spec §SC-003]
- [ ] CHK021 Is SC-006 defined with probe frequency, probe content, and pass criteria for the 24-hour window (every attempt? N of M?)? [Measurability, Spec §SC-006]
- [ ] CHK022 Is SC-001's "under 2 minutes... without instructions" operationalised for UAT (timer start/stop events, task script)? [Measurability, Spec §SC-001, §SC-007]
- [ ] CHK023 Can FR-007's "everything already attempted" be objectively verified — is there a defined completeness criterion for handover context (transcript + classification + clarifications = sufficient)? [Measurability, Spec §FR-007]
- [ ] CHK024 Is "plain, jargon-free language" (FR-010) assessable by criteria beyond tester opinion — e.g., a banned-jargon list, reading-level target, or defined UAT rubric feeding SC-007? [Measurability, Spec §FR-010, §SC-007]

## Scenario Coverage

- [ ] CHK025 Are conversational states beyond issue-reporting specified or explicitly bounded — thanks/goodbye/small talk, repeated greetings, asking what the agent can do? Only "hi" is covered. [Coverage, Spec §US1-AS4]
- [ ] CHK026 Are requirements defined for a user reporting on behalf of someone else or for shared equipment (printer used by many) — accepted as-is under the reporter's orgId, or out of scope? [Coverage, Gap]
- [ ] CHK027 Are recovery-flow requirements defined for SSE disconnection — must missed status changes be delivered on reconnect (contract mentions best-effort `Last-Event-ID`), and does SC-004's 2 s promise hold across reconnects? [Coverage, Contracts §Events, Spec §SC-004]
- [ ] CHK028 Are concurrent-session requirements defined — same orgId active in two browser tabs/sessions simultaneously (both receive events? last-write on conversation state?)? [Coverage, Gap, Research §R8]

## Edge Case Coverage

- [ ] CHK029 Is behaviour specified when the atomic ticket-reference counter or DB write fails mid-conversation — does the user get an error message requirement, and is intake-never-fails scoped to LLM failure only? [Edge Case, Gap, Spec §FR-013]
- [ ] CHK030 Are requirements defined for messages sent to an `ended` conversation or after session expiry (rejected? new conversation auto-started?)? [Edge Case, Gap, Data Model §Conversation]
- [x] CHK031 Is the clarification-round counter's scope defined — per conversation (data model) or per problem report? A user reporting a second issue in the same conversation may inherit exhausted rounds. [Edge Case, Data Model §Conversation, Spec §FR-005] — *Resolved 2026-07-08: counter scoped per problem report, resets on ticket creation/escalation (FR-005, data-model Conversation, T037).*

## Non-Functional Requirements

- [ ] CHK032 Is every IR NFR either covered by a spec requirement/success criterion or explicitly deferred — in particular IR NFR-4 (human oversight of critical operations): is it satisfied vacuously here (no critical operations exist) and is that stated? [Traceability, Constitution §I, Spec §Assumptions]
- [x] CHK033 Is IR NFR-5's second clause — access to stored logs/transcripts restricted to approved roles — addressed or explicitly deferred, given no roles or staff access exist in this feature? [Coverage, Gap, Spec §FR-011] — *Resolved 2026-07-08: explicit deferral added to spec Assumptions (arrives with dashboard access control); also states vacuous satisfaction of IR NFR-4/audit mandate.*
- [ ] CHK034 Are data-retention requirements for conversations, tickets, and audit history specified or explicitly deferred with rationale (flagged Outstanding at clarify stage)? [Gap, Spec §Assumptions]
- [ ] CHK035 Is the concurrency envelope (3–10 users in plan) reflected in any requirement or success criterion, or intentionally absent from the spec? [Coverage, Plan §Scale/Scope]
- [ ] CHK036 Are accessibility requirements for the chat UI defined or explicitly excluded for this feature (keyboard use, screen-reader labels for streaming text and status badges)? [Gap]

## Dependencies & Assumptions

- [ ] CHK037 Is the impersonation-risk acceptance (persistent orgId, no verification) explicitly bounded to the isolated test environment and cross-referenced to IR NFR-3, so the decision is defensible in the viva? [Assumption, Spec §Assumptions, §Clarifications]
- [ ] CHK038 Is the assumption that Ollama/model availability is the only understanding-component failure mode documented — are provider-swap configurations (API-key mode) required to satisfy the same FR-013 degradation behaviour? [Assumption, Research §R1/§R7, Spec §FR-013]
- [ ] CHK039 Are the deferred-feature boundaries (voice, FR-4 guidance, FR-8 remediation, FR-9 dashboard) each paired with what THIS feature must leave behind for them (e.g., transcript handover for dashboard, text-first pipeline for voice)? [Traceability, Spec §Assumptions]

## Notes

- Check items off as completed: `[x]`; record resolution notes inline under the item.
- Items CHK001, CHK007, CHK013, CHK014, CHK018, CHK031, CHK033 encode concrete tensions found while cross-reading spec ↔ data-model ↔ contracts — resolve these before `/speckit-tasks`.
- Resolutions that change requirements belong in spec.md (and, where design-owned, research.md/data-model.md); keep the constant-ownership decisions (CHK007/CHK008/CHK010) consistent so Chapter 5 tests trace to one source.
