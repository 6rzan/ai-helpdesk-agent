# Research: Guided Troubleshooting

**Feature**: 003-guided-troubleshooting | **Date**: 2026-07-12

All Technical Context unknowns resolved. Decisions below follow the format Decision / Rationale / Alternatives considered.

## R1 — Guide & category storage: MongoDB collections, seeded

**Decision**: Store `SupportCategory` and versioned `TroubleshootingGuide` documents in MongoDB (Mongoose schemas). A seed script (`backend/src/scripts/seed-guides.ts`) inserts the six IR-mandated categories with their initial guides; it is idempotent (upserts by category name, never overwrites newer versions).

**Rationale**: FR-014 requires add/edit with no code change and SC-007 requires changes live for the next conversation — database-backed content satisfies both without redeploys. Mongoose is the constitution-committed data layer. Seeding keeps the mandated six reproducible on any fresh demo machine (Principle IV demo gate).

**Alternatives considered**: (a) JSON/YAML guide files in the repo, hot-reloaded — rejected: weaker audit trail (git identity ≠ maintainer name), no runtime uniqueness validation, and "edit a file on the demo machine" is a worse maintainer story than a credentialed API. (b) Hardcoded TypeScript guide modules — rejected: violates FR-014 outright.

## R2 — Dynamic categories in classification: data-driven prompt assembly

**Decision**: The classification prompt's category list (name + classification description + confidence rules) is assembled at runtime from the `categories` collection instead of the current hardcoded literal. `unclassified` remains a hardcoded fallback pseudo-category. The `IssueCategory` string-union in `enums.ts` is replaced by runtime validation: classifier output is checked against the live category set (zod + DB lookup); unknown → treated as `unclassified` → existing low-confidence escalation path.

**Rationale**: New categories must classify without code changes (US4 acceptance 1). Keeping `unclassified` hardcoded preserves the safety default (FR-012). The existing classification regression test set runs against the seeded six to prove no regression (spec assumption; Principle VIII prompt-regression rule).

**Alternatives considered**: Keeping the enum and requiring a code change per category — rejected, fails FR-014. Letting the LLM see guide content during classification — rejected, bloats prompt and adds no classification signal.

## R3 — Guided session state: dedicated collection, version-pinned

**Decision**: New `guided_sessions` collection: one active session per conversation, holding `conversationId`, `ticketId`, `categoryName`, `guideId` + `guideVersion` (pinned at start), `currentStepIndex`, `stepAttempts[]` (step index, outcome, timestamp), and `state` (`active | resolved | escalated | abandoned`). Ticket detail responses join the session's `stepAttempts` so the record is visible on existing ticket surfaces (FR-005, FR-009).

**Rationale**: Persisted per-conversation state survives restarts (FR-011, Principle VIII memory rule). Pinning `guideVersion` at session start satisfies FR-017 (mid-session guide edits don't disturb in-flight sessions) and SC-008 (attempts always readable against the exact version used). A separate collection keeps `conversations` and `tickets` schemas stable — smaller blast radius on foundation code.

**Alternatives considered**: Embedding session state in the Conversation document — rejected: bloats a hot document and complicates the ticket join. Embedding in Ticket — rejected: sessions are conversation-scoped; a re-reported issue (spec edge case) creates a new session against a new ticket cleanly with a separate collection.

## R4 — Step-reply interpretation: schema-validated LLM mode + deterministic advancement

**Decision**: A new provider capability `interpretStepReply` sends the current step text + the user's reply and must return strict JSON validated by zod: `{ outcome: "worked" | "not_worked" | "already_tried" | "question" | "wants_human" | "unclear", confidence: number, reply: string }`. The guidance state machine in `guidance-service.ts` — plain TypeScript, no LLM — maps outcomes to transitions: advance, resolve, answer-then-hold (question), escalate (wants_human), clarify (unclear or low confidence, FR-013). Step text shown to users always comes from the stored guide (the LLM may wrap it conversationally but the canonical instruction text is included verbatim).

**Rationale**: Principle II/VIII — LLM output is untrusted input; the deterministic state machine guarantees steps are never invented, skipped, or reordered (FR-004). Mirrors the existing classify pattern (strict-JSON + zod) already proven in the codebase.

**Alternatives considered**: Letting the LLM manage the whole guided dialogue via a long system prompt — rejected: unverifiable step fidelity, breaks FR-004/SC-004. Keyword matching ("yes"/"no") without LLM — rejected: fails real phrasing ("still nothing after that"), causing wrong-outcome records; the LLM interpretation with a clarify fallback is strictly safer.

## R5 — Prompt modules: extract to versioned layered modules now

**Decision**: Create `backend/src/services/llm/prompts/` with `core.ts` (identity/persona + safety layers), `classification.ts` (data-driven category list variant), and `guidance.ts` (step-presentation and reply-interpretation variants). Both providers consume these modules; the duplicated inline `CLASSIFICATION_SYSTEM_PROMPT` / `CHAT_SYSTEM_PROMPT` literals in `ollama-provider.ts` and `openai-compat-provider.ts` are deleted. User content is always delimited as data within these prompts.

**Rationale**: Constitution Principle VIII mandates versioned prompt modules with mode variants branching from a shared core; the current inline duplicated literals are existing debt, and adding two more modes inline would deepen it. Doing the extraction in this feature is a precondition, not scope creep.

**Alternatives considered**: Deferring extraction and adding guidance prompts inline — rejected: triples the duplication and directly contradicts a MUST in the constitution.

## R6 — Maintainer authorisation: environment-configured credential

**Decision**: Management endpoints require two headers: `x-maintainer-key` (must equal `MAINTAINER_KEY` from environment; timing-safe compare) and `x-maintainer-name` (non-empty, recorded on every change). Missing/wrong key → 401; endpoints are mounted only when `MAINTAINER_KEY` is set. `.env.example` documents both. No accounts, no sessions.

**Rationale**: Clarification session 2026-07-12 decision. Smallest mechanism giving real access control plus a named actor for the change log; role-based accounts are explicitly deferred to the staff-dashboard feature (recorded in README roadmap).

**Alternatives considered**: No auth / local-only — rejected in clarification. Bringing forward user accounts — rejected in clarification (dashboard-phase scope).

## R7 — Guide versioning & change history: immutable version documents

**Decision**: A guide edit never mutates an existing guide document. Each version is its own document: `{ categoryName, version (monotonic int), steps[], changedBy, changedAt, changeNote?, active: boolean }`; activating version n deactivates n−1 atomically. Category deletion is blocked for `mandated: true` categories; non-mandated deletion is a soft-delete (`retired: true`) so historical sessions keep resolving their guide text.

**Rationale**: FR-016 (who/when/what + retrievable prior versions) falls out of the document model with no separate audit table; FR-017/SC-008 pinning works because old versions are never destroyed; FR-018 mandated-six protection is a schema flag + service check.

**Alternatives considered**: Mutable guide + separate audit log collection — rejected: two sources of truth, and reconstructing "the guide as the user saw it" requires log replay. Full event sourcing — rejected: over-engineering for FYP scale.

## R8 — Frontend surface: plain messages + quick-reply chips

**Decision**: Guide steps arrive as ordinary assistant messages over the existing SSE stream, carrying optional guidance metadata (`stepIndex`, `stepCount`) that `ChatPage` renders as a small "Step n of m" marker. A `QuickReplies` component under the newest step offers "That worked", "Didn't work", "Talk to a human" — each simply sends that plain text as a normal user message. Free typing always works; chips are an accelerator, not a control channel.

**Rationale**: Keeps the pipeline text-only (IR FR-1 — voice input keeps working unchanged), zero new API surface for the frontend, and the Design Direction's minimal-change discipline for shared components (`ChatPage` is shared with the voice flow).

**Alternatives considered**: Structured button payloads with a distinct message type — rejected: forks the pipeline FR-1 relies on and adds contract surface for no user value. A step-progress sidebar/wizard — rejected: chat-native flow is the IR's interaction model; wizard chrome duplicates state already visible in the conversation.
