# Chapter 5 Test Case Traceability

| TC No. | Description | Suite | Status | Duration (ms) |
|---|---|---|---|---|
| TC-000 | boots the app against an in-memory Mongo and reports healthy | tests/helpers/test-app.smoke.test.ts | Passed | 29.1 |
| TC-001 | wires the mock LLM provider into the factory | tests/helpers/test-app.smoke.test.ts | Passed | 0.2 |
| TC-002 | creates a session for a brand-new orgId | tests/integration/sessions.test.ts | Passed | 329.5 |
| TC-003 | resuming with the same orgId reuses the reporter and surfaces open tickets | tests/integration/sessions.test.ts | Passed | 39.1 |
| TC-004 | rejects an invalid orgId | tests/integration/sessions.test.ts | Passed | 7.9 |
| TC-005 | rejects a missing displayName | tests/integration/sessions.test.ts | Passed | 8.2 |
| TC-006 | accepts a valid classification payload | tests/unit/classification.test.ts | Passed | 1.2 |
| TC-007 | rejects an unknown category | tests/unit/classification.test.ts | Passed | 0.7 |
| TC-008 | rejects an out-of-range confidence | tests/unit/classification.test.ts | Passed | 0.4 |
| TC-009 | returns classified when confidence is at or above the threshold | tests/unit/classification.test.ts | Passed | 0.9 |
| TC-010 | returns needs_clarification when confidence is below the threshold | tests/unit/classification.test.ts | Passed | 0.2 |
| TC-011 | returns llm_unavailable when the provider fails | tests/unit/classification.test.ts | Passed | 0.3 |
| TC-012 | classified report produces a plain-language confirmation carrying a quotable ticket reference (US1-AS1) | tests/integration/report-issue.test.ts | Passed | 402.9 |
| TC-013 | a classified ticket records timestamp, category, description, and reporter identity (US1-AS2) | tests/integration/report-issue.test.ts | Passed | 60.9 |
| TC-014 | I forgot my password and can't log into my computer classifies into password_login (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 64.5 |
| TC-014 | my wifi keeps dropping and I can't reach the internet classifies into network (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 45.3 |
| TC-014 | the printer on the 3rd floor is jammed again classifies into printer (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 62.6 |
| TC-014 | my mouse and keyboard stopped responding classifies into peripherals (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 47.3 |
| TC-014 | my laptop is really slow and keeps freezing classifies into performance (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 48.0 |
| TC-014 | is there an outage affecting email right now? classifies into service_status (US1-AS3) | tests/integration/report-issue.test.ts | Passed | 46.7 |
| TC-015 | a bare greeting gets a conversational reply and creates no ticket (US1-AS4) | tests/integration/report-issue.test.ts | Passed | 219.1 |
| TC-016 | an unreachable LLM still produces a saved, human-flagged ticket with a quotable reference | tests/integration/degradation.test.ts | Passed | 391.4 |
| TC-017 | GET /api/health reports degraded (still HTTP 200) when the LLM is unreachable | tests/integration/degradation.test.ts | Passed | 6.7 |
| TC-018 | GET /api/health reports degraded (still HTTP 200) when the LLM provider throws | tests/integration/degradation.test.ts | Passed | 6.4 |
| TC-019 | allows status "open" -> "in_progress" and records history | tests/unit/state-machine.test.ts | Passed | 1.6 |
| TC-019 | allows status "open" -> "closed" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-019 | allows status "in_progress" -> "resolved" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-019 | allows status "resolved" -> "in_progress" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-019 | allows status "resolved" -> "closed" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "open" -> "open" | tests/unit/state-machine.test.ts | Passed | 2.8 |
| TC-020 | rejects status "open" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-020 | rejects status "in_progress" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-020 | rejects status "in_progress" -> "in_progress" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-020 | rejects status "in_progress" -> "closed" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "resolved" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "resolved" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "open" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "in_progress" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "resolved" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-020 | rejects status "closed" -> "closed" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-021 | allows handlingMode "automated" -> "waiting_on_user" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-021 | allows handlingMode "automated" -> "human_involved" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-021 | allows handlingMode "waiting_on_user" -> "automated" and records history | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-021 | allows handlingMode "waiting_on_user" -> "human_involved" and records history | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-022 | rejects handlingMode "automated" -> "automated" | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-022 | rejects handlingMode "waiting_on_user" -> "waiting_on_user" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "human_involved" -> "automated" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-022 | rejects handlingMode "human_involved" -> "waiting_on_user" | tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-022 | rejects handlingMode "human_involved" -> "human_involved" | tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-023 | is append-only across multiple transitions | tests/unit/state-machine.test.ts | Passed | 0.4 |
| TC-024 | human_involved has no outgoing handlingMode transitions | tests/unit/state-machine.test.ts | Passed | 0.5 |
| TC-025 | classifies the benchmark set at >=80% accuracy with <=5% confident misclassification, within SC-008 latency | tests/benchmark/classification.bench.test.ts | Passed | 1.4 |
| TC-026 | GET /api/tickets returns every ticket for the session's reporter, any status, newest first (US2-AS1) | tests/integration/status-updates.test.ts | Passed | 501.1 |
| TC-027 | GET /api/tickets/:reference returns detail with history and transcript; 404 unknown; 403 other reporter (FR-007) | tests/integration/status-updates.test.ts | Passed | 105.4 |
| TC-028 | a staff transition pushes a plain-language ticket_updated event within 2 seconds (SC-004, FR-010) | tests/integration/status-updates.test.ts | Passed | 59.8 |
| TC-029 | asking about status in chat yields a per-ticket plain-language summary and no new ticket (US2-AS2) | tests/integration/status-updates.test.ts | Passed | 82.8 |
| TC-030 | a new session with the same orgId sees earlier tickets (FR-008) | tests/integration/status-updates.test.ts | Passed | 61.2 |
| TC-031 | a waiting_on_user ticket returns to automated handling when the user replies (US2-AS3) | tests/integration/status-updates.test.ts | Passed | 94.9 |
| TC-032 | a transition rejected by the state machine returns 409 INVALID_TRANSITION and leaves the ticket unchanged | tests/integration/status-updates.test.ts | Passed | 53.4 |
| TC-033 | PATCH /api/tickets/:reference/state is absent (404) when APP_MODE is not demo or test | tests/integration/test-support-guard.test.ts | Passed | 390.4 |
| TC-034 | marking a ticket resolved prompts the reporter, and a confirmation closes it | tests/integration/resolution-confirm.test.ts | Passed | 489.0 |
| TC-035 | replying that the problem persists reopens the ticket to in_progress | tests/integration/resolution-confirm.test.ts | Passed | 121.5 |
| TC-036 | no reply leaves the ticket Resolved | tests/integration/resolution-confirm.test.ts | Passed | 393.0 |
| TC-037 | an explicit human request escalates immediately, regardless of any other signal | tests/unit/escalation.test.ts | Passed | 1.7 |
| TC-038 | low confidence asks for clarification below the round limit and escalates only once rounds are exhausted | tests/unit/escalation.test.ts | Passed | 0.3 |
| TC-039 | out-of-scope reports escalate with reason out_of_scope | tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-040 | LLM unavailability escalates with reason llm_unavailable | tests/unit/escalation.test.ts | Passed | 0.1 |
| TC-041 | every escalation decision flags escalated and routes to human_involved | tests/unit/escalation.test.ts | Passed | 0.5 |
| TC-042 | never-silent-guess — a low-confidence outcome never proceeds to an unescalated categorised ticket | tests/unit/escalation.test.ts | Passed | 1.3 |
| TC-043 | a confident classification with no other signals proceeds without escalation | tests/unit/escalation.test.ts | Passed | 0.1 |
| TC-044 | an ambiguous report gets a clarifying question and no ticket (US3-AS1) | tests/integration/escalation-flow.test.ts | Passed | 429.3 |
| TC-045 | still unclear after the clarification rounds are exhausted → unclassified escalated ticket (US3-AS2) | tests/integration/escalation-flow.test.ts | Passed | 151.7 |
| TC-046 | an explicit human request escalates immediately with an acknowledgement (US3-AS3) | tests/integration/escalation-flow.test.ts | Passed | 63.4 |
| TC-047 | an escalated ticket carries the full transcript so nothing is re-asked (US3-AS4, FR-007) | tests/integration/escalation-flow.test.ts | Passed | 166.1 |
| TC-048 | non-IT requests are detected as off-topic | tests/unit/refusal.test.ts | Passed | 2.0 |
| TC-049 | requests for the agent to execute remediation are detected | tests/unit/refusal.test.ts | Passed | 0.3 |
| TC-050 | ordinary IT issue reports stay in scope | tests/unit/refusal.test.ts | Passed | 0.2 |
| TC-051 | a message describing two problems is acknowledged one at a time and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 404.8 |
| TC-052 | a duplicate report in the same category surfaces the existing ticket instead of creating a new one | tests/integration/edge-cases.test.ts | Passed | 108.7 |
| TC-053 | confirming a duplicate is the same problem leaves the existing ticket untouched | tests/integration/edge-cases.test.ts | Passed | 156.6 |
| TC-054 | denying a duplicate is the same problem opens a second ticket | tests/integration/edge-cases.test.ts | Passed | 141.3 |
| TC-055 | vowel-less gibberish input is treated as content-free and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 43.8 |
| TC-056 | punctuation-only input is treated as content-free and creates no ticket | tests/integration/edge-cases.test.ts | Passed | 48.5 |
