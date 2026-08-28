# Quickstart: Maintainer Admin Console & Staff-Authoritative Account Editing

**Feature**: `007-admin-console-account-editing` | **Date**: 2026-08-28

Runnable validation scenarios that prove the feature works end to end. Each scenario maps to the
acceptance scenarios and success criteria it evidences, so a pass here is Chapter 5 evidence rather
than a smoke test.

Shapes and status codes referenced below are defined in [`contracts/api.md`](contracts/api.md);
storage in [`data-model.md`](data-model.md). Neither is repeated here.

---

## Prerequisites

- MongoDB running as a **single-node replica set `rs0`** (constitution environment contract).
- `backend/.env` from `.env.example`, with:
  - `MAINTAINER_KEY` **set** for scenarios 1–5, and **unset** for scenario 6.
  - `MAINTAINER_SIGNIN_MAX_FAILURES` and `MAINTAINER_SIGNIN_COOLDOWN_SECONDS` at their defaults.
- Seeded demo data: the six mandated categories, one staff account, and at least three user accounts
  of which **one has never reported a ticket** (needed for SC-005).
- Realistic seeded names and values. Placeholder data such as "Jane Doe" is banned in anything that
  will be screenshotted (Design Direction).

```powershell
# from repo root, two terminals
cd backend  ; npm run dev
cd frontend ; npm run dev
```

---

## Gate 0 — quality gates must pass first

Run before any scenario. A scenario result recorded on a failing tree is not evidence.

```powershell
cd backend  ; npm run typecheck ; npm run lint ; npm test
cd frontend ; npm run typecheck ; npm run lint ; npm test
```

Expected: all pass, including the pre-existing suites the feature touches —
`backend/tests/integration/profiles.test.ts`, `ticket-profile.test.ts`, `access-control.test.ts`, and
`frontend/tests/pages/auth.test.tsx`.

---

## Scenario 1 — Maintainer completes a full category lifecycle through the interface

**Evidences**: US1 AS1–AS5, FR-001/002/003/006–013, SC-001, SC-002, SC-007.

1. Open `http://localhost:5173/maintainer`. Expect a sign-in form asking for a key and a name, and
   **no application navigation bar** on the page.
2. Enter the correct `MAINTAINER_KEY` and a real name. Expect the category list showing, for each
   category: display name, classification description, mandated status, retired status, and active
   guide version.
3. Create a category with a slug, display name, classification description, and at least one guide
   step. Expect it in the list at **active guide version 1**.
4. Start a new conversation as an ordinary user and report a problem matching the new category's
   description. Expect it to classify into the new category. *(This is the SC-001 measurement — time
   step 3 through step 4 end to end; the target is under 5 minutes with no terminal used.)*
5. Back in the console, edit the category's display name and description. Expect the change reflected
   in the list.
6. Publish a revised step set with a change note. Expect a **new version number**, now active.
7. Open the version history. Expect both versions, with the earlier one still readable, each showing
   version number, author, timestamp, and change note. Expect the author to be **the name typed at
   sign-in** (AS4).
8. Retire the new category. Expect a confirmation that **states the consequence before you confirm**:
   existing tickets keep the category, future classification stops using it.
9. Open any of the six mandated categories. Expect **no retire action anywhere on it** — not a
   disabled control — and a statement that mandated categories are permanent (AS5, FR-012).

**Also confirms SC-002**: all six existing maintainer capabilities (list, create, edit, publish,
history, retire) were reached without a hand-built request.

---

## Scenario 2 — The console refuses correctly, three distinct ways

**Evidences**: US1 AS6, AS7, AS8, FR-004, FR-005, FR-034, FR-035, SC-006, SC-011.

### 2a. Wrong key

1. Sign in with an incorrect key. Expect refusal, a plain-language message, and **no administration
   data on the page**.
2. Repeat with a key of a clearly different length, and with a differently-shaped key. Expect the
   **identical message every time** — no length hint, no character counter, no format complaint
   (FR-004).

### 2b. Cooling-off

3. Submit wrong keys until the configured threshold is reached. Expect further attempts refused for a
   **cooling-off period**, with that reason stated, and the submit control unavailable (AS7).
4. Confirm the message is **distinguishable from the wrong-key message**. A maintainer who now types
   the correct key must not conclude the key is wrong.
5. Inspect the `maintainersigninattempts` collection:

```javascript
db.maintainersigninattempts.find().sort({ at: -1 }).limit(10)
```

Expect one record per refused attempt, each with a timestamp, and **no field anywhere containing the
supplied key** (FR-035, SC-011).

6. Grep the backend log output for any submitted key string. Expect no match.

### 2c. Administration switched off

7. Stop the backend, unset `MAINTAINER_KEY`, restart, and open `/maintainer`.
8. Expect a statement that administration is **not enabled**, and expect **no sign-in form at all**
   (AS8, FR-005). The message must be visibly different from the wrong-key message.
9. Restore `MAINTAINER_KEY` before continuing.

### 2d. Key is not retained

10. Sign in successfully, then reload the page. Expect the sign-in form again (FR-014).
11. In devtools, check `localStorage` and `sessionStorage`. Expect **no maintainer key in either**.

---

## Scenario 3 — Staff set a user's real device, location, and remote access

**Evidences**: US2 AS1–AS5, AS11, FR-016–019, FR-024, FR-026, SC-003, SC-004.

1. Sign in as staff. Open a user's profile.
2. Set all three fields: location, hardware specification, and at least one remote access entry.
   Save. *(SC-003 measurement — target under 60 seconds for all three.)*
3. Expect each field to show **who set it and when**, naming the signed-in staff member (AS2).
4. Open the same user's profile from a **ticket detail page** as well. Expect the same values and the
   same bylines — not a stale or unattributed copy (AS1: "the profile's values wherever the profile is
   displayed").
5. Sign in as that user and open `/profile`. Expect the same values, with the same author and time
   shown (AS1, FR-020).
6. Back as staff, change the location. Open that field's history. Expect the **previous value, its
   author, and its timestamp** (AS3, SC-004).
7. Add a second remote access entry, save, then remove one, save. Expect only the remaining entry
   shown, and the removal visible in the **remote access field's** history (AS4).
8. Confirm the remote access byline and lock sit on the **list as a whole**, not on individual entries
   (FR-019).
9. Open the staff action record view. Expect the profile edits recorded alongside the other staff
   actions (AS5, FR-026).
10. As a user, edit a field staff have **not** touched. Expect it to save normally and to record the
    **owner** as its author (AS11, FR-024).

---

## Scenario 4 — Control passes to staff, and back

**Evidences**: US2 AS9, AS10, FR-021, FR-022, FR-023, SC-009, SC-010.

1. As staff, set the location on an account that has never had a staff correction.
2. Sign in as that account owner and open `/profile`.
3. Expect the location shown with the staff member's name and time, **not editable**, and the reason
   stated **on the field itself** (AS9, FR-022).
4. Expect it rendered as **read-only text, not a disabled input** (Design Direction, FR-022).
5. Expect **no field history anywhere on this page** — not shown, not collapsed, not disabled
   (FR-018).
6. Expect the fields staff have not set to be **editable exactly as before**.
7. **SC-009 check**: ask a person who has not seen this page before to say, unaided, why the field
   cannot be edited and how to get it changed. Record the answer verbatim.
8. As staff, release the location field. *(SC-010 measurement — target 3 interactions or fewer.)*
9. As the owner, edit the location. Expect it to save (AS10).
10. As staff, open the location's history. Expect **three distinct entries** in order: the staff set,
    the release, and the owner's edit — with control ending where the last one left it (spec edge
    case).
11. Find a field no staff member has ever set. Expect **no release action offered on it at all**
    (spec edge case).
12. Set every field on one account as staff, then view it as the owner. Expect a fully read-only page
    that **still explains what the page is for and how to get a value corrected** — not a form with a
    missing save button (spec edge case).

---

## Scenario 5 — Two staff members save at once, per field

**Evidences**: US2 AS6, FR-029.

1. Open the same user's profile as staff in two browser windows (staff A and staff B).
2. In window A, change **location** and save.
3. In window B — which still shows the old location — change **both** hardware and location, and save.
4. Expect the **hardware change saved**, and the **location change refused**, naming that the location
   changed underneath (AS6, FR-029).
5. Expect **no page-level "save failed"** message. Two fields were submitted; one was applied
   (Design Direction).
6. Expect staff B's typed location value **still present in the input**, not discarded.
7. Expect the staff action record for staff B to list **hardware only**, not the refused location
   (FR-026, `data-model.md` §8).

---

## Scenario 6 — Staff reach any account through the directory

**Evidences**: US3 AS1–AS4, FR-030–033, SC-005, SC-006.

1. As staff, open the account directory from the dashboard.
2. Expect all user accounts listed with display name, email, and role — **and nothing else**
   (FR-030, NFR-5).
3. Type part of a name. Expect the list to narrow (AS2).
4. Type a term matching nothing. Expect a designed "no match" state naming the term, not an empty
   frame.
5. Select the account that has **never reported a ticket** and open its profile. *(SC-005 measurement
   — target 3 interactions or fewer from the dashboard.)*
6. If that account has no profile yet, expect an **empty, editable profile**, not an error (spec edge
   case).
7. Sign in as a non-staff account and request `/staff/accounts` directly. Expect refusal (AS4,
   FR-033).

---

## Scenario 7 — Pre-feature notes and corrections survive untouched

**Evidences**: US2 AS8, FR-025.

Run against an account that carried a staff note **and** a `kind: "correction"` entry before this
feature. If none exists in the seed, create one by inserting a `staffEntries` entry directly, to
reproduce the pre-feature state honestly.

1. Open the profile as staff. Expect the note and the correction **still present and readable**,
   attributed and timestamped as before.
2. Expect the corrected field to still hold the **owner's** value — the correction has **not** become
   the value (FR-025).
3. Expect that field to still be **owner-controlled**: the owner can edit it (FR-025).
4. Open that field's history. Expect the pre-feature correction **absent from it** (FR-025).
5. Expect the correction rendered in the notes region, clearly not as the field's value (Design
   Direction).
6. As staff, add a **new free-text note not tied to a field**. Expect it to save (FR-025).

---

## Scenario 8 — Access control, exhaustively

**Evidences**: FR-015, FR-027, FR-033, SC-006, NFR-5.

For each row, expect the stated refusal with **no resource data in the body**:

| As | Request | Expect |
|---|---|---|
| Signed out | `GET /api/staff/accounts` | `401` |
| Non-staff user | `GET /api/staff/accounts` | `403` |
| Non-staff user | `GET /api/staff/users/<other id>/profile` | `403` |
| Non-staff user | `PUT /api/staff/users/<other id>/profile/fields` | `403` |
| Non-staff user | `GET /api/staff/users/<id>/profile/fields/location/history` | `403` |
| Any account owner | any route returning their own field history | **no such route exists** |
| Valid maintainer key | any `/api/staff/*` or `/api/my/*` route | refused — the key is not a session |
| Valid maintainer key | any ticket, conversation, or account route | **no such path exists** (FR-015) |
| Staff session | `/api/maintainer/categories` **without** the key | `401` |

**SC-006 is a 100% claim.** Every row must refuse, and the automated equivalents must fail if a guard
is removed.

---

## Scenario 9 — The mandated categories survive everything

**Evidences**: SC-007, constitution FR-2.

1. Through the console, run: create a category, edit it, publish two guide versions, retire it,
   attempt to retire each mandated category, and edit each mandated category's description.
2. Confirm all six mandated categories are still present, not retired, and still classifying — by
   reporting one problem per category through the chat and checking the resulting classification.

---

## Scenario 10 — The demo path still passes

**Evidences**: Principle IV release gate.

Run the scripted end-to-end demo path on the demo machine: report an issue (voice or text) → classify
→ ticket → guided fix → escalation → staff dashboard view and takeover → whitelisted remediation on a
test endpoint.

**Expected**: unchanged and passing. This feature touches the reporter profile shown at escalation, so
this run is the check that the escalation leg still carries correct context (FR-7).

---

## Evidence to capture (Principle V)

On the demo machine, after the scenarios pass. Three of these **replace** stale feature-004/006
screenshots (`research.md` R14) rather than adding to them:

| Capture | Replaces |
|---|---|
| Maintainer console category list | new |
| Guide step editor with an inline step-level validation error | new |
| Guide version history | new |
| Console "administration not enabled" state | new |
| Console cooling-off state | new |
| Staff profile with all three fields set, bylines visible | `uat-staff-reporter-profile.png` |
| Field history disclosure open | `uat-staff-profile-note.png` |
| Owner profile with one field locked and one editable | `uat-user-profile-saved.png` |
| Per-field conflict, one applied and one refused | new |
| Account directory with a search applied | new |

Also update, in the same pass:

- `docs/testing/requirements-traceability.md` — FR-9 and NFR-5 rows.
- `docs/testing/uat-scenarios.md` — steps touching profile editing.
- `docs/design/feature-004-roles-erd.md` — provenance and field-history entities.
- `docs/testing/tc-tables.md` — TC rows generated from the new suites.
- `specs/004-staff-dashboard/spec.md` — dated supersession note on FR-012 (`research.md` R9).

---

## Success criteria coverage

| SC | Scenario | Measured how |
|---|---|---|
| SC-001 | 1 | Timed, console-open to classifying, under 5 min, no terminal |
| SC-002 | 1 | All six capabilities exercised through the interface |
| SC-003 | 3 | Timed, three fields under 60 s, every field attributed after |
| SC-004 | 3 | Previous value and author visible for every change since ship |
| SC-005 | 6 | Interaction count from dashboard to a ticketless account's profile |
| SC-006 | 2, 8 | Every refusal row passes; 100% claim |
| SC-007 | 9 | Six categories present and classifying after the full operation set |
| SC-008 | *UAT* | Three testers, unaided, first attempt — a separate UAT session, not this guide |
| SC-009 | 4 step 7 | A person states the lock reason and remedy unaided |
| SC-010 | 4 step 8 | Interaction count to release a locked field |
| SC-011 | 2b | Throttle stops unlimited attempts; every refusal retrievable; no key stored |

SC-008 is deliberately not a step here: it requires three acceptance testers under
`docs/testing/uat-scenarios.md`, which is UAT under Principle IV, not a developer walkthrough.
