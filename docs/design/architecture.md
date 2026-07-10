# Architecture: Conversational & Ticketing Foundation

## System Overview

```mermaid
graph TB
    subgraph Client["Browser (React + Vite + Tailwind)"]
        UI[Chat UI]
        SSEClient[SSE Event Listener]
    end

    subgraph Backend["Backend (Express + Node.js ≥20)"]
        Routes["API Routes<br/>sessions / conversations / tickets / health"]
        Middleware["Middleware<br/>zod validation, error handler"]
        SessionSvc["Session Service<br/>in-memory session map"]
        ConvSvc["Conversation Service<br/>chat orchestration, clarification rounds"]
        ClassifySvc["Classification Service<br/>LLM output → category + confidence"]
        EscalationSvc["Escalation Service<br/>rules: user_request, low_confidence,<br/>out_of_scope, llm_unavailable"]
        TicketSvc["Ticket Service<br/>creation, state machine, history"]
        EventBus["Event Bus<br/>SSE publish/subscribe per session"]
        LLMGateway["LLM Gateway<br/>(single module — no other<br/>module may import an LLM client)"]
    end

    subgraph LLM["LLM Provider (pluggable)"]
        Ollama["OllamaProvider<br/>llama3.1:8b Q4 (default)"]
        OpenAICompat["OpenAI-Compatible Provider"]
        Mock["MockLlmProvider<br/>(deterministic, tests)"]
    end

    subgraph DB["MongoDB (Mongoose)"]
        Reporter[(Reporter)]
        Conversation[(Conversation)]
        Message[(Message)]
        Ticket[(Ticket)]
        Counter[(Counter — atomic ticket refs)]
    end

    UI -->|REST: POST /api/sessions,<br/>POST /messages| Routes
    SSEClient <-->|GET /api/events<br/>SSE stream| EventBus

    Routes --> Middleware --> SessionSvc
    Routes --> ConvSvc
    Routes --> TicketSvc

    ConvSvc --> ClassifySvc
    ConvSvc --> EscalationSvc
    ClassifySvc --> LLMGateway
    LLMGateway --> Ollama
    LLMGateway --> OpenAICompat
    LLMGateway --> Mock

    ConvSvc --> TicketSvc
    EscalationSvc --> TicketSvc
    TicketSvc --> EventBus
    EventBus -.->|push: ticket_updated,<br/>agent_message| SSEClient

    SessionSvc --> Reporter
    SessionSvc --> Conversation
    ConvSvc --> Message
    TicketSvc --> Ticket
    TicketSvc --> Counter

    style LLMGateway fill:#4a5568,stroke:#2d3748,color:#fff
    style EscalationSvc fill:#742a2a,stroke:#521717,color:#fff
    style EventBus fill:#22543d,stroke:#1a4331,color:#fff
```

## Key Architectural Principles

1. **Single LLM Gateway** (Principle VI): All LLM access is funneled through `backend/src/services/llm/` — no other module imports an LLM client directly. This makes provider swaps (Ollama ↔ OpenAI-compatible ↔ Mock) a one-line config change and keeps LLM output validation centralized.

2. **Zero Execution Capability** (Principle II — Safety-First): There is no executor, no command whitelist, no code path that runs anything. The chatbot classifies and creates tickets; it never acts on the user's machine. LLM responses are treated as untrusted input — zod-validated against a closed category enum before use.

3. **Escalation as First-Class Citizen** (Principle III — Human-in-the-Loop): The Escalation Service is a dedicated module, unit-tested independently (TDD, tests-first per Principle IV) from the conversation flow. Every escalation path (explicit request, low confidence, out-of-scope, LLM unavailable) converges on the same `human_involved` handling-mode transition and carries the full conversation transcript.

4. **Event-Driven Real-Time Updates**: The Event Bus is an in-process pub/sub keyed by session ID. Ticket state transitions and new agent messages publish events that SSE clients subscribe to, satisfying the ≤2-second update SLA (SC-004) without polling.

5. **Session/Reporter Separation**: Sessions are ephemeral (in-memory, per browser tab); Reporters are persistent (MongoDB, keyed by `orgId`). This lets a reporter resume across sessions/devices and see all previously reported open tickets (FR-008).

## Deployment Topology (Demo Environment)

```mermaid
graph LR
    Browser["Browser<br/>localhost:5173"]
    Vite["Vite Dev Server<br/>:5173<br/>proxies /api → :3000"]
    Express["Express Server<br/>:3000<br/>APP_MODE=demo"]
    MongoMem["mongodb-memory-server<br/>in-process Mongo"]
    OllamaLocal["Ollama<br/>localhost:11434<br/>(or MockLlmProvider)"]

    Browser --> Vite
    Vite --> Express
    Express --> MongoMem
    Express --> OllamaLocal
```

All four components run on a single machine (HP Victus 16) for the demo path — no cloud dependency on the core flow.
