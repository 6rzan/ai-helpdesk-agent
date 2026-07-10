# Phase 0 Research: Conversational & Ticketing Foundation

**Date**: 2026-07-08 | **Plan**: [plan.md](./plan.md)

Technical Context contained no NEEDS CLARIFICATION (the constitution locks the stack), so research resolves the open *design* decisions the plan depends on.

## R1. Default local model behind the provider abstraction

- **Decision**: `llama3.1:8b` (Q4_K_M quantisation) served by Ollama as the reference configuration; model name is a config value (`LLM_MODEL`), never hard-coded.
- **Rationale**: ~4.9 GB at Q4 fits the RTX 4050's 6 GB VRAM with headroom for context; strong instruction-following and reliable JSON-constrained output (needed for classification); widely documented, which suits FYP defensibility. Ollama exposes structured JSON output and token streaming — both required (classification schema, SC-008 streaming).
- **Alternatives considered**: `qwen2.5:7b-instruct` (comparable quality, kept as documented fallback if llama3.1 latency disappoints); `phi3:mini` (fastest, but weaker conversational quality for plain-language replies); cloud APIs (rejected as *default* — constitution requires a fully local reference configuration; they remain supported as alternate providers through the same abstraction).

## R2. Classification approach & confidence policy

- **Decision**: Single-call structured classification: the LLM gateway requests JSON `{category, confidence, reply}` constrained by a JSON schema; the result is zod-parsed against the closed enum of six categories + `unclassified`. Confidence policy: ≥ 0.7 → accept category and create ticket; < 0.7 → ask a clarifying question, **maximum 2 clarification rounds**, then create an unclassified ticket flagged for human attention. Schema-parse failure or malformed output is treated exactly like low confidence — never a guess (Principle II: LLM output is untrusted input).
- **Rationale**: One structured call keeps latency inside SC-008; the closed enum + zod makes the untrusted-output boundary explicit and testable; 2 rounds operationalises the spec's "bounded number of clarifying exchanges" (FR-005) while keeping conversations short.
- **Alternatives considered**: Separate classifier + reply calls (double latency, rejected); embedding-similarity classification (no confidence semantics users can audit, and a second model in VRAM); letting the model free-text its category (violates untrusted-output principle).

## R3. Provider abstraction shape

- **Decision**: A minimal in-house `LlmProvider` interface in `backend/src/services/llm/`: `classifyAndReply(input) → structured result` and `streamReply(input) → token stream`, plus `health()`. Implementations: `OllamaProvider` (default), `OpenAiCompatProvider` (any API-key provider speaking the OpenAI wire format), `MockLlmProvider` (deterministic, for tests). A factory reads config to pick one. No other module may import an LLM SDK.
- **Rationale**: Constitution mandates exactly one gateway and "custom orchestration on open-source tooling; no heavyweight agent framework". The OpenAI-compatible wire format covers most API-key providers with one implementation. A first-class mock makes every functional test deterministic and free.
- **Alternatives considered**: Vercel AI SDK / LangChain (capable but heavyweight; obscures the safety boundary the viva will probe); direct Ollama calls from services (violates Principle VI single-gateway rule).

## R4. Real-time transport for replies and status changes

- **Decision**: Server-Sent Events (SSE). One `GET /api/events` stream per session carries (a) agent reply tokens as they generate and (b) ticket status/handling-mode change events. User → server messages go over plain REST POST.
- **Rationale**: Updates are strictly server→client, which is exactly SSE's shape; trivial over Express (no extra dependency); auto-reconnect is built into `EventSource`; comfortably meets the ≤ 2 s visibility target (SC-004) and lets replies start rendering ≤ 3 s (SC-008).
- **Alternatives considered**: WebSockets (bidirectional capability unused; more moving parts); polling (2 s target forces aggressive intervals, wasteful and less demo-smooth).

## R5. Ticket reference format

- **Decision**: `HD-NNNN` — a monotonically increasing zero-padded counter (e.g. `HD-0042`) backed by an atomic MongoDB counter document.
- **Rationale**: The spec requires a reference "the user can quote later" in chat; short, unambiguous, easy to say aloud in the 25-minute demo. Atomic `findOneAndUpdate` increment avoids duplicate references without extra infrastructure.
- **Alternatives considered**: UUID (unquotable in conversation); date-embedded refs like `HD-20260708-001` (longer to type/say, no user benefit at this scale).

## R6. Testing & Chapter-5 evidence strategy

- **Decision**: Three test tiers: (1) **unit** — ticket state machine, escalation rules (written test-first, before implementation), classification output parsing; (2) **integration** — supertest against the Express app with mongodb-memory-server and `MockLlmProvider`, covering every acceptance scenario in the spec; (3) **benchmark** (opt-in, `npm run test:benchmark`) — real Ollama, a labelled report set covering all six categories + ambiguous/out-of-scope cases, asserting SC-003 (≥ 80% accuracy) and SC-008 (latency). A custom Vitest JSON reporter feeds a small script that emits APU Chapter-5 TC tables (TC-No / input / expected / actual / Passed-Failed) as markdown into `docs/`.
- **Rationale**: Functional correctness must not depend on a live model (deterministic CI on the demo machine); accuracy/latency are real-model properties so they get their own suite; TC tables generated—not hand-written—per Principle IV.
- **Alternatives considered**: Testing everything against real Ollama (slow, flaky, non-deterministic assertions); recording/replaying LLM responses (brittle fixtures, worse than an intentional mock).

## R7. LLM-unavailable degradation (FR-013)

- **Decision**: The gateway wraps every provider call with a 10 s timeout and maps timeout/connection errors to a typed `LlmUnavailable` result. The conversation service then creates an **unclassified ticket flagged for human attention** from the user's raw report and tells the user their report is saved. A `/api/health` endpoint reports provider reachability.
- **Rationale**: Spec requires intake to survive understanding-component failure; a typed result (not a thrown string) keeps the fallback path explicit and unit-testable; 10 s aligns with the reply-completion target.
- **Alternatives considered**: Queue-and-retry classification later (adds background-job machinery this feature doesn't need; human triage of unclassified tickets already covers it); hard failure with apology (violates FR-013).

## R8. Reporter identity & session handling

- **Decision**: Reporter = `{orgId (unique key), displayName}` upserted at session start (per clarification: persistent, no passwords). A session is a server-issued opaque token binding the browser tab to a reporter + active conversation; sessions expire after inactivity (default 30 minutes, `SESSION_INACTIVITY_MINUTES`) but tickets/conversations persist under the orgId.
- **Rationale**: Implements the clarified cross-session identity with the least machinery; upsert-by-orgId gives duplicate detection and ticket lookup for free; impersonation risk accepted in the isolated test environment (spec assumption).
- **Alternatives considered**: JWT-based auth (account machinery the spec explicitly excludes); cookie-only implicit identity (breaks cross-session ticket lookup).
