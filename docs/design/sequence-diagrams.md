# Sequence Diagrams: Conversational & Ticketing Foundation

## 1. Report an Issue → Classified Ticket (US1)

```mermaid
sequenceDiagram
    actor User
    participant UI as Chat UI
    participant API as Express Routes
    participant Conv as Conversation Service
    participant Classify as Classification Service
    participant LLM as LLM Gateway
    participant Ticket as Ticket Service
    participant DB as MongoDB
    participant SSE as Event Bus

    User->>UI: "my laptop is really slow and keeps freezing"
    UI->>API: POST /api/conversations/:id/messages
    API->>Conv: handleMessage(text)
    Conv->>DB: save Message(author=user)
    Conv->>Classify: classify(text)
    Classify->>LLM: complete(prompt)
    LLM-->>Classify: { category: "performance", confidence: 0.92, reply }
    Classify-->>Conv: classified (confidence ≥ threshold)
    Conv->>Ticket: createTicket(category, description, confidence)
    Ticket->>DB: nextTicketReference() [atomic counter]
    Ticket->>DB: save Ticket(reference="HD-0001", status=open, handlingMode=automated)
    Ticket-->>Conv: ticket
    Conv->>DB: save Message(author=agent, text="confirmation + reference")
    Conv->>SSE: publish(agent_message)
    SSE-->>UI: SSE push
    UI-->>User: "Got it — I've logged this as HD-0001 (performance)..."
```

## 2. Status Query + Live Staff-Driven Update (US2)

```mermaid
sequenceDiagram
    actor User
    actor Staff
    participant UI as Chat UI
    participant API as Express Routes
    participant Conv as Conversation Service
    participant TicketSvc as Ticket Service
    participant StateMachine as State Machine
    participant DB as MongoDB
    participant SSE as Event Bus

    Note over Staff,API: Staff drives a state transition (demo-mode test-support endpoint)
    Staff->>API: PATCH /api/tickets/HD-0001/state { handlingMode: human_involved }
    API->>StateMachine: transitionHandlingMode(ticket, "human_involved", actor="staff")
    StateMachine->>StateMachine: validate transition (automated → human_involved: allowed)
    StateMachine->>DB: append TransitionRecord to history
    API->>TicketSvc: notifyTicketUpdated(ticket, transition)
    TicketSvc->>SSE: publish(ticket_updated, plainText="Ticket HD-0001 now with IT staff")
    SSE-->>UI: SSE push (within 2s, SC-004)
    UI-->>User: banner + inline event + live ticket badge update

    Note over User,API: User asks about status in chat
    User->>UI: "What's the status of my tickets?"
    UI->>API: POST /api/conversations/:id/messages
    API->>Conv: handleMessage(text)
    Conv->>Conv: detect status-query intent
    Conv->>TicketSvc: getOpenTickets(reporterId)
    TicketSvc->>DB: find tickets
    DB-->>TicketSvc: [HD-0001, ...]
    TicketSvc-->>Conv: ticket summaries
    Conv->>DB: save Message(author=agent, text="plain-language per-ticket summary")
    Conv->>SSE: publish(agent_message)
    SSE-->>UI: SSE push
    UI-->>User: per-ticket status summary (no new ticket created)
```

## 3. Clarification → Escalation Flow (US3)

```mermaid
sequenceDiagram
    actor User
    participant UI as Chat UI
    participant API as Express Routes
    participant Conv as Conversation Service
    participant Classify as Classification Service
    participant Escalate as Escalation Service
    participant Ticket as Ticket Service
    participant DB as MongoDB
    participant SSE as Event Bus

    User->>UI: "something is wrong with my thing, it just is not right"
    UI->>API: POST /messages
    API->>Conv: handleMessage(text)
    Conv->>Classify: classify(text)
    Classify-->>Conv: needs_clarification (confidence < threshold)
    Conv->>DB: increment Conversation.clarificationRounds (0→1)
    Conv->>DB: save Message(agent, "Could you share a bit more detail...")
    Conv->>SSE: publish(agent_message)
    SSE-->>UI: clarifying question (round 1, no ticket)

    User->>UI: "it really just does something odd sometimes"
    UI->>API: POST /messages
    API->>Conv: handleMessage(text)
    Conv->>Classify: classify(text)
    Classify-->>Conv: needs_clarification (still low confidence)
    Conv->>DB: increment clarificationRounds (1→2, rounds exhausted)
    Conv->>Escalate: evaluate(rounds=2, confidence=low)
    Escalate-->>Conv: escalate(reason="low_confidence")
    Conv->>Ticket: createTicket(category="unclassified", escalated=true)
    Ticket->>DB: save Ticket(handlingMode=human_involved, escalationReason=low_confidence)
    Conv->>SSE: publish(ticket_updated + agent_message)
    SSE-->>UI: "I still can't quite classify this, flagging for a person. Ref: HD-0002"

    Note over User,SSE: Alternative: explicit human request (any time, no rounds needed)
    User->>UI: "can I just talk to IT staff about this?"
    UI->>API: POST /messages
    API->>Conv: handleMessage(text)
    Conv->>Escalate: evaluate(explicitRequest=true)
    Escalate-->>Conv: escalate(reason="user_request") [immediate, bypasses rounds]
    Conv->>Ticket: createTicket / transition to human_involved
    Conv->>DB: save Message(agent, "Understood — I'm escalating this to our IT staff now.")
    Conv->>SSE: publish(agent_message)
    SSE-->>UI: acknowledgement matching /escalat|staff|human|person/i
```

## 4. LLM Degradation Path

```mermaid
sequenceDiagram
    actor User
    participant Conv as Conversation Service
    participant Classify as Classification Service
    participant LLM as LLM Gateway
    participant Escalate as Escalation Service
    participant Ticket as Ticket Service
    participant DB as MongoDB

    User->>Conv: reports an issue
    Conv->>Classify: classify(text)
    Classify->>LLM: complete(prompt)
    LLM--xClassify: timeout / unreachable / malformed output
    Classify-->>Conv: llm_unavailable
    Conv->>Escalate: evaluate(llmUnavailable=true)
    Escalate-->>Conv: escalate(reason="llm_unavailable")
    Conv->>Ticket: createTicket(category="unclassified", escalated=true)
    Ticket->>DB: save Ticket(escalationReason=llm_unavailable, handlingMode=human_involved)
    Note over Ticket,DB: Intake never fully fails — a degraded LLM still yields<br/>a saved, human-flagged ticket with a quotable reference (TC-016)
```
