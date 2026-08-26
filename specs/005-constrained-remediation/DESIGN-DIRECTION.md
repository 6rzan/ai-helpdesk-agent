# Design Direction — 005 Constrained Automated Remediation

Produced at planning time. Absorb into `plan.md`'s Design Direction section; the pre-implementation gate re-validates it and enforces the build rules.

Scope note: this feature is an **extension of the established surface**, not a new one. Feature 004's `DESIGN-DIRECTION.md` remains in force; everything below either inherits from it or narrows it. Nothing here re-themes the app.

## Design Read

Reading this as: a **safety and oversight layer added to an existing internal IT product UI**, for two audiences at once. IT staff authorising and auditing machine actions under time pressure, and an ordinary employee in chat being asked to consent to something a machine will do to a computer. Trust-first, evidence-first language, leaning on the app's existing React + Vite + Tailwind idiom.

**Dials**: DESIGN_VARIANCE **3**, MOTION_INTENSITY **2**, VISUAL_DENSITY **6**.

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | 3 | Inherits 004's value. This is regulated-adjacent, accountability-critical UI. Predictability is the feature. A clever layout here costs viva credibility. |
| MOTION_INTENSITY | 2 | Inherits 004. Feedback and state-transition only. An action moving from pending to executed must be noticed, never performed. |
| VISUAL_DENSITY | 6 | Inherits 004 for the staff surfaces (approval queue, audit view, metrics are all scan-many-rows). The employee chat side stays at the chat page's existing lighter density. |

## Design system / stack decision

- **This surface class sits outside landing-page design conventions**: dashboards, dense product UI, admin panels, and data tables are governed by the product register instead. The conventional answer for this class would be a design-system package — Fluent, Carbon, Atlassian, or Polaris.
- **That answer is overridden by the constitution**, which locks the stack to React + Vite + Tailwind and forbids adding a design-system package on this project. So: no new design system. Extend the app's own components and Tailwind conventions, and take the *process* and critique criteria from the product register instead.
- Build-time steps follow the refinement sequence: craft → critique → layout → colorize → typeset → polish → audit.
- Icons stay **@phosphor-icons/react** (already the sole family — one family per project). Standardise weight globally; do not introduce a second family for "action" or "security" glyphs.
- **No new charting library** for the metrics surface (US5). See "Metrics surface" below.

## Palette commitment

**Page Theme Lock**: single light theme, inherited. No dark mode is introduced by this feature, and no surface flips theme. The app has no dark tokens today, and adding a half-implemented one on a safety surface is worse than not having it.

The existing accent and semantic assignments are the single source of truth. Extend, never redefine:

| Meaning | Existing token family | New in 005 |
|---|---|---|
| Accent, links, primary action | `blue-600` / `blue-700` | Approve action uses the accent, not green |
| Open, waiting, needs a decision | `amber` | **Pending approval** joins this family |
| Resolved, succeeded, available | `green` / `emerald` | **Executed successfully** joins this family |
| Failure, danger, destructive | `red` | **Execution failed**, and the kill-switch confirm |
| Staff involved, escalated | `purple` | Unchanged. Escalations raised by refusal or failure reuse it exactly |
| Closed, inert, neutral | `gray` | **Refused**, **declined**, **expired** |

**Load-bearing decision: a refusal is NOT an error, and MUST NOT be red.** Refusing an out-of-whitelist request is the system working correctly (Principle II, US2). Rendering it in the failure colour teaches staff and markers the opposite of the truth. Refusals are neutral-grey records with a plain reason. Red is reserved for an approved action that ran and failed.

**Second decision: read-only vs state-changing is never carried by colour alone.** It gets an icon plus a written label on every action record, because it is the distinction the whole authorisation tier rests on and it must survive greyscale printing into the Chapter 4 report.

`StatusBadge.tsx` stays the single source of ticket-status colour. Action outcome is a **separate** vocabulary in a new sibling component, not new cases bolted into `StatusBadge`.

## Typography plan

- Existing app font stack (Tailwind default sans, no custom families). No new webfont; NFR-7 keeps the demo machine light and the stack has no font pipeline.
- **Tabular numerals mandatory** on: metric values, counts, durations, action ages, and timestamps. Metrics that jump horizontally as the period changes read as broken.
- Command strings and endpoint identifiers render in the **mono** face at `text-xs`/`text-sm`, always as inert text. They are evidence, never an input, never a copyable "run this" affordance.
- Body copy for the employee follows NFR-2: plain, jargon-free, short sentences. The exact command is shown to staff; the employee gets the plain-language description plus the option to see the exact command.

## Layout strategy (per surface, not one generic grid)

### 1. Approval queue (staff dashboard, US4)

A **decision queue**, not another ticket list. It is the highest-urgency thing on the dashboard and must not be a tab that a busy staff member never opens.

- Entry point: a persistent count indicator in the dashboard header when the queue is non-empty. This is the one place a semantic dot is permitted (dots are allowed only when they carry real state).
- Each row carries, in reading order: what the action does in plain words, the exact command in mono, the target endpoint, the ticket reference, the reporter's recorded consent, and the age.
- Two decisions per row (Approve, Decline), side by side, accent for approve and neutral-outline for decline. **Decline must not be red.** Declining is a legitimate routine outcome, not a destructive one.
- Approving requires a confirmation step that restates the exact command and target. This is the human-oversight moment NFR-4 exists for, and a single misclick must not be able to change a machine's state.
- Empty state is a first-class design, not an afterthought: "Nothing is waiting on you" reads as a good outcome, not as a missing feature.

### 2. Action record (the reusable atom, US1/US3/US4)

One component renders an executed or refused action **everywhere** it appears: in the employee chat, in the ticket history, in the approval queue detail, and in the audit view. Density and disclosure vary by surface; the facts and their order do not.

Canonical field order, fixed across surfaces: timestamp, actor, classified intent, read-only or state-changing, exact command, target endpoint, authorisation (reporter consent and staff approver), outcome, and observed output.

Observed command output is **collapsed by default and expandable**. It is unbounded machine text on a page designed for scanning.

This atom is what makes the audit trail defensible in the viva: one component, one field order, one place to point at.

### 3. Audit view (staff, US4)

- A filterable list over the action-record atom, filtered by ticket, endpoint, and outcome, over the whole system.
- **Append-only must be visible, not merely true.** No edit affordance, no delete affordance, no row-level overflow menu anywhere in this view. The absence of controls is the design. Do not add a kebab menu "for consistency with other tables".
- Both executed and refused actions appear in the same list by default, because the pairing is the evidence. Filtering to one or the other is a user choice, never the default view.
- Per-ticket actions appear inside the existing ticket history timeline, interleaved with the existing conversation, guided steps, and staff-action trail. **Do not build a second parallel timeline** on the ticket page and do not duplicate the existing staff-action entries.
- Non-staff access is refused with the app's existing denied-access treatment (`RouteGuards.tsx`), not a bespoke one.

### 4. Remediation kill switch (staff, US4)

- Lives in staff settings, not in the queue, because it is a posture change rather than a per-case decision. Global toggle plus per-endpoint toggles.
- Turning remediation **off** is one click. Turning it back **on** requires confirmation. The asymmetry is deliberate: the safe direction should be frictionless.
- While remediation is disabled, a persistent, non-dismissible banner states so on the staff dashboard and the queue. A disabled safety system that looks identical to an enabled one is the failure mode worth designing against.
- The employee-facing consequence is a plain sentence in chat, not a silent absence of the offer.

### 5. Metrics surface (staff, US5)

- Placement: on the dashboard **alongside** tickets, per IR §1.5 wording, as a summary band above or beside the ticket list. Not a separate destination that has to be discovered.
- Composition: a small row of **stat tiles** (volume, handled without a human, escalation rate, action outcomes, median time to resolve), then **category and status splits** as labelled horizontal bar rows, then the automated-action outcome breakdown reusing the same outcome vocabulary and colours as the audit view.
- Period selector is a small, explicit control; figures update in place without a manual reload (US5 AS2).
- **No-data state is designed and worded** ("Nothing recorded in this period"), never a zero-filled frame that looks like real measurement (US5 AS3). This one matters for academic honesty as much as for UX.
- **Dependency decision: no chart library is added.** `frontend/package.json` currently has no charting dependency, and a charting dependency must never be assumed. The metric set here is counts, rates, splits, and durations, all of which read better as tiles and bar rows than as chart widgets, and every added megabyte competes with the local model for the demo machine's envelope (NFR-7). Bars are CSS width on a labelled row, backed by real text values, so they stay accessible and screenshot well for Chapter 4. **Escape hatch**: if a genuine time-series trend line is later judged necessary, that is a plan amendment with an explicit dependency decision, not an in-flight import.
- Charts, bars, and tiles are still visualisations: apply the project's data-visualisation conventions before writing any of that code.

### 6. In-chat consent and reporting (employee, US1/US3)

- **Consent is not a quick reply.** `QuickReplies.tsx` is a casual pill row for "That worked" / "Didn't work". Consenting to a machine changing a computer's state must not share that affordance or that visual weight. Consent gets a distinct, bounded consent block stating in plain words what will be done, to what, and that it is a test endpoint.
- Read-only diagnostics ask for consent inline and report the result in plain language, with the raw output available behind a disclosure.
- State-changing actions show a clear three-stage state in chat: waiting on your consent, waiting on IT staff, then done or failed. The employee must never be left unsure which of those is true (FR-6 applies to this the same as to ticket status).
- The password/login case carries a **mandatory explicit sentence** that this applied to the test account on the test endpoint and not to any organisational directory (US3 AS7). This is a required string, not optional reassurance copy.
- Failure and refusal are reported honestly and immediately, paired with the escalation offer. No silent retry, no optimistic wording.
- Reuse `EscalationNotice.tsx` for the escalation that follows a refusal or a failure. Do not invent a second escalation notice.

## Motion plan

- Feedback and state-transition only, per MOTION_INTENSITY 2. Permitted: a brief highlight when a queue row resolves or an action record lands, and the disclosure expand for command output.
- No scroll choreography, no pinning, no loops, no counting-up number animations on the metrics tiles. An animated metric is a metric you cannot read.
- Everything respects `prefers-reduced-motion`, following the existing `motion-reduce:` convention already used in `QuickReplies.tsx`.
- **Never animate an authorisation state change in a way that could be mistaken for the action itself running.** A pending row must not look like a progress bar.

## Banned for this feature (union of both skills, plus project and feature-specific)

Inherited from 004 and still binding: em-dashes anywhere in UI copy; glassmorphism; gradient text; decorative dots except where they carry real semantic state; hand-rolled SVG icons; placeholder-as-label; card-boxing every data group at this density; "Jane Doe" style fake data in screenshots; mixing a second icon family.

New for 005:

- **No red for refusals or declines.** Red means an approved action ran and failed. Nothing else.
- **No edit, delete, or overflow-menu affordance anywhere in the audit trail**, on any surface, including disabled ones. A greyed-out delete button implies a path exists.
- **No copy-to-clipboard or re-run affordance on command strings.** Commands are evidence in this UI, never an input.
- **No progress bars with filled tracks** on the metrics surface. Labelled bar rows with real values instead.
- **No counting-up or animated numerals** on metric tiles.
- **No second timeline** on the ticket detail page, and no duplication of the existing staff-action trail.
- **No consent styled as a quick reply**, and no consent buried inside an ordinary agent message bubble.
- **No optimistic UI on any authorisation or execution state.** Nothing renders as approved, running, or done until the server says so. This is the one place where a hopeful local state update would be a safety lie.
- **No new theme, accent, radius system, or font.** Page Theme Lock and Shape Consistency Lock apply across the whole app, not per feature.
- **No em-dash** in any of the new required strings, including the test-account disclosure sentence and the no-data message.

## Affected shared components and regression risk (graphify)

Derived from `graphify query "staff dashboard pages components layout styling"` against `graphify-out/graph.json`.

| Component / module | Shared with | Risk |
|---|---|---|
| `frontend/src/lib/types.ts` | Every page | New action, approval, endpoint, and metrics types touch all consumers. Highest blast radius. |
| `frontend/src/services/api.ts` | Every page | New endpoints for queue, audit, kill switch, metrics all route through `request()`. |
| `frontend/src/services/useEvents.ts` | Chat + staff streams | Live approval and execution updates need new SSE event types in both `EventHandlers` and `StaffEventHandlers`. Breaking either breaks live ticket updates that already ship. |
| `frontend/src/pages/DashboardPage.tsx` | Staff dashboard | Gains the approval queue entry point and the metrics band. Already 9.3K and near the density ceiling; extract rather than inflate (500-line rule). |
| `frontend/src/pages/TicketDetailPage.tsx` | Staff + ticket view | Gains action records in the existing history. Already 13.3K, the largest page in the app. Extract the timeline before adding to it. |
| `frontend/src/pages/ChatPage.tsx` | Employee chat | Gains consent blocks and action reporting. Guarded by `ChatPage.test.tsx` and `ChatPage.guidance.test.tsx`; both must stay green. |
| `frontend/src/components/StatusBadge.tsx` | Chat + dashboard | Must NOT absorb action-outcome states. Keep ticket status and action outcome as separate vocabularies. |
| `frontend/src/components/EscalationNotice.tsx` | Chat | Reused for refusal and failure escalations. Extending its props can regress the existing escalation path. |
| `frontend/src/components/QuickReplies.tsx` | Chat | Explicitly NOT the consent affordance. Risk is drift toward reusing it for convenience. |
| `frontend/src/components/RouteGuards.tsx` | Whole app | Audit, queue, kill switch, and metrics are all staff-only routes. |
| `frontend/src/App.tsx` | Whole app | New staff routes. |

Run `graphify update .` after implementation edits.

## Planned build sequence

`craft → critique → layout → colorize → typeset → polish → audit`, executed at implementation time under the pre-implementation gate, then the Final Pre-Flight Check, then the mechanical detector run over the changed frontend files.

Apply the data-visualisation conventions before writing the metrics surface. Nothing new is needed for the other surfaces.

## Housekeeping flagged, not fixed

`frontend/` contains stray zero-byte files from mis-redirected shell commands: `draft.length`, `m.author`, `m.text.includes(ticket.reference)`, `{,`, `{,+`. They are untracked noise in the frontend root and should be removed before the next commit. Not touched by this hook run.
