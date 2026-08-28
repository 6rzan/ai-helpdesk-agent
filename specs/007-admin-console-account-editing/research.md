# Research: Maintainer Admin Console & Staff-Authoritative Account Editing

**Feature**: `007-admin-console-account-editing` | **Date**: 2026-08-28

Phase 0 output. Every `NEEDS CLARIFICATION` from the Technical Context is resolved below. The spec
was already clarified on five behavioural questions (2026-08-28 session); this document resolves the
*technical* choices those answers imply, and records the two governance actions the spec's Risks
section raises.

---

## R1. Console address and shell placement

**Decision**: The console lives at the SPA route **`/maintainer`**, mounted in `App.tsx` **outside**
the `AppLayout` element so it renders without `AppNav`. Its API calls go to a new
**`/api/maintainer/*`** namespace that re-exposes the existing `adminGuidesRouter` handlers.

**Rationale**:

- FR-001 requires "its own address, separate from the employee and staff areas". A route outside
  `AppLayout` is the strongest available form of that: the console cannot show tickets, accounts, or
  staff navigation because it never renders the application's nav element. FR-015 becomes a
  structural property rather than a discipline.
- The word **maintainer**, not **admin**, is deliberate. Constitution Principle III locks the account
  model to exactly two roles and states "There is no admin role and no third role." A route called
  `/admin` invites the reading that an admin role exists, and that reading is the single most likely
  way this feature gets misdescribed in the report and the viva.
- The existing backend router is already mounted at an admin path and is conditionally mounted on
  `MAINTAINER_KEY` being set. Renaming or re-namespacing the backend path is optional; the frontend
  path is what the maintainer sees and is what FR-001 constrains.

**Alternatives considered**:

- *A separate Vite application under `admin/`*: rejected. The spec's own assumption states both
  surfaces "live inside the existing web application" and reuse its navigation, guarding, and session
  handling. A second build target adds a second dev server, a second deploy step, and a second place
  for the demo to break, against NFR-7 and the Principle IV release gate.
- *A modal or tab inside the staff dashboard*: rejected outright. It would put maintainer
  administration behind a staff session, which contradicts Principle III (the maintainer key is "on a
  different axis entirely — not an account, not a session") and FR-015.
- *`/admin`*: rejected for the role-vocabulary reason above.

---

## R2. Discovering whether administration is enabled, before any key is typed

**Decision**: Add **`GET /api/maintainer/status`**, mounted unconditionally and requiring no
authentication, returning `{ "enabled": true | false }`. The console calls it on load and renders
either the sign-in form or the "administration is switched off" statement.

**Rationale**:

- FR-005 requires the switched-off message be distinct from the wrong-key message, and the Design
  Direction forbids rendering a sign-in form that can never succeed. Both need the console to know
  the answer *before* a key is submitted.
- Today `adminGuidesRouter` is mounted only when `MAINTAINER_KEY` is set, so the routes 404 when
  administration is off. A 404 is indistinguishable from a typo'd URL and from a wrong key on some
  paths, which is exactly the conflation FR-005 exists to prevent.
- Disclosure is analysed and accepted: the response reveals only whether a feature is switched on. It
  reveals no key, no key length, no data, and no account. It is the same class of fact as the
  existing `/api/health` surface. NFR-5 concerns stored personal data and role-restricted records;
  neither is touched.

**Alternatives considered**:

- *Infer from a 404 on the categories endpoint*: rejected. Ambiguous, and it requires the maintainer
  to submit a key to learn the feature is off, which is the FR-005 failure.
- *A build-time flag baked into the frontend*: rejected. The spec's edge case requires the console to
  behave correctly when administration is switched off **while the console is open**, which a
  build-time constant cannot express.

---

## R3. Maintainer key handling in the browser

**Decision**: The key is held in React state inside the console's own provider, passed **per request**
as an explicit argument to a dedicated `maintainerRequest(key, name, path, init)` helper that lives
beside — never inside — the shared `request()` in `services/api.ts`.

**Rationale**:

- FR-014 forbids persistent browser storage and requires re-entry on reload. React state satisfies
  this by construction: a reload discards it with no cleanup code to forget.
- The shared `request()` sets `credentials: "include"` on every call. Teaching it about a maintainer
  key would put the key one default-header mistake away from every ordinary application request. A
  separate caller means there is no code path by which an app request can carry the key.
- The maintainer name travels with the key on every request because the existing
  `maintainer-auth.ts` middleware requires `x-maintainer-name` per request and uses it for
  attribution (FR-003). There is no session to hold it.

**Alternatives considered**:

- *`sessionStorage`, so a refresh does not lose the key*: rejected by FR-014, and the spec records the
  trade as deliberate ("accepted as the safer trade against the convenience of staying signed in").
- *A short-lived server-issued token exchanged for the key*: rejected. That is a session, which
  Principle III and the spec's Out of Scope both forbid for the maintainer.

---

## R4. Sign-in throttling and refused-attempt records

**Decision**: A new append-only collection **`MaintainerSignInAttempt`** storing
`{ clientKey, at, outcome: "refused" }`, indexed on `{ clientKey, at }`. The consecutive-failure count
is **derived by querying that collection**, not held in a separate counter. `clientKey` is a hash of
`req.ip`. Threshold and cooling-off duration are configuration values with committed defaults, and
the API reports the remaining cooling-off period so the console renders the server's number rather
than a hardcoded one.

**Rationale**:

- FR-035 requires every refused attempt be recorded with its timestamp and **never** the supplied key.
  Storing only `{clientKey, at, outcome}` makes recording the key structurally impossible: there is no
  field for it.
- Deriving the count from the same records that satisfy FR-035 avoids two sources of truth. An
  in-memory counter that disagrees with the persisted record is a defect that only appears after a
  restart, which is exactly when a demo runs.
- One collection also gives SC-011 its evidence directly ("every refused attempt is retrievable from
  the record afterwards with no supplied key stored") — a query, not an inference from logs.
- The IP is hashed rather than stored raw: it is not needed in readable form to group attempts, and
  NFR-5's data-minimisation applies to any collected identifier.

**Known limitation, recorded honestly**: `req.ip` groups everyone behind one NAT as one client. On the
single-machine demo environment (NFR-7, NFR-3) this is not a practical concern, and no better client
identity exists for an unauthenticated surface that must not set a cookie. The limitation belongs in
the report rather than in a workaround.

**Alternatives considered**:

- *In-memory rate limiter (e.g. a `Map` keyed by IP)*: rejected. It satisfies the throttle but not
  FR-035's durable record, and it would need a second write path to the record anyway.
- *Reusing `StaffActionRecord`*: rejected. That collection is for staff actions attributed to a staff
  account; a maintainer is not an account, and mixing them corrupts the meaning of the staff action
  record that Principle III and 004's FR-008 rely on.
- *A cookie-based client identifier*: rejected. Setting a cookie on an unauthenticated refusal path
  creates state for an attacker to clear, and the console deliberately holds no session.

---

## R5. Field provenance and control: authorship and control are separate

**Decision**: Each of the three fields carries
`{ setBy: { kind: "owner" | "staff", accountId, displayName }, setAt, controlledBy: "owner" | "staff" }`.
Releasing a field sets `controlledBy: "owner"` and **leaves `setBy` and `setAt` unchanged**.

**Rationale**:

- This is the one modelling decision the acceptance scenarios force. AS10 requires that after a
  release the owner can edit the field again, while FR-017 requires the field still show who last set
  it. If control were derived from `setBy.kind`, a release would have to falsify authorship — the
  staff member who set the value would stop being named as its author.
- It also makes the spec's "set, release, set again" edge case expressible: each transition is a
  `controlledBy` change recorded in history, and control ends wherever the last transition left it,
  independently of who wrote the current value.
- FR-024's "records the owner as its author" is then just an owner write setting
  `setBy.kind = "owner"`, with `controlledBy` already `"owner"`.

**Alternatives considered**:

- *Derive control from the author (`setBy.kind === "staff"` ⇒ locked)*: rejected for the reason above;
  it cannot represent a released field without lying about authorship.
- *A per-profile lock*: rejected by the spec's assumption that control is per field, and it would lock
  an owner out of fields nobody ever corrected.

---

## R6. Where field history lives

**Decision**: A separate append-only collection **`ProfileFieldHistory`**, one document per change,
`{ accountId, field, previousValue, previousSetBy, previousSetAt, changeKind: "value" | "control",
newControlledBy, actor: { kind, accountId, displayName }, at }`, indexed on `{ accountId, field, at }`.

**Rationale**:

- FR-018 requires **every** previous value be retained, with no cap. An unbounded array embedded in
  the profile document would grow toward MongoDB's 16 MB document limit and would be loaded on every
  profile read, including the owner's read and the ticket-detail `ProfilePanel` read — two surfaces
  that must never receive it (FR-018 makes history staff-only).
- A separate collection makes the staff-only rule a **routing** property: the owner's endpoint simply
  never queries it. Field-level projection on a shared document is a rule that one careless `view()`
  change can break, and `profile-service.ts` already funnels every read through one `view()` helper.
- It matches the existing `StaffActionRecord` pattern, so the codebase gains no new persistence idiom.
- Control transfers and value changes live in the same collection because FR-023 requires a release be
  "recorded in the field's history like any other change", and the spec's edge case requires the
  set/release/set sequence to read as distinct ordered entries.

**Alternatives considered**:

- *Embedded array on `SupportProfile`*: rejected on unbounded growth and on the leak risk above.
- *Deriving history from `StaffActionRecord`*: rejected. That record captures that a staff action
  occurred, not the previous value, and it has no entry for an owner's own edit, which FR-018 requires
  history to cover.

---

## R7. Per-field concurrency detection

**Decision**: Optimistic concurrency **per field, keyed on that field's `setAt`**. The client sends,
for each field it is changing, the `setAt` it loaded (`null` for a field never set). The server
applies a field only if the stored `setAt` still equals the submitted one; otherwise that field alone
is refused. The response reports each field's outcome independently.

**Rationale**:

- The clarification is explicit: detection is per field, and "edits to fields nobody else touched save
  normally" (FR-029). A whole-document version would refuse the entire save, which the clarification
  rejects.
- `setAt` already has to exist for FR-017. Reusing it as the concurrency token means no second version
  counter to keep in step with it — a counter and a timestamp that can disagree is a defect waiting
  for a demo.
- `null` as the baseline for a never-set field handles the race where two staff members both set a
  previously empty field: the second submits `null`, the stored value is no longer `null`, and the
  second is refused with the first named. Without this the "empty field" case would silently
  last-write-wins.

**Response shape consequence**: the save endpoint returns a **per-field outcome map**, not a single
status. A `200` with two applied fields and one refused is the normal, expected case. The Design
Direction bans rendering that as a page-level failure.

**Alternatives considered**:

- *Document-level `__v` or `updatedAt`*: rejected — refuses the whole save, contradicting FR-029.
- *A three-way merge or diff UI*: rejected as far beyond the spec, which asks only that the conflict
  be named.

---

## R8. Existing profiles: no backfill

**Decision**: **No migration script.** Profiles stored before this feature have no provenance
sub-documents. On read, a missing provenance is presented as
`{ setBy: { kind: "owner" }, setAt: null, controlledBy: "owner" }`, with the interface showing the
value as owner-held and unattributed rather than inventing an author.

**Rationale**:

- The spec's assumption is that "every profile starts under owner control" and "existing profiles are
  not locked wholesale when this feature ships". Lazy defaults satisfy that with no write.
- A backfill would have to invent an author name and a timestamp for values whose real author and time
  were never recorded. Fabricating provenance in a feature whose entire purpose is trustworthy
  provenance is self-defeating, and it would be indefensible in the viva.
- Nothing is lost: the first time anyone sets a field, real provenance is written.

**Consequence for the UI**: the provenance byline needs a designed state for "no recorded author",
distinct from "set by the owner at a known time". This is the one provenance case the Design
Direction's single byline format must also cover.

---

## R9. Coexistence with feature 004's FR-012 (the never-overwrite rule)

**Decision**: 004's FR-012 is **narrowed, not deleted**, and the narrowing is recorded in 004's spec
rather than left implicit. The never-overwrite guarantee continues to hold for the `staffEntries`
already recorded and for free-text notes; it no longer describes how staff set a field's value.

**Concretely**:

- `staffEntries` stays on the schema, keeps its data, keeps rendering, and staff keep the ability to
  add a note not tied to a field (FR-025).
- The `kind: "correction"` **write path** is retired: staff correct a field by setting it. Existing
  correction entries stay readable exactly where they are.
- The `appendStaffEntry` service and its route keep working for notes.

**Rationale**:

- The spec's Risks section names this directly: "that earlier requirement must be revisited rather
  than left contradicting this spec." 004's FR-012 says corrections are "recorded alongside (never
  overwriting) the user's own field values"; 007's FR-016 says a staff-set value *becomes* the
  profile's value. Left as-is, the traceability matrix in `docs/testing/requirements-traceability.md`
  would cite a satisfied requirement whose stated behaviour the code no longer has.
- The clarified answer ("left as-is") governs the **data**; it does not by itself resolve the
  **requirement text**, which is a documentation obligation under Principle V.
- Retiring the correction write path rather than keeping both is what makes FR-016's "rather than an
  annotation displayed beside a separate owner value" true. Keeping both would preserve the
  two-competing-values problem the feature exists to remove.

**Action required (documentation, not code)**: amend 004's FR-012 with a dated supersession note
naming 007 FR-016/FR-025, and update the FR-9 and NFR-5 rows of
`docs/testing/requirements-traceability.md`. Tracked as a task, not assumed.

---

## R10. Account directory endpoint and search

**Decision**: **`GET /api/staff/accounts?q=<term>`**, behind `requireAuth` + `requireStaff`, returning
`{ accounts: [{ id, displayName, email, role }] }`. Filtering is **server-side**, case-insensitive
substring on `displayName` or `email`, with the client debouncing input.

**Rationale**:

- FR-030 lists all accounts and FR-031 narrows by typing. Server-side filtering makes both one
  endpoint with one code path, and it does not depend on the dataset staying small enough to ship
  whole.
- The projection is exactly the three attributes FR-030 names. NFR-5 is satisfied by the projection
  itself: no password status, no profile content, no ticket counts leave the server on this route.
  Anything more is a second request the staff member deliberately makes.
- FR-033's refusal reuses `requireStaff`, so the directory inherits the tested refusal path rather
  than introducing a new one (`integration/access-control.test.ts` already covers the pattern).

**Alternatives considered**:

- *Return all accounts and filter in the browser*: rejected. It ships every account's email to the
  client on page load regardless of what the staff member searches for, which is a data-minimisation
  regression for a feature that gains nothing from it.
- *Reusing `staff-roster.ts`*: rejected. That endpoint lists **staff** for assignment, with
  availability and case counts. The directory lists **all accounts** with a different projection;
  overloading one endpoint with two audiences is how projections leak.

---

## R11. Remote access list as one field

**Decision**: `remoteAccessIds` keeps its existing array shape. Provenance, control, concurrency
token, and history attach to the **array as a whole**, exactly like `location` and `hardware`. A
history entry for this field records the previous **list**, not the changed entry.

**Rationale**:

- This is the clarified answer, and modelling it any other way re-opens the question the clarification
  closed. Per-entry provenance would require entries to have stable identities, which they currently
  do not (`_id: false` on the sub-schema), and would make "lock the list" meaningless.
- Storing the previous list keeps AS4 answerable: after adding two entries and removing one, the
  removal is visible in history as a list that used to contain it.

**Consequence**: the history entry's `previousValue` is not always a string. It is the field's prior
value, typed per field. The history collection stores it as a typed union, and the UI renders a list
field's history entry as a list.

---

## R12. Guide administration reuses the existing service unchanged

**Decision**: The console is a **client** for `guide-admin-service.ts` via the existing
`adminGuidesRouter` handlers. No new maintainer capability, no new validation, no new service.

**Rationale**:

- The spec's assumption is explicit: "The existing maintainer capabilities are the whole of the
  console's scope." SC-002 measures that all six existing capabilities become reachable, not that new
  ones appear.
- FR-013 requires the console validate a guide "against the system's existing limits". The limits live
  in `admin-guides.ts`'s zod schemas (slug pattern, name and description lengths, change-note length)
  and in the guide-step validation inside the service. The console mirrors these limits in its
  client-side messages **for guidance only**; the server remains the enforcement point (Principle VI:
  validate at boundaries). Client-side mirroring must not become the check.
- One consequence to verify at build time: the current `POST /categories` schema types guide steps as
  `z.array(z.unknown())` and delegates step validation to the service. The console's inline
  step-and-field error placement (Design Direction §4) needs the service's rejection to name the step
  index and the field. If it does not today, making it do so is in scope for FR-013 and is a backend
  task, not a frontend workaround.

---

## R13. Testing strategy

**Decision**: Vitest + supertest, matching the existing suites. Test-first for the two security
controls; same-task tests everywhere else (Principle IV).

| Area | Approach | Why |
|---|---|---|
| Sign-in throttle and refused-attempt record | **Test-first** | It is an authentication control on a shared secret. SC-011 is a measurable claim about it, and a throttle that silently stops throttling is invisible without a test. |
| Non-staff refusal on directory and profile routes | **Test-first** | SC-006 claims 100%. A claim of 100% needs a test that fails when the guard is removed. |
| Per-field conflict refusal | Same task, integration | Needs two concurrent saves; belongs in an integration test against a real store. |
| Provenance, control transfer, history append | Same task, unit + integration | |
| Console surfaces, owner profile lock, directory | Same task, `frontend/tests/` with Testing Library | Mirrors `dashboard.test.tsx` and `auth.test.tsx`. |
| Existing suites that must stay green | `frontend/tests/pages/auth.test.tsx`, `ChatPage.test.tsx`, `backend/tests/integration/profiles.test.ts`, `ticket-profile.test.ts`, `access-control.test.ts` | Route, type, and profile-shape changes reach all of them. |

Test names are chosen so `docs/testing/tc-tables.md` rows can be generated rather than hand-written
(Principle IV).

---

## R14. Documentation evidence that this feature invalidates

The spec's Risks section flags that changing the staff profile surface stales part of feature 006's
captured evidence. The concrete inventory:

| Artifact | Why it goes stale | Action |
|---|---|---|
| `docs/testing/feature-004-browser/uat-staff-reporter-profile.png` | Shows the staff profile view before authoritative fields | Recapture |
| `docs/testing/feature-004-browser/uat-staff-profile-note.png` | Shows the note/correction form being the only staff write path | Recapture |
| `docs/testing/feature-004-browser/uat-user-profile-saved.png` | Shows an owner profile with every field editable | Recapture |
| `docs/testing/requirements-traceability.md` — FR-9 row | Cites `staff-users.ts` and the profile surfaces | Update with the new routes and tests |
| `docs/testing/requirements-traceability.md` — NFR-5 row | Cites profile access control | Add the directory and field-history restrictions |
| `docs/testing/uat-scenarios.md` | Any scenario step touching profile editing | Revise the affected steps |
| `docs/design/feature-004-roles-erd.md` | Gains provenance and field-history entities | Update the ERD |
| 004's FR-012 in `specs/004-staff-dashboard/spec.md` | Superseded in part (see R9) | Dated supersession note |

Recapture happens **after** implementation, on the demo machine, and is tracked as tasks. Principle V
permits deferring demo-machine evidence by dated decision but requires it be tracked, not assumed.

---

## R15. Governance actions this feature requires before implementation

Both are raised by the spec's own Risks section and neither is a technical decision, so both are
recorded here as gate conditions rather than resolved:

1. **Supervisor agreement on scope (Principle I + Governance).** The developer directed this feature
   on 2026-08-28 while acknowledging it is not in the IR objectives. The spec frames it as
   strengthening FR-2 (which has no usable maintainer surface today) and FR-9 (the staff dashboard),
   which is the only basis on which Principle I permits work beyond the IR. Governance states that any
   change breaching Principle I requires supervisor agreement **before implementation**. The framing
   is a judgement call, so the agreement must be sought and its outcome recorded, whichever way it
   goes.
2. **Constitution amendment for Principle VII (delivery record).** The "Remaining order" list ends at
   item 6, the refining/Transition phase. A seventh increment is not declared, so as things stand the
   delivery record will not match what was built. `/speckit-constitution` must add increment 7 with
   its requirement tracing, and must reconcile it with the existing clause that the refining phase is
   the next phase and "nothing may be specified ahead of it without supervisor agreement".

Additionally, feature 006 is the phase in progress. This feature is sequenced **after** it, and its
Design Direction and evidence tasks assume 006's walkthroughs exist to be revised.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Console address and shell | `/maintainer`, outside `AppLayout`, no `AppNav` (R1) |
| Detecting administration switched off | Unauthenticated `GET /api/maintainer/status` (R2) |
| Key storage in browser | React state, per-request argument, separate caller (R3) |
| Throttle identity and store | Hashed `req.ip`; append-only `MaintainerSignInAttempt`; count derived (R4) |
| Provenance vs control | Stored separately; release changes control only (R5) |
| Field history storage | Separate `ProfileFieldHistory` collection (R6) |
| Concurrency token | Per-field `setAt`, `null` baseline, per-field outcome map (R7) |
| Existing profiles | No backfill; lazy owner-controlled defaults (R8) |
| 004 FR-012 contradiction | Narrowed with a dated supersession note; correction write path retired (R9) |
| Directory endpoint | `GET /api/staff/accounts?q=`, server-side filter, three-attribute projection (R10) |
| Remote access list | One field for provenance, control, concurrency, and history (R11) |
| Guide validation ownership | Server remains the enforcement point; step/field error detail may need backend work (R12) |
| Test strategy | Test-first for throttle and role refusal; same-task elsewhere (R13) |
| Stale evidence | Eight artifacts inventoried (R14) |
| Governance | Two gate conditions, unresolved by design (R15) |
