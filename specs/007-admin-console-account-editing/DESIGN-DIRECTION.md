# Design Direction — 007 Maintainer Admin Console & Staff-Authoritative Account Editing

Produced at planning time by `frontend-design-pro` (taste + impeccable + graphify). Absorb into
`plan.md`'s Design Direction section; the `before_implement` gate re-validates it and enforces the
build rules.

Scope note: this feature **extends the established surface** and adds **one new surface boundary**
(the maintainer console). Feature 004's `DESIGN-DIRECTION.md` remains the base and 005's narrowing
remains in force. Nothing here re-themes the app.

## Design Read

Reading this as **two surfaces with different audiences inside one product UI**, not one feature:

1. **The maintainer console** — an operator tool for one person who holds a shared key, is not an
   account, and is doing careful, low-frequency, consequential edits to the data that drives
   classification. Reads as a *control room*: sparse, explicit, unglamorous, obviously separate from
   the application it administers.
2. **Staff-authoritative profile editing, the owner's profile, and the account directory** — an
   extension of the existing staff/employee product UI, where the new idea is not a screen but a
   concept: **every profile field now has an author and a controller, and the interface has to make
   both legible without turning the page into a permissions console.**

Trust-first, evidence-first language, on the app's existing React + Vite + Tailwind idiom.

**Dials**: DESIGN_VARIANCE **3**, MOTION_INTENSITY **2**, VISUAL_DENSITY **6** (console and staff
surfaces) / **4** (owner's own profile).

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | 3 | Inherits 004/005. This is accountability-critical UI: who set a value, and who may change it. A clever layout costs viva credibility, and a mis-read lock is a real support failure. |
| MOTION_INTENSITY | 2 | Inherits 004/005. Feedback and state-transition only. A field changing hands between owner and staff must be noticed, never performed. |
| VISUAL_DENSITY | 6 / 4 | 6 for the category list, guide editor, directory, and staff profile view, all scan-many-rows surfaces. The owner's own profile stays at its existing lighter density: it is read by one person, once, under mild confusion. |

## Design system / stack decision

- This surface class (admin panel, directory, dense forms) sits outside landing-page conventions and
  is governed by product-UI criteria: consistent affordances, full interactive-state coverage.
- **No new design system package.** The constitution locks the stack to React + Vite + Tailwind. The
  conventional answer for an admin console would be Fluent/Carbon/Atlassian; that answer is
  overridden here. Extend the app's own components and Tailwind conventions.
- Icons stay **@phosphor-icons/react** — already the sole family, one family per project. No second
  family for "lock", "admin", or "history" glyphs.
- **No new dependency of any kind.** No form library, no date library, no table library, no diff
  viewer for field history. `frontend/package.json` has four runtime dependencies and NFR-7 keeps the
  demo machine's envelope for the local model. Field history is a list; a version history is a list.
- Note: this impeccable install ships no `reference/brand.md` or `reference/product.md` register
  files, and the project has no `PRODUCT.md`. Register guidance is therefore taken from the 004/005
  Design Directions, which already encode it for this product. Flagged, not blocking.

## Palette commitment

**Page Theme Lock**: single light theme, inherited, including the maintainer console. The console is
a separate surface, not a separate product — giving it a dark "admin" theme would be the most
tempting and least defensible decision in this feature. No dark mode is introduced.

Extend the existing semantic assignments, never redefine them:

| Meaning | Existing token family | New in 007 |
|---|---|---|
| Accent, links, primary action | `blue-600` / `blue-700` | Console sign-in, save, publish |
| Open, waiting, needs a decision | `amber` | Unchanged. **Not** used for locked fields |
| Resolved, succeeded, available | `green` / `emerald` | Unchanged |
| Failure, danger, destructive | `red` | Retire confirmation only; **not** conflict refusal, **not** locks |
| Closed, inert, neutral | `gray` | **Retired category**, **staff-controlled field**, **released field** |

Three load-bearing colour decisions:

- **A locked field is NOT a warning and MUST NOT be amber or red.** A staff-set field is the system
  working correctly: IT keeps the value accurate. Rendering it as a warning teaches the owner they
  did something wrong. Locked fields are neutral, with a plain sentence. This is the same reasoning
  that made a refusal neutral in 005.
- **A per-field conflict refusal is NOT an error state for the whole form.** It is one field
  reporting that the world moved. It is marked in place, on the field, in neutral-with-emphasis —
  never a red page-level banner, because in the same save two other fields succeeded.
- **Provenance is not a status, so it gets no colour.** "Set by Ayesha Khan, 12 March 14:20" is a
  byline, in muted text under the value. It is not a pill, not a chip, not a badge. `StatusBadge.tsx`
  stays the single source of ticket-status colour and MUST NOT absorb provenance or control state.

## Typography plan

- Existing app font stack (Tailwind default sans). No new webfont; the stack has no font pipeline and
  NFR-7 governs.
- **Tabular numerals mandatory** on: guide version numbers, step numbers, timestamps, field-history
  timestamps, and directory counts. A version history whose numbers shift horizontally reads broken.
- Category machine names (the snake_case slug) and remote access identifiers render in the **mono**
  face at `text-xs`/`text-sm`. The slug is an identifier, not prose.
- Provenance bylines are `text-xs` muted, one line, consistently formatted **everywhere the profile
  appears** — owner profile, staff profile, and the ticket-detail `ProfilePanel`. Same words, same
  order, same place. Three different phrasings of "who set this" is the failure mode here.
- Owner-facing copy follows NFR-2: plain, jargon-free, short sentences. The word "locked" is
  acceptable; "provenance", "authoritative", and "field control" are not owner-facing vocabulary.

## Layout strategy (per surface, not one generic grid)

### 1. Maintainer console shell (US1)

- Lives at its **own top-level route**, outside `AppLayout`, and therefore **without `AppNav`**. This
  is the structural expression of FR-015: the console cannot show tickets, accounts, or staff
  surfaces because it does not render the application's navigation at all.
- Its own minimal header: the product name, the words that identify this as maintainer
  administration, the signed-in maintainer's declared name, and a sign-out that discards the key from
  memory. Nothing else.
- **No link into the console from anywhere in the authenticated app**, and no link out of it into the
  app. `AppNav.tsx` MUST NOT gain a maintainer entry. Discovery is by URL, which matches how the
  capability is actually granted (a key handed to one person).
- The console is a **single-column working surface**, max-width bounded. It is not a sidebar-plus-
  content admin chrome; there are exactly two destinations (the category list, and one category),
  and a sidebar for two destinations is furniture.

### 2. Console sign-in and its three refusal states (US1, FR-002/004/005/034)

One form: key, then name. Both required before anything is shown. Three distinct outcomes, and
**conflating any two of them is a design failure**:

| State | Treatment |
|---|---|
| Wrong key | One fixed message. **No hint of proximity** — no length validation on the key, no character counter, no strength meter, no "key looks too short". Any wrong key produces the identical message. |
| Administration switched off | **The form is not rendered at all.** A plain statement that maintainer administration is not enabled on this system. Presenting a sign-in form that can never succeed is the specific failure FR-005 exists to prevent. |
| Cooling-off after repeated failures | Distinct message naming that attempts are paused and that it is temporary. The submit control is unavailable while it holds. It must not read as "wrong key" again, or the maintainer retypes a correct key and concludes it is wrong. |

- The key input is `type="password"`, `autocomplete="off"`, and is held in React state only.
  **Never `localStorage`, never `sessionStorage`, never a module-level default header** (FR-014).
  It is passed per request as an explicit argument. The shared `request()` in `services/api.ts` must
  not be taught about the maintainer key, or every ordinary app call becomes a place it can leak.
- The name field is labelled as attribution, not authentication, in one plain sentence. A maintainer
  who thinks the name is a login will pick a wrong one and mis-attribute every change they make.

### 3. Category list and category detail (US1, FR-006 to FR-013)

- **The list is the console's home.** One row per category showing display name, mono slug, mandated
  marker, retired marker, and active guide version. At density 6 this is a divided list, not a grid
  of cards — card-boxing every category is banned by the 004 direction and would be worse here.
- Retired categories stay in the list, visibly inert (neutral), not hidden. A retired category the
  maintainer cannot see is a category they will try to recreate.
- **Mandated categories show no retire action at all.** Not a disabled button, not a greyed control
  with a tooltip. Absence is the design, exactly as the 005 audit trail forbids a greyed delete. The
  permanence is stated once, as text on the category, per FR-012.
- Retiring a non-mandated category requires a confirmation that **states the consequence in advance**
  (existing tickets keep the category; future classification stops using it) before the action, not
  after. This is the only red control in the console.
- Version history is a list under the category: version number, author, timestamp, change note, and
  which is active. Steps for an older version open in place. **No revert, no restore, no edit
  affordance on a past version** — versions are immutable and the interface must not imply otherwise.

### 4. Guide step editor (US1, FR-013)

The densest new form, and the one most likely to be built badly.

- Steps are an **ordered, numbered vertical list**, each step one block with its instruction and its
  success hint, both labelled. Add, remove, and reorder act on the list.
- **Validation is anchored to the offending step and field, inline** — "Step 3 needs a success hint"
  rendered at step 3, not a summary at the top of the form. FR-013 names the specific step and field,
  and a top-of-form error list forces the maintainer to count rows to find it.
- Limits (step count, field lengths) are stated **before** the maintainer hits them, on the fieldset,
  not discovered by rejection.
- The change note is optional and labelled as such, positioned at the point of publishing, not at the
  top of the form where it reads as required.
- **Publishing is a deliberate act with a preceding summary**: what will change, and that it becomes
  the active version immediately. A guide version drives what real users are told to do.
- Label above input, helper text present, error below input. **No placeholder-as-label** (004 ban).

### 5. Staff profile editing — the authoritative surface (US2)

This replaces the append-a-note arrangement in `UserProfilePage.tsx`. The page now carries four
distinct things and **must keep them visually separate**:

1. **The three support fields**, each editable, each with its provenance byline and its control state.
2. **Field history**, staff-only.
3. **Existing staff notes and pre-feature corrections**, preserved verbatim (FR-025).
4. **Credentials**, unchanged.

Rules:

- **A value is a value.** The old two-column "user said X / staff corrected to Y" reading is gone for
  fields staff have set. What is saved is what is shown, everywhere.
- **Pre-feature corrections MUST NOT be rendered as, next to, or above the field value** in a way
  that suggests they are the value. They stay in the notes region, labelled as notes, with the field
  they referenced named. FR-025 is explicit that they are not values, not history, and confer no
  control. The interface must not quietly promote them.
- **Provenance byline on every field**: who set it and when, in the shared one-line format. Present
  even when the owner set it — "who set this" with a gap for owner-set fields would read as unknown.
- **The remote access list is one field.** Its byline, its control state, its lock, and its release
  sit on the **fieldset**, not on each entry. Putting "set by" on individual entries contradicts the
  clarified collection-level model and will mislead staff into thinking entries lock separately.
  Individual entries are still added and removed freely within the field.
- **Lock and release are one control per field, stated in words.** Not an icon alone, not a toggle
  switch. Taking control happens implicitly by saving a value; releasing is explicit. The release
  control **does not exist** on a field no staff member ever set — absent, not disabled (the spec's
  edge case calls for exactly this).
- **Field history is a per-field disclosure, collapsed by default** — previous values, authors,
  timestamps, and every transfer of control, newest first. Collapsed because it is unbounded and the
  page is a working surface, not an archive.
- **Per-field conflict refusal is rendered per field.** After a partial save the succeeded fields show
  their saved values confirmed, and only the refused field is marked, in place, naming what it now
  holds, who set it, and that the staff member's attempted value was not applied — with their typed
  value still present so it is not lost. **No page-level "save failed"** when part of the save
  succeeded: that is a lie about what the server did, and it is the single most likely bug in this
  feature.
- The page must survive the 500-line rule. `UserProfilePage.tsx` is already 7.4K and gains four
  behaviours. **Extract before adding**: a profile-field component owning value, byline, control
  state, history disclosure, and conflict state, used by the staff page; and the field-history list.
- Staff editing their own profile through this surface is permitted and looks identical. No special
  case, no self-edit warning.

### 6. The owner's own profile (US2, FR-020/021/022, SC-009)

`ProfilePage.tsx` currently assumes every field is the owner's to edit. That assumption is what this
feature breaks, and it is the surface with the highest UX regression risk in the feature.

- **A staff-controlled field renders as read-only text, never as a disabled input.** FR-022 forbids
  presenting an input that silently does nothing. A `disabled` input still looks like a form control
  the owner failed to use. Text plus byline plus one plain sentence.
- **The explanation sits on the field**, not in a page banner, because control is per field and a
  banner cannot say which. One sentence, plain: IT staff keep this one up to date, and ask them if it
  is wrong. SC-009 requires the owner to explain the lock unaided; a page-level notice will not
  achieve that.
- **Fields the owner still controls look and behave exactly as they do today.** Unchanged inputs,
  unchanged save. The visual difference between a self-service field and a staff-set one must be
  legible at a glance and must not make the editable ones look degraded.
- **Field history does not exist on this page.** No collapsed section, no disabled control, no "ask
  staff to see history". FR-018 makes it staff-only, and absence is the design.
- **The all-locked profile is a designed state** (spec edge case). When every field is staff-set, the
  page is entirely read-only and must still say what the page is for and how to get a value
  corrected. Without this it reads as a broken form with a missing save button.
- The owner's save must handle a field locked after the page opened: refused with an explanation, on
  the field, and the page re-reads the current state rather than leaving a stale editable input.
- Existing staff notes stay visible to the owner exactly as they are today.

### 7. Account directory (US3)

- A staff destination reached from the dashboard, listed in `AppNav` beside the existing staff links.
- **A list of people, not a table of records**: display name, email, role, one row each, at density 6
  with dividers. It shows nothing not already visible to staff elsewhere (NFR-5).
- One search input narrowing on name or email as it is typed. No filter panel, no column sorting, no
  bulk selection — bulk editing is explicitly out of scope and a checkbox column would imply it.
- **Three designed states**: populated, no accounts yet, and no match for this search. "No match" must
  name the search term and offer to clear it; an empty list under a filled search box reads as a
  broken directory.
- Selecting a row opens that account's profile. An account with no profile yet opens an **empty,
  editable profile**, not an error (spec edge case).
- Non-staff access uses the existing `RouteGuards.tsx` denied treatment. **No bespoke refusal screen.**

## Motion plan

- Feedback and state-transition only, per MOTION_INTENSITY 2.
- Permitted: the field-history disclosure expand, the guide-step add and remove, and a brief highlight
  when a field's control changes hands or a save lands.
- **Never animate a field's lock or release in a way that could read as the value changing.** Control
  changed; the value did not.
- No scroll choreography, no pinning, no loops, no skeleton shimmer on a four-field form.
- Everything respects `prefers-reduced-motion` using the existing `motion-reduce:` convention.

## Banned for this feature

Inherited from 004 and 005 and still binding: em-dashes anywhere in UI copy; glassmorphism; gradient
text; decorative dots except where they carry real semantic state; hand-rolled SVG icons;
placeholder-as-label; card-boxing every data group at density 6; "Jane Doe" style fake data in
screenshots; mixing a second icon family; no new theme, accent, radius system, or font.

New for 007:

- **No dark theme, no separate visual identity, and no alternate accent for the maintainer console.**
  Separation is structural (its own route, no `AppNav`), not chromatic.
- **No link to the maintainer console from `AppNav` or any authenticated page.**
- **No maintainer key in `localStorage`, `sessionStorage`, a cookie, a URL, or a module-level default
  header.** React state only, passed per request.
- **No feedback that narrows the key** — no length validation, no character counter, no strength
  meter, no distinct message for a malformed versus wrong key.
- **No sign-in form rendered when administration is switched off.**
- **No disabled retire button on a mandated category**, and no revert, restore, or edit affordance on
  a past guide version.
- **No `disabled` input for a staff-controlled field on the owner's profile.** Read-only text only.
- **No amber or red for a locked field.** A lock is not a warning.
- **No page-level error banner for a per-field save conflict**, and no discarding of the staff
  member's typed value when one field is refused.
- **No provenance rendered as a coloured badge or pill**, and no provenance cases added to
  `StatusBadge.tsx`.
- **No per-entry provenance, lock, or release on remote access entries.** The list is one field.
- **No promotion of a pre-feature staff correction into a field value or into field history.**
- **No field-history affordance on the owner's profile**, visible, collapsed, or disabled.
- **No optimistic UI on a save, a lock, or a release.** Nothing renders as saved, locked, or released
  until the server says so. Control over another person's record is not a place for a hopeful local
  update.
- **No bulk-selection affordance in the directory**, including a disabled one.
- **No new frontend dependency.**

## Affected shared components and regression risk (graphify)

Derived from `graphify query "staff dashboard frontend pages, profile view components, routing and
layout"` against `graphify-out/graph.json`, plus direct reads of the profile surfaces.

| Component / module | Shared with | Risk |
|---|---|---|
| `frontend/src/lib/types.ts` | Every page | `SupportProfile` / `SupportProfileView` gain provenance, control state, and history. Highest blast radius in the feature: `ProfilePage`, `UserProfilePage`, `ProfilePanel`, `TicketDetailPage`, and the API client all consume these types. |
| `frontend/src/services/api.ts` | Every page | New profile, history, lock/release, directory, and console endpoints. **Specific risk: the maintainer key must not enter the shared `request()` helper**, which sends `credentials: "include"` on every app call. Console calls need their own thin caller that takes the key as an argument. |
| `frontend/src/pages/ProfilePage.tsx` | Employee | Becomes provenance-aware and partially read-only. Currently one dense JSX expression and must be restructured to do this. Highest UX regression risk: this is the page an ordinary user sees, and a wrong lock reading turns a working form into an apparently broken one. |
| `frontend/src/pages/staff/UserProfilePage.tsx` | Staff | Largest single change. Gains authoritative editing, per-field history, lock/release, and per-field conflict handling while keeping notes and credentials. Will breach the 500-line rule without extraction. |
| `frontend/src/components/ProfilePanel.tsx` | `TicketDetailPage` | Renders the reporter profile at escalation time. **If it is not updated it will show a stale or unattributed value beside an authoritative one elsewhere**, which is precisely the two-competing-values problem this feature exists to remove. Easy to miss because the spec talks about profile pages. |
| `frontend/src/App.tsx` | Whole app | Console route mounted **outside** `AppLayout`; directory route inside `RequireStaff`. Getting the console inside `AppLayout` would render `AppNav` in it and breach FR-015. |
| `frontend/src/components/AppNav.tsx` | Whole app | Gains the directory link for staff. MUST NOT gain a maintainer link. |
| `frontend/src/components/RouteGuards.tsx` | Whole app | Guards the directory and staff profile routes. The console is guarded by the key, not by `RequireStaff` — it is not an account and must not be wired through the auth context. |
| `frontend/src/components/StatusBadge.tsx` | Chat + dashboard | Must NOT absorb provenance or field-control state. Ticket status stays its own vocabulary. |
| `frontend/src/pages/TicketDetailPage.tsx` | Staff | Consumes `ProfilePanel`; already the largest page at 9.6K. |
| `frontend/tests/pages/auth.test.tsx` | Auth flow | Route and guard changes can regress it; must stay green. |
| `backend/src/api/routes/admin-guides.ts`, `middleware/maintainer-auth.ts` | Console | The console is a client for the existing maintainer API. Throttling (FR-034) and refused-attempt recording (FR-035) are new backend behaviour; the console must render, not invent, that state. |

Run `graphify update .` after implementation edits.

## Planned build sequence

`craft → critique → layout → colorize → typeset → polish → audit`, executed at implementation time
under the `before_implement` gate, then the Final Pre-Flight Check, then the mechanical detector over
the changed frontend files:

```
node "C:\Users\tahaf\.claude\skills\impeccable\scripts\detect.mjs" --json <changed frontend files>
```

No data-visualisation work in this feature, so those conventions do not apply.

## Open decisions a builder must not invent

- **The exact provenance sentence and the exact locked-field sentence.** Both are required strings
  appearing on three surfaces, and SC-009 is measured on the second one. Write them once, in one
  place, and reuse. Do not let each page phrase it differently.
- **What the cooling-off message says about duration.** The threshold and duration are backend
  policy; the console renders what the server reports and must not hardcode a number into copy that
  then disagrees with behaviour.
