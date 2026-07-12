# Design Direction (frontend-design-pro) — 004 Staff Dashboard & User Accounts

Produced at specify time; to be absorbed into `plan.md`'s Design Direction section when `/speckit-plan` runs (the before_plan hook will re-validate it).

## Design Read

Reading this as: internal IT-staff operations dashboard plus account/profile surfaces inside the existing chat application, for staff triaging tickets under time pressure and end users checking their own cases, with a trust-first product-UI language, leaning toward the project's existing React + Vite + Tailwind idiom.

**Dials**: DESIGN_VARIANCE **3** (trust-first product UI; predictable grid beats cleverness for triage), MOTION_INTENSITY **2** (feedback-only transitions; live list updates must not distract), VISUAL_DENSITY **6** (staff scan many tickets at once; users' "my tickets" view stays lighter).

## Design system / stack decision

- taste-skill §13 places dashboards/dense product UI outside its generation scope; the **impeccable product register** (`reference/product.md`) governs this surface at build time.
- Constitution locks the stack: Tailwind + existing component conventions. No new design system package; extend the app's own tokens/components.
- Icons stay **@phosphor-icons/react** (already the project family — one family per project).

## Palette & typography

- Inherit the existing chat UI theme (Page Theme Lock: dashboard does not introduce a second theme). One accent, already established; status and handling-mode colours are **semantic only** (StatusBadge is the single source of status colour).
- Existing app font stack; tabular numerals for ticket numbers, timestamps, and counts.

## Layout strategy

- Dashboard: persistent list + detail pattern (ticket table/list with filters; detail pane/page with conversation, attempted steps, status history, reporter profile panel). Escalated tickets visually distinguished at the top of the hierarchy.
- Profile & auth forms: label above input, helper text present, error below input; no placeholder-as-label.
- Full state coverage is mandatory: empty (no tickets / no profile), loading (skeletons matching layout), error, and denied-access states all designed, not defaulted.

## Motion plan

- Feedback and state-transition motion only (row highlight on live update, subtle pane transitions). No scroll choreography, no infinite loops. Respect `prefers-reduced-motion`.

## Banned for this feature (union of both skills + project)

- Em-dashes anywhere in UI copy; glassmorphism; gradient text; decorative dots (dots only where they carry real semantic state, e.g. live/escalated indicators); hand-rolled SVG icons; placeholder-as-label; card-boxing every data group (prefer dividers/spacing at density 6); "Jane Doe"-style fake data in screenshots (use realistic seeded demo data); mixing a second icon family.

## Affected shared components & regression risk (graphify)

| Component | Shared with | Risk |
|---|---|---|
| `frontend/src/components/StatusBadge.tsx` | Chat + dashboard | Status colour semantics must stay identical in both surfaces |
| `frontend/src/components/TicketCard.tsx` | Chat + likely dashboard list | Extending props for staff view can regress chat rendering |
| `frontend/src/components/SessionForm.tsx` | Chat entry | Sign-in flow replaces/extends the session entry — highest UX regression risk |
| `frontend/src/App.tsx` | Whole app | Gains routing + role-gated areas |
| `frontend/src/services/api.ts`, `frontend/src/lib/types.ts` | All pages | Auth headers/session + new types touch every call |

Run `graphify update .` after implementation edits.

## Planned build sequence

`craft → critique → polish → audit` (impeccable), executed during `/speckit-implement` under the before_implement hook.
