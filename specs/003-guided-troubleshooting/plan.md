# Implementation Plan: Guided Troubleshooting

**Branch**: `003-guided-troubleshooting` | **Date**: 2026-07-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-guided-troubleshooting/spec.md`

## Summary

Immediately after an issue is classified and its ticket created, the assistant walks the user through a curated, versioned troubleshooting guide for that category — one step at a time, in plain language — recording each step's outcome, resolving the ticket on success, and escalating with the full attempted-steps record on failure or user request (IR FR-4, FR-7). Categories and guides become data: MongoDB-backed, maintainer-managed via credential-guarded API endpoints (no UI this increment), with the six IR-mandated categories seeded and undeletable. The classification prompt is assembled from category data at runtime so new categories classify without code changes. Step advancement is a deterministic state machine in code; the LLM only phrases steps and interprets user replies through a schema-validated prompt mode — it never chooses, invents, or reorders steps.

## Technical Context

**Language/Version**: TypeScript 5.x `strict` (backend + frontend), Node.js LTS

**Primary Dependencies**: Express, Mongoose, zod (backend); React + Vite + Tailwind CSS (frontend); LLM via existing provider abstraction (Ollama primary / OpenAI-compat alternate, per `.env`)

**Storage**: MongoDB Community — new `categories`, `guides` (versioned), `guided_sessions` collections; existing `conversations`, `messages`, `tickets` extended minimally

**Testing**: Vitest (unit + integration) + supertest; classification regression set must keep passing; TC-table-exportable naming (Chapter 5)

**Target Platform**: Single demo machine (HP Victus 16, Windows 11); backend serves built frontend

**Project Type**: Web application (`backend/` + `frontend/`)

**Performance Goals**: First guide step appears in the same reply flow as classification (no extra round-trip beyond the existing SSE stream); step advancement responses within the existing chat latency envelope (NFR-1)

**Constraints**: Fully local reference config (16 GB RAM / 6 GB VRAM); guidance is advisory-only — no code path executes anything (NFR-3); prompts must move to versioned modules (Principle VIII) since this feature adds prompt modes

**Scale/Scope**: 6 seeded categories + maintainer-added ones; guides of ~3–8 steps; single-org demo load (tens of concurrent conversations at most)

## Constitution Check

*GATE: evaluated against Constitution v1.1.1, Principles I–VIII.*

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| I | IR Fidelity | ✅ PASS | Spec traces FR-4 (primary), FR-2, FR-6, FR-7, NFR-2. Category management is an enhancement under FR-2's "at least six"; mandated six undeletable so IR baseline cannot regress. |
| II | Safety-First Automation | ✅ PASS | Guidance is advisory text only — no executor, no endpoints touched. Guide steps are curated policy-like data, never LLM-originated. Step-reply interpretation output is zod-validated; low confidence → clarify or escalate, never guess (FR-013). The agent cannot modify categories/guides at runtime (FR-018); changes are human, credentialed, and change-logged. |
| III | Human-in-the-Loop | ✅ PASS | Exhausted guides and "get me a human" escalate as first-class flows; attempted-steps record rides the ticket so context transfers (FR-009). |
| IV | Test-Backed Evidence | ✅ PASS | Escalation-affecting logic (session termination, exhaustion) is test-first; every task ships tests; classification regression set is an explicit gate for the dynamic-category change. |
| V | Documentation as Deliverable | ✅ PASS | Plan includes docs-evidence tasks: chat screenshots of a guided flow, sequence diagram update, TC tables. |
| VI | Clean TypeScript Architecture | ✅ PASS | New single-responsibility services under `backend/src/services/guidance/`; zod at every boundary (management API bodies, LLM interpretation output); files ≤ 500 lines. |
| VII | RUP-Aligned Iterative Delivery | ✅ PASS | Password/login guide is the P1 MVP slice, matching the constitution's priority order; each user story independently demoable. |
| VIII | Agent Core & Prompt Discipline | ⚠️ PASS with remediation | Current prompts are inline literals in provider files — pre-existing debt this feature must not deepen. Plan extracts prompts into versioned modules (`backend/src/services/llm/prompts/`) with a shared core and mode variants (classification, step presentation, step-reply interpretation); prompt changes gated by classification + guardrail regression tests. |

**Post-design re-check (Phase 1)**: ✅ unchanged — design artifacts introduce no new violations; the VIII remediation is scheduled work, not a waiver.

## Project Structure

### Documentation (this feature)

```text
specs/003-guided-troubleshooting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── category.ts            # NEW — SupportCategory schema
│   │   ├── guide.ts               # NEW — versioned TroubleshootingGuide schema
│   │   ├── guided-session.ts      # NEW — GuidedSession + StepAttempt schema
│   │   └── enums.ts               # MODIFIED — category validation goes dynamic
│   ├── services/
│   │   ├── guidance/
│   │   │   ├── guidance-service.ts        # NEW — deterministic step state machine
│   │   │   └── guide-admin-service.ts     # NEW — category/guide CRUD + validation + versioning
│   │   ├── classification/classifier.ts   # MODIFIED — prompt assembled from category data
│   │   ├── conversation/conversation-service.ts  # MODIFIED — guidance stage in processReply
│   │   └── llm/
│   │       ├── prompts/                   # NEW — extracted prompt modules (Principle VIII)
│   │       │   ├── core.ts                # shared persona + safety layers
│   │       │   ├── classification.ts      # mode variant (data-driven category list)
│   │       │   └── guidance.ts            # mode variants: step presentation, reply interpretation
│   │       ├── ollama-provider.ts         # MODIFIED — consume prompt modules
│   │       ├── openai-compat-provider.ts  # MODIFIED — consume prompt modules
│   │       └── types.ts                   # MODIFIED — interpretStepReply capability
│   ├── api/routes/
│   │   └── admin-guides.ts        # NEW — maintainer management endpoints
│   └── scripts/
│       └── seed-guides.ts         # NEW — seed six mandated categories + guides
└── tests/
    ├── unit/          # guidance state machine, admin validation, prompt regression
    └── integration/   # guided flow, escalation-with-context, management API

frontend/
├── src/
│   ├── pages/ChatPage.tsx         # MODIFIED — render step context, quick replies
│   ├── components/QuickReplies.tsx # NEW — outcome quick-reply chips (send plain text)
│   ├── lib/types.ts               # MODIFIED — guidance metadata on messages
│   └── services/api.ts            # MODIFIED — types only (no new endpoints called)
└── tests/
```

**Structure Decision**: Existing web-application layout (`backend/` + `frontend/`) is retained; guidance is a new backend service package plus a thin frontend rendering layer inside the existing chat page.

## Design Direction (frontend-design-pro)

- **Design Read**: Incremental addition to an existing help-desk chat product UI for stressed employees mid-IT-failure; language: the app's established React + Tailwind conventions; this is product UI, not a marketing surface, so taste-skill's landing-page machinery mostly stands down and its discipline rules (contrast, states, no AI tells) apply.
- **Dials**: DESIGN_VARIANCE 3 (consistency with existing chat beats novelty), MOTION_INTENSITY 2 (a single subtle enter transition on new messages, honoring `prefers-reduced-motion`), VISUAL_DENSITY 5 (chat is conversational but step progress must be scannable).
- **Design system / stack**: No new system — extend existing Tailwind utility conventions and components (`StatusBadge`, message bubbles in `ChatPage`). One icon family if icons are needed (project convention; no hand-rolled SVGs, no emoji as icons).
- **Palette commitment**: Existing app palette, locked — no new accent. Step-progress affordance uses the current neutral scale; resolution/escalation reuse the existing status colors already carried by `StatusBadge`.
- **Typography plan**: Existing font stack and scale, unchanged. Step instructions render as normal assistant message body text (NFR-2 plain language does the work, not type).
- **Layout strategy**: Guide steps are ordinary assistant messages, optionally prefixed with a small "Step n of m" marker inside the bubble; below the newest step message, a `QuickReplies` row (That worked / Didn't work / Talk to a human) as tappable chips that simply send the plain-text equivalent — the pipeline stays text-only (IR FR-1). No new page, no wizard chrome, no progress sidebar.
- **Motion plan**: Only the existing/standard message-appear transition; quick-reply chips get hover/active states (`scale-[0.98]` on press). Nothing scroll-driven. All motion behind `prefers-reduced-motion`.
- **Banned patterns (this feature)**: no emoji as icons; no em-dashes in UI copy; no purple/gradient accents; no card-in-card chrome around steps; no spinners (reuse existing typing/skeleton pattern while the assistant responds); no toast for step outcomes (they're conversation content); chips must pass WCAG AA contrast in both themes.
- **Affected shared components (graphify)**: `frontend/src/pages/ChatPage.tsx` (shared with voice input flow — regression risk with `VoiceControl`), `frontend/src/lib/types.ts` and `frontend/src/services/api.ts` (shared typing for all API consumers), `useEvents.ts` SSE hook (unchanged contract — keep it that way), `StatusBadge`/`TicketCard` (reused, not modified). Regression tests: existing ChatPage + VoiceControl tests must stay green.
- **Planned build sequence**: craft → critique → polish → audit (run via `/frontend-design-pro build` inside `/speckit-implement`).

## Complexity Tracking

No constitution violations requiring justification. The Principle VIII prompt-module extraction is remediation of pre-existing debt, scheduled as in-scope work (it is a precondition for adding guidance prompt modes cleanly, not gold-plating).
