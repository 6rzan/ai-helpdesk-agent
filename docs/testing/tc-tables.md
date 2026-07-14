# Chapter 5 Test Case Traceability

| TC No. | Description | Suite | Status | Duration (ms) |
|---|---|---|---|---|
| TC-000 | boots the app against an in-memory Mongo and reports healthy | tests/helpers/test-app.smoke.test.ts | Passed | 13.7 |
| TC-001 | wires the mock LLM provider into the factory | tests/helpers/test-app.smoke.test.ts | Passed | 0.2 |
| TC-002 | creates a session for a brand-new orgId | tests/integration/sessions.test.ts | Passed | 63.3 |
| TC-003 | resuming with the same orgId reuses the reporter and surfaces open tickets | tests/integration/sessions.test.ts | Passed | 57.5 |
| TC-004 | rejects an invalid orgId | tests/integration/sessions.test.ts | Passed | 14.5 |
| TC-005 | rejects a missing displayName | tests/integration/sessions.test.ts | Passed | 13.9 |
| TC-006 | accepts a valid classification payload | tests/unit/classification.test.ts | Passed | 1.4 |
| TC-007 | rejects an empty category (legitimacy is checked at runtime against the categories collection, not by this schema — R2) | tests/unit/classification.test.ts | Passed | 0.8 |
| TC-008 | rejects an out-of-range confidence | tests/unit/classification.test.ts | Passed | 0.3 |
| TC-009 | returns classified when confidence is at or above the threshold | tests/unit/classification.test.ts | Passed | 1.0 |
| TC-010 | returns needs_clarification when confidence is below the threshold | tests/unit/classification.test.ts | Passed | 0.3 |
| TC-011 | returns llm_unavailable when the provider fails | tests/unit/classification.test.ts | Passed | 0.2 |
| TC-012 | classified report produces a plain-language confirmation carrying a quotable ticket reference (US1-AS1) | tests/integration/report-issue.test.ts | Passed | 173.1 |
| TC-012 | falls back to needs_clarification when the provider returns a category unknown to the categories collection | tests/unit/classification.test.ts | Passed | 0.3 |
| TC-013 | a classified ticket records timestamp, category, description, and reporter identity (US1-AS2) | tests/integration/report-issue.test.ts | Passed | 67.5 |
| TC-014 | I forgot my password and can't log into my computer classifies into password_login (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 71.8 |
| TC-014 | my wifi keeps dropping and I can't reach the internet classifies into network (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 60.1 |
| TC-014 | the printer on the 3rd floor is jammed again classifies into printer (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 70.7 |
| TC-014 | my mouse and keyboard stopped responding classifies into peripherals (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 63.7 |
| TC-014 | my laptop is really slow and keeps freezing classifies into performance (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 50.6 |
| TC-014 | is there an outage affecting email right now? classifies into service_status (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 48.2 |
| TC-015 | a bare greeting gets a conversational reply and creates no ticket (US1-AS4) | tests/integration/report-issue.test.ts | Passed | 241.4 |
| TC-016 | an unreachable LLM still produces a saved, human-flagged ticket with a quotable reference | tests/integration/degradation.test.ts | Passed | 110.8 |
| TC-016 | password_login classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.3 |
| TC-016 | network classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.2 |
| TC-016 | printer classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.2 |
| TC-016 | peripherals classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.1 |
| TC-016 | performance classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.1 |
| TC-016 | service_status classifies successfully when the provider returns that category with high confidence | tests/unit/classification.test.ts | Passed | 0.2 |
| TC-017 | GET /api/health reports degraded (still HTTP 200) when the LLM is unreachable | tests/integration/degradation.test.ts | Passed | 14.7 |
| TC-018 | GET /api/health reports degraded (still HTTP 200) when the LLM provider throws | tests/integration/degradation.test.ts | Passed | 13.0 |
| TC-019 | allows status "open" -> "in_progress" and records history | tests/unit/state-machine.test.ts | Passed | 1.5 |
| TC-019 | allows status "open" -> "closed" and records history | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-019 | allows status "in_progress" -> "resolved" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-019 | allows status "resolved" -> "in_progress" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-019 | allows status "resolved" -> "closed" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "open" -> "open" | tests/unit/state-machine.test.ts | Passed | 2.9 |
| TC-020 | rejects status "open" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-020 | rejects status "in_progress" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "in_progress" -> "in_progress" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "in_progress" -> "closed" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "resolved" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "resolved" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "in_progress" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "closed" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "closed" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-021 | allows handlingMode "automated" -> "waiting_on_user" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-021 | allows handlingMode "automated" -> "human_involved" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-021 | allows handlingMode "waiting_on_user" -> "automated" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-021 | allows handlingMode "waiting_on_user" -> "human_involved" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "automated" -> "automated" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-022 | rejects handlingMode "waiting_on_user" -> "waiting_on_user" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "human_involved" -> "automated" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "human_involved" -> "waiting_on_user" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "human_involved" -> "human_involved" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-023 | is append-only across multiple transitions | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-024 | human_involved has no outgoing handlingMode transitions | tests/unit/state-machine.test.ts | Passed | 0.5 |
| TC-026 | GET /api/tickets returns every ticket for the session's reporter, any status, newest first (US2-AS1) | tests/integration/status-updates.test.ts | Passed | 226.0 |
| TC-027 | GET /api/tickets/:reference returns detail with history and transcript; 404 unknown; 403 other reporter (FR-007) | tests/integration/status-updates.test.ts | Passed | 125.8 |
| TC-028 | a staff transition pushes a plain-language ticket_updated event within 2 seconds (SC-004, FR-010) | tests/integration/status-updates.test.ts | Passed | 100.3 |
| TC-029 | asking about status in chat yields a per-ticket plain-language summary and no new ticket (US2-AS2) | tests/integration/status-updates.test.ts | Passed | 115.7 |
| TC-030 | a new session with the same orgId sees earlier tickets (FR-008) | tests/integration/status-updates.test.ts | Passed | 92.7 |
| TC-031 | a waiting_on_user ticket returns to automated handling when the user replies (US2-AS3) | tests/integration/status-updates.test.ts | Passed | 100.5 |
| TC-032 | a transition rejected by the state machine returns 409 INVALID_TRANSITION and leaves the ticket unchanged | tests/integration/status-updates.test.ts | Passed | 72.5 |
| TC-033 | PATCH /api/tickets/:reference/state is absent (404) when APP_MODE is not demo or test | tests/integration/test-support-guard.test.ts | Passed | 132.7 |
| TC-034 | marking a ticket resolved prompts the reporter, and a confirmation closes it | tests/integration/resolution-confirm.test.ts | Passed | 238.7 |
| TC-035 | replying that the problem persists reopens the ticket to in_progress | tests/integration/resolution-confirm.test.ts | Passed | 152.7 |
| TC-036 | no reply leaves the ticket Resolved | tests/integration/resolution-confirm.test.ts | Passed | 409.7 |
| TC-037 | an explicit human request escalates immediately, regardless of any other signal | tests/unit/escalation.test.ts | Passed | 1.9 |
| TC-038 | low confidence asks for clarification below the round limit and escalates only once rounds are exhausted | tests/unit/escalation.test.ts | Passed | 0.4 |
| TC-039 | out-of-scope reports escalate with reason out_of_scope | tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-040 | LLM unavailability escalates with reason llm_unavailable | tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-041 | every escalation decision flags escalated and routes to human_involved | tests/unit/escalation.test.ts | Passed | 0.7 |
| TC-042 | never-silent-guess — a low-confidence outcome never proceeds to an unescalated categorised ticket | tests/unit/escalation.test.ts | Passed | 1.9 |
| TC-043 | a confident classification with no other signals proceeds without escalation | tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-044 | an ambiguous report gets a clarifying question and no ticket (US3-AS1) | tests/integration/escalation-flow.test.ts | Passed | 245.8 |
| TC-045 | still unclear after the clarification rounds are exhausted → unclassified escalated ticket (US3-AS2) | tests/integration/escalation-flow.test.ts | Passed | 155.6 |
| TC-046 | an explicit human request escalates immediately with an acknowledgement (US3-AS3) | tests/integration/escalation-flow.test.ts | Passed | 86.6 |
| TC-047 | an escalated ticket carries the full transcript so nothing is re-asked (US3-AS4, FR-007) | tests/integration/escalation-flow.test.ts | Passed | 180.0 |
| TC-048 | non-IT requests are detected as off-topic | tests/unit/refusal.test.ts | Passed | 1.9 |
| TC-049 | requests for the agent to execute remediation are detected | tests/unit/refusal.test.ts | Passed | 0.3 |
| TC-050 | ordinary IT issue reports stay in scope | tests/unit/refusal.test.ts | Passed | 0.2 |
| TC-051 | a message describing two problems is acknowledged one at a time and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 202.5 |
| TC-052 | a duplicate report in the same category surfaces the existing ticket instead of creating a new one | tests/integration/edge-cases.test.ts | Passed | 184.1 |
| TC-053 | confirming a duplicate is the same problem leaves the existing ticket untouched | tests/integration/edge-cases.test.ts | Passed | 167.0 |
| TC-054 | denying a duplicate is the same problem opens a second ticket | tests/integration/edge-cases.test.ts | Passed | 187.6 |
| TC-055 | vowel-less gibberish input is treated as content-free and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 60.6 |
| TC-056 | punctuation-only input is treated as content-free and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 63.5 |
| TC-057 | accepts inputOrigin=typed and persists it on the stored message | tests/integration/messages-origin.test.ts | Passed | 82.8 |
| TC-057 | accepts inputOrigin=voice and persists it on the stored message | tests/integration/messages-origin.test.ts | Passed | 42.8 |
| TC-057 | accepts inputOrigin=mixed and persists it on the stored message | tests/integration/messages-origin.test.ts | Passed | 42.2 |
| TC-058 | defaults inputOrigin to typed when omitted from the request body | tests/integration/messages-origin.test.ts | Passed | 36.2 |
| TC-059 | rejects an invalid inputOrigin value with a validation error | tests/integration/messages-origin.test.ts | Passed | 24.4 |
| TC-060 | returns inputOrigin in the ticket transcript DTO for both user and agent messages | tests/integration/messages-origin.test.ts | Passed | 70.6 |
| TC-061 | returns the result from the first provider that succeeds | tests/unit/stt-service.test.ts | Passed | 2.1 |
| TC-062 | falls through to the next provider when the first one fails | tests/unit/stt-service.test.ts | Passed | 0.6 |
| TC-063 | throws a 503 STT_UNAVAILABLE error when every provider in the chain fails | tests/unit/stt-service.test.ts | Passed | 1.6 |
| TC-064 | throws a 503 STT_UNAVAILABLE error when the chain is empty | tests/unit/stt-service.test.ts | Passed | 0.6 |
| TC-065 | transcribes valid WAV audio and returns 200 with transcript, durationSeconds, provider | tests/integration/transcription.test.ts | Passed | 105.4 |
| TC-066 | returns 400 INVALID_AUDIO when the audio part is missing | tests/integration/transcription.test.ts | Passed | 30.2 |
| TC-067 | returns 400 INVALID_AUDIO when the sample format is wrong | tests/integration/transcription.test.ts | Passed | 31.3 |
| TC-068 | returns 404 SESSION_NOT_FOUND for an unknown session | tests/integration/transcription.test.ts | Passed | 20.7 |
| TC-069 | returns 413 AUDIO_TOO_LARGE when the duration cap is exceeded | tests/integration/transcription.test.ts | Passed | 66.2 |
| TC-070 | returns 503 STT_UNAVAILABLE with a plain-language message when the provider chain is exhausted | tests/integration/transcription.test.ts | Passed | 28.1 |
| TC-070 | b: returns 503 STT_UNAVAILABLE with a plain-language message when every provider in the chain fails | tests/integration/transcription.test.ts | Passed | 29.8 |
| TC-070 | c: falls back to the next provider in the chain when the primary provider fails | tests/integration/transcription.test.ts | Passed | 25.6 |
| TC-070 | d: returns a whitespace-only transcript as-is with 200 (client decides FR-011) | tests/integration/transcription.test.ts | Passed | 30.9 |
| TC-071 | returns 409 TRANSCRIPTION_IN_PROGRESS for a concurrent request on the same session | tests/integration/transcription.test.ts | Passed | 443.7 |
| TC-072 | falls through to the next provider when the first one exceeds its timeout | tests/unit/stt-service.test.ts | Passed | 63.3 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=typed | tests/integration/messages-origin.test.ts | Passed | 51.7 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=voice | tests/integration/messages-origin.test.ts | Passed | 56.7 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=mixed | tests/integration/messages-origin.test.ts | Passed | 54.6 |
| TC-US1-01 | non-staff account is refused the ticket list with no data | tests/integration/staff-tickets.test.ts | Passed | 141.0 |
| TC-US1-02 | signed-out request is refused with 401 | tests/integration/staff-tickets.test.ts | Passed | 8.7 |
| TC-US1-03 | staff sees all tickets, filtered by status and category | tests/integration/staff-tickets.test.ts | Passed | 82.6 |
| TC-US1-04 | legacy ticket without a linked account is marked, not hidden (FR-014) | tests/integration/staff-tickets.test.ts | Passed | 83.7 |
| TC-US1-05 | staff ticket detail aggregates transcript, classification and status history | tests/integration/staff-tickets.test.ts | Passed | 48.2 |
| TC-US1-06 | staff status change is applied and attributed in a StaffActionRecord | tests/integration/staff-tickets.test.ts | Passed | 60.4 |
| TC-US1-07 | resolving records a resolve action and marks the ticket resolved | tests/integration/staff-tickets.test.ts | Passed | 47.7 |
| TC-US1-08 | an invalid status transition is refused (422) | tests/integration/staff-tickets.test.ts | Passed | 43.5 |
| TC-US1-09 | the staff stream receives a ticket_updated event on a staff status change | tests/integration/staff-events.test.ts | Passed | 125.3 |
| TC-US1-10 | the reporter's chat receives a plain-language status message when staff resolve their ticket (FR-009) | tests/integration/staff-events.test.ts | Passed | 62.0 |
| TC-US2-01 | takeover assigns the ticket to the caller, moves it to human handling and attributes the action | tests/integration/takeover.test.ts | Passed | 153.1 |
| TC-US2-02 | takeover notifies the reporter with the named handler (FR-020) | tests/integration/takeover.test.ts | Passed | 102.2 |
| TC-US2-03 | a concurrent takeover of an already-assigned ticket is refused with 409 and the current assignee (US2-5) | tests/integration/takeover.test.ts | Passed | 113.0 |
| TC-US2-04 | reassignment appends history and updates the assignee without handing back to the agent (FR-019) | tests/integration/takeover.test.ts | Passed | 116.8 |
| TC-US2-05 | reassignment refuses a non-staff target (never back to a user or the agent) | tests/integration/takeover.test.ts | Passed | 138.1 |
| TC-US2-06 | the roster reports availability, open-case counts and an advisory suggested assignee (FR-021) | tests/integration/takeover.test.ts | Passed | 134.7 |
| TC-US2-07 | a staff member can update their own availability | tests/integration/takeover.test.ts | Passed | 57.2 |
| TC-US2-08 | an escalated ticket surfaces the linked reporter's profile automatically (FR-013) | tests/integration/ticket-profile.test.ts | Passed | 162.9 |
| TC-US2-09 | a ticket whose reporter has no profile returns an explicit profile: null (FR-013) | tests/integration/ticket-profile.test.ts | Passed | 108.3 |
| TC-US2-10 | a legacy ticket with no linked account returns profile: null | tests/integration/ticket-profile.test.ts | Passed | 58.7 |
