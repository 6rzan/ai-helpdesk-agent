# Feature Specification: Maintainer Admin Console & Staff-Authoritative Account Editing

**Feature Directory**: `specs/007-admin-console-account-editing`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Build the admin UI now it is not in the objectives but build it I
can not be what the maintainer do but with a ui for it and I use the MAINTAINER_KEY with a name in
the name field then the maintainer can access and also I want the staff to be able to edit anyone's
account details not only make it like it is a note really edit it put his real device specs and
location and remote ID in his account for the user"

**Traces to**: IR **FR-2** (categories are data, extendable and editable by a maintainer — the
console gives that capability a usable surface), **FR-9** (web-based dashboard for IT staff — the
account directory and profile editing extend it), **FR-7** (escalation carries accurate context),
**NFR-2** (plain-language guidance), **NFR-5** (data minimisation; role-restricted access).
Positioned under Principle I as an **enhancement that strengthens existing IR requirements**, not a
new objective — see Assumptions and Risks.

## Clarifications

### Session 2026-08-28

- Q: At what granularity does staff control apply to remote access — the whole list, or each entry? → A: Collection-level — the remote access list is one field with a single provenance record and a single lock; adding or removing an entry is a change to that field, recorded in its history.
- Q: How should the console handle repeated wrong-key sign-in attempts? → A: Throttle and record — after a small number of consecutive failures from the same client, further attempts are refused for a cooling-off period, and every refused attempt is recorded with its timestamp (never the supplied key).
- Q: Can an account owner see the previous values of their own profile fields? → A: No — field history is a staff-only surface; the owner sees the current value with who set it and when.
- Q: Is concurrent-edit conflict detection per field or per profile? → A: Per field — a save is refused only for the specific field that changed since the page was opened; edits to fields nobody else touched save normally.
- Q: What happens to staff corrections recorded before this feature? → A: Left as-is — they stay visible as staff notes against their field, and do not become the field value, do not seed the new field history, and do not place the field under staff control.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The maintainer administers categories and guides from a screen (Priority: P1)

The maintainer opens a dedicated administration area of the web application, types the maintainer
key and their own name into a sign-in form, and lands on a list of every support category with its
active guide version. From there they add a new category together with its first set of
troubleshooting steps, reword an existing category's description so classification picks up a new
phrasing, publish a corrected guide version, read the version history to see who changed what and
when, and retire a category that is no longer used. Nothing about this requires a terminal, a
hand-built request, or knowledge of the request format.

**Why this priority**: Category and guide administration is the one maintainer capability the
system already has, and today it is reachable only by hand-crafting requests with two custom
headers. That makes the mandated "categories may be extended or edited by a maintainer" behaviour
undemonstrable in a live walkthrough. This story alone converts an invisible capability into a
showable one, and it is fully independent of everything else in this feature.

**Independent Test**: Fully testable by starting the system with maintainer administration enabled,
signing in to the console with the key and a name, and completing a create → edit → publish →
history → retire cycle entirely through the interface, then confirming the resulting categories and
guide versions are the ones the troubleshooting flow actually serves.

**Acceptance Scenarios**:

1. **Given** maintainer administration is enabled and the console is open, **When** the maintainer
   enters the correct key and a name, **Then** the category list is shown with each category's
   display name, description, mandated status, retired status, and active guide version.
2. **Given** the maintainer is signed in, **When** they create a category with a name, display
   name, classification description, and at least one guide step, **Then** the category appears in
   the list with active guide version 1 and is immediately available to classification.
3. **Given** a category exists, **When** the maintainer publishes a revised set of steps with a
   change note, **Then** a new version number is created, it becomes the active version, and the
   previous version remains readable in the history.
4. **Given** the maintainer is signed in as a given name, **When** they publish any change,
   **Then** the version history attributes that change to the name they entered at sign-in.
5. **Given** a category is one of the six mandated categories, **When** the maintainer views it,
   **Then** the retire action is unavailable and the interface explains that the mandated
   categories cannot be removed.
6. **Given** an incorrect key is entered, **When** the maintainer submits the sign-in form,
   **Then** access is refused with a plain-language message and no administration data is shown.
7. **Given** several consecutive incorrect keys have been submitted from the same client, **When**
   another attempt is made, **Then** it is refused for a cooling-off period with that reason
   stated, and each refused attempt has been recorded without the key that was supplied.
8. **Given** maintainer administration is switched off in the running system, **When** the console
   is opened, **Then** it states that administration is not enabled rather than showing a generic
   error or an empty list.

---

### User Story 2 - Staff record a user's real device, location, and remote access details (Priority: P1)

A staff member handling an escalation finds that the reporter's profile is empty, wrong, or was
filled in loosely. The staff member opens that person's profile and edits the fields directly:
they set the actual workstation specification, the real desk or site location, and the remote
access identifier they use to reach that machine. What they save becomes the account's value — the
value the next staff member sees and the value the account owner sees on their own profile page —
rather than a separate remark sitting beside a stale entry. Each field shows who last set it and
when, and the previous value stays available in the field's history.

Once staff have set a field, it stops being something the owner can quietly change: the owner still
sees it, and sees who set it, but editing it is now staff's job. A staff member can hand a field
back to the owner when self-service is appropriate again.

**Why this priority**: This is the difference between a profile that can be trusted at escalation
time and one that must be re-verified by asking the user. Today staff can only append an annotation
next to the owner's value, so two competing values are displayed and neither is authoritative. It
is independently testable and independently valuable even if no other part of this feature ships.

**Independent Test**: Fully testable by signing in as staff, opening a user's profile, changing all
three support fields, and confirming that the saved values are what both the staff view and the
owner's own profile view report, that each field names the staff member who set it, that the owner
can no longer edit those fields, and that the prior values remain visible in the field history.

**Acceptance Scenarios**:

1. **Given** a staff member is viewing a user's profile, **When** they set the location, hardware
   specification, and one or more remote access entries and save, **Then** those values are the
   profile's values wherever the profile is displayed.
2. **Given** a field was last set by a staff member, **When** anyone with access views the profile,
   **Then** the field shows the staff member's name and the time it was set.
3. **Given** a field is changed, **When** the change is saved, **Then** the previous value, its
   author, and its timestamp are retained and viewable as field history.
4. **Given** a staff member adds two remote access entries and later removes one, **When** the
   profile is viewed, **Then** only the remaining entry is shown and the removal appears in
   history.
5. **Given** a staff member edits another person's profile, **When** the edit is saved, **Then** it
   is recorded in the staff action record alongside the other staff actions.
6. **Given** two staff members opened the same profile and the first saved the location, **When**
   the second saves a change to the hardware specification and to the location, **Then** the
   hardware change is saved and the location change is refused with the conflict named.
7. **Given** a signed-in employee who is not staff, **When** they attempt to reach another
   account's profile, **Then** access is refused.
8. **Given** existing staff notes and a pre-feature correction were previously added to a profile,
   **When** the profile is viewed after this feature ships, **Then** they are still present and
   readable, the corrected field still holds the owner's value, and the owner can still edit it.
9. **Given** a staff member has set the location field on an account, **When** the account owner
   opens their own profile, **Then** the location is shown with the staff member's name and the
   time it was set, the owner cannot change it, and the reason is stated on the page.
10. **Given** a field has been set by staff, **When** a staff member releases that field back to the
    owner, **Then** the owner can edit it again and the release is recorded in the field history.
11. **Given** a field the owner still controls, **When** the owner edits it, **Then** the change
    saves normally and the field records the owner as its author.

---

### User Story 3 - Staff reach any account, not only reporters of an open ticket (Priority: P2)

A staff member needs to prepare a machine record for someone who has never raised a ticket, or to
correct details for a colleague they know by name. They open an account directory in the staff
dashboard, search by name or email, and go straight to that person's profile.

**Why this priority**: Without it, "edit anyone's account details" is not achievable — a profile is
currently reachable only by following a link from a ticket that person reported. It is a smaller
slice than US2 and depends on nothing in US1, but US2 delivers most of the value on its own for
users who do have tickets, so this ranks second.

**Independent Test**: Fully testable by signing in as staff, opening the directory, searching for an
account that has never reported a ticket, and opening its profile from the results.

**Acceptance Scenarios**:

1. **Given** a staff member is signed in, **When** they open the account directory, **Then** all
   user accounts are listed with display name, email, and role.
2. **Given** the directory is open, **When** the staff member types part of a name or email,
   **Then** the list narrows to matching accounts.
3. **Given** a search result is shown, **When** the staff member selects it, **Then** that
   account's profile opens ready to view and edit.
4. **Given** a signed-in employee who is not staff, **When** they attempt to open the directory,
   **Then** access is refused.

---

### Edge Cases

- **Maintainer administration disabled while the console is open.** The console must report that
  administration is unavailable rather than appearing to accept changes that are silently lost.
- **Maintainer key rotated mid-session.** The next action fails; the console must return the
  maintainer to the sign-in form with an explanation, not a dead screen.
- **Console reloaded or reopened.** The key is not retained; the maintainer signs in again.
- **Repeated wrong keys submitted at speed.** The console stops accepting attempts for a
  cooling-off period and says so, rather than letting the shared key be guessed indefinitely.
- **Duplicate or malformed category name.** The interface reports the conflict or the naming rule
  before the change is attempted, naming the offending field.
- **Guide submitted with zero steps, more than the permitted maximum, or a step missing its
  instruction or success hint.** Rejected with the specific step and field identified.
- **Retiring a category that has open tickets classified under it.** Existing tickets keep their
  category; only future classification stops using it. The interface must say so before confirming.
- **Two staff members editing the same profile at once.** The later save must not silently discard
  the earlier one without the second staff member being told the field changed underneath them.
  Detection is per field: if the two edited different fields, both saves succeed.
- **A profile field cleared rather than replaced.** Treated as a change, with the cleared value
  preserved in history.
- **Remote access entries submitted with a tool name but no identifier**, or beyond the permitted
  number of entries. Rejected with the offending entry identified.
- **Staff editing their own profile through the staff surface.** Permitted, and recorded the same
  way as any other edit.
- **An account with no profile yet.** Opening it from the directory presents an empty, editable
  profile rather than an error.
- **A profile carrying a correction recorded before this feature.** The field stays under owner
  control showing the owner's value, with the old correction still readable beside it, until a
  staff member sets the field for real.
- **Every field on a profile has been set by staff.** The owner's profile page becomes entirely
  read-only; it must still explain what the page is for and how to get a value corrected, rather
  than reading as a broken form.
- **A staff member sets a field, then releases it, then sets it again.** Each transition is a
  distinct entry in the field's history, and control ends where the last transition left it.
- **A staff member releases a field that no staff member ever set.** The action is unavailable
  rather than a no-op the staff member has to guess at.
- **The owner submits a change to a field that was locked after they opened the page.** The save is
  refused with an explanation, not applied silently.

## Requirements *(mandatory)*

### Functional Requirements

**Maintainer console (US1)**

- **FR-001**: System MUST provide a maintainer administration area in the web application at its
  own address, separate from the employee and staff areas.
- **FR-002**: The console MUST require a maintainer key and a maintainer display name before any
  administration content is shown.
- **FR-003**: System MUST attribute every category and guide change made through the console to the
  display name the maintainer supplied at sign-in.
- **FR-004**: The console MUST refuse an incorrect key with a plain-language message and MUST NOT
  indicate how close the supplied key was to the correct one.
- **FR-005**: When maintainer administration is not enabled in the running system, the console MUST
  state that administration is switched off, distinctly from the message shown for a wrong key.
- **FR-006**: The console MUST list every category showing display name, classification
  description, whether it is one of the six mandated categories, whether it is retired, and its
  active guide version.
- **FR-007**: Maintainers MUST be able to create a category together with its first guide.
- **FR-008**: Maintainers MUST be able to change a category's display name and classification
  description.
- **FR-009**: Maintainers MUST be able to publish a new guide version for a category, with an
  optional change note.
- **FR-010**: Maintainers MUST be able to read a category's full guide version history, showing
  version number, author, timestamp, and change note.
- **FR-011**: Maintainers MUST be able to retire a category that is not one of the six mandated
  categories.
- **FR-012**: The console MUST NOT offer retirement for a mandated category, and MUST explain that
  the six mandated categories are permanent rather than presenting an action that then fails.
- **FR-013**: The console MUST validate a guide against the system's existing limits before
  submission and identify the specific step and field at fault when it does not pass.
- **FR-014**: The maintainer key MUST NOT be written to persistent browser storage; reloading or
  reopening the console MUST require entering it again.
- **FR-015**: The maintainer area MUST NOT expose tickets, conversations, accounts, or any staff
  surface, and MUST NOT be able to change accounts or roles.
- **FR-034**: After a small number of consecutive failed sign-in attempts from the same client, the
  console MUST refuse further attempts for a cooling-off period and MUST say that it is doing so,
  rather than continuing to accept unlimited guesses at the shared key.
- **FR-035**: System MUST record every refused maintainer sign-in attempt with its timestamp, and
  MUST NOT record the key that was supplied.

**Staff-authoritative account editing (US2)**

- **FR-016**: Staff MUST be able to set a user's location, device/hardware specification, and
  remote access identifiers so that the saved value becomes the profile's value everywhere the
  profile is shown, rather than an annotation displayed beside a separate owner value.
- **FR-017**: Every profile field MUST display who last set it — the account owner or the named
  staff member — and when.
- **FR-018**: System MUST retain each field's previous value, author, and timestamp whenever the
  field changes, and staff MUST be able to view that history. Field history is a staff-only
  surface and MUST NOT be shown to the account owner.
- **FR-019**: Staff MUST be able to add and remove individual remote access entries, each carrying
  the tool name and the identifier used with it. The remote access list counts as a single field for
  provenance, control, and history: adding or removing an entry is a change to that one field, and
  the list is locked or released as a whole rather than entry by entry.
- **FR-020**: The account owner MUST continue to be able to view their own profile and see any
  value a staff member set, including who set it and when. The owner sees the current value only —
  earlier values are withheld by FR-018, which is the single statement of that rule.
- **FR-021**: Once a staff member has set a profile field, the account owner MUST NOT be able to
  change that field. The field remains visible to the owner, but editing it is reserved to staff.
- **FR-022**: The owner's own profile MUST explain, on the field itself, why a staff-set field
  cannot be edited and that IT staff can change it on request — it MUST NOT present an input that
  silently does nothing or fails on save.
- **FR-023**: Staff MUST be able to release a staff-set field back to the owner's control, after
  which the owner can edit it again. The release MUST be recorded in the field's history like any
  other change.
- **FR-024**: A field the owner still controls MUST remain editable by the owner exactly as it is
  today, and MUST record the owner as its author.
- **FR-025**: Existing staff notes and corrections recorded before this feature MUST remain visible
  against whatever they were attached to, and staff MUST still be able to add a free-text note that
  is not tied to a field. A pre-existing correction MUST NOT become the field's value, MUST NOT
  appear in the field's history, and MUST NOT place the field under staff control.
- **FR-026**: System MUST record every staff edit, and every field release, in the staff action
  record.
- **FR-027**: System MUST refuse any attempt by a non-staff account to view or edit another
  account's profile.
- **FR-028**: System MUST NOT introduce profile fields beyond those already needed for support
  handling.
- **FR-029**: System MUST refuse a staff save to any individual field that has changed since the
  staff member opened the profile, and MUST tell them which field changed, rather than overwriting
  the other change without warning. Fields that nobody else has touched MUST save normally in the
  same attempt.

**Account directory (US3)**

- **FR-030**: Staff MUST be able to list all user accounts from the staff dashboard, showing
  display name, email, and role.
- **FR-031**: Staff MUST be able to narrow that list by typing part of a display name or email.
- **FR-032**: Staff MUST be able to open any listed account's profile directly from the directory.
- **FR-033**: System MUST refuse directory access to any account without the staff role.

### Key Entities

- **Category**: A support category. Carries a machine name, display name, classification
  description, whether it is one of the six mandated categories, and whether it is retired.
  Already exists; this feature adds no attributes.
- **Guide Version**: A numbered, immutable set of troubleshooting steps belonging to a category,
  with exactly one version active at a time, and carrying its author, timestamp, and change note.
  Already exists; this feature adds no attributes.
- **Support Profile**: The support-relevant record attached to an account — location, device and
  hardware specification, and remote access entries. Already exists; this feature changes who may
  author its values.
- **Profile Field Provenance**: For each profile field — location, device/hardware specification,
  and the remote access list taken as a whole — who last set it (the owner or a named staff
  member), when, and which of the two currently controls it. New.
- **Profile Field History**: An append-only record of each profile field's previous values and of
  every transfer of control between owner and staff, each with author and timestamp. Readable by
  staff only. New.
- **Account Directory Entry**: The listing view of a user account — display name, email, role —
  used to find an account without going through a ticket. New as a view; the underlying accounts
  already exist.
- **Maintainer Session**: The key and display name a maintainer supplies to work in the console,
  held only for as long as the console is open. New, and never persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer can add a new support category with a working guide, from opening the
  console to seeing it classify a matching report, in under 5 minutes without using a terminal or
  reading the request format.
- **SC-002**: All six category and guide administration capabilities that exist today are reachable
  through the console, with none requiring a hand-built request.
- **SC-003**: A staff member can correct all three support fields on a user's profile in under 60
  seconds, and every field afterwards names who set it.
- **SC-004**: For any profile field, a staff member can see the value that preceded the current one
  and who set it, for every change made since this feature shipped.
- **SC-005**: Staff can reach the profile of an account that has never reported a ticket in 3
  interactions or fewer from the dashboard.
- **SC-006**: 100% of attempts by a non-staff account to reach another account's profile or the
  directory are refused, and 100% of attempts to reach the maintainer console without the correct
  key are refused.
- **SC-007**: The six mandated categories remain present and classifying after any sequence of
  console operations, including attempted retirement.
- **SC-008**: Three acceptance testers complete a maintainer task and a staff profile-correction
  task unaided on first attempt, without asking what a field means.
- **SC-009**: An account owner shown a field they can no longer edit can state, without help, why
  it is locked and how to get it changed.
- **SC-010**: No account owner can end up permanently unable to have a profile field corrected:
  every locked field can be returned to owner control by staff in 3 interactions or fewer.
- **SC-011**: Repeated wrong-key attempts on the console are stopped before an unlimited number can
  be made, and every refused attempt is retrievable from the record afterwards with no supplied key
  stored.

## Assumptions

- **This feature is an enhancement, not a new objective.** The developer directed it explicitly on
  2026-08-28, acknowledging it is not in the IR objectives. It is specified as strengthening FR-2
  (maintainer-editable categories, which currently has no usable surface) and FR-9 (the staff
  dashboard), which is the only basis on which Principle I permits work beyond the IR. It must not
  proceed at the expense of completing the refining/Transition phase — see Risks.
- **Feature 006 (refining/Transition) is treated as the phase that precedes this one**, satisfying
  Principle VII's ordering rule that nothing be specified ahead of it.
- **The existing maintainer capabilities are the whole of the console's scope.** The console
  presents the category and guide operations that already exist; it does not gain new maintainer
  powers, and specifically gains no access to accounts, roles, or tickets.
- **Maintainer identity remains a shared key plus a self-declared name**, exactly as it works
  today. It is not an account, has no password, and no session is created for it. The name is
  attribution, not authentication.
- **The maintainer key is held only in memory for the open console** and is not written to
  persistent browser storage, so a reload requires re-entry. This is accepted as the safer trade
  against the convenience of staying signed in.
- **Staff-set values become the profile's values.** This replaces the current arrangement where a
  staff correction is displayed alongside the owner's value without replacing it. Corrections
  recorded before this feature are left exactly as they stand — visible as staff notes against
  their field, not converted into field values, not seeded into the new field history, and not
  placing the field under staff control — so nothing already recorded is lost or silently
  reinterpreted. Staff correct such a field by setting it, the same as any other field.
- **Control is per field, not per profile.** A staff member setting the hardware specification does
  not lock the owner out of the location field. The remote access list is one field for this
  purpose, so staff setting any entry takes control of the whole list. Fields the owner has never
  had corrected stay self-service, which keeps the lock proportionate to the problem it solves.
- **Every profile starts under owner control.** Fields become staff-controlled only when a staff
  member actually sets one; existing profiles are not locked wholesale when this feature ships.
- **Field history is a staff tool, not an owner-facing record.** The owner sees the current value
  and who set it, which is what SC-009 needs; prior values stay with staff, consistent with NFR-5's
  restriction of stored records to approved roles.
- **There is no separate change-request workflow.** An owner who needs a locked field corrected
  raises it the way they raise anything else — through the chat, which already escalates to staff —
  and staff either correct the value or release the field. Building a dedicated request queue would
  add a surface for a case the existing escalation path already covers.
- **The three support fields are unchanged in kind** — location, device and hardware specification,
  and remote access identifiers. "Device specs" and "remote ID" in the request map onto the
  hardware and remote access fields that already exist; no new categories of personal data are
  collected (NFR-5).
- **The account directory lists user accounts for support purposes only** — display name, email,
  role — and shows nothing that is not already visible to staff elsewhere.
- **Staff remain unable to change roles or grant staff access**, which continues to be possible
  only through the maintainer-run provisioning script.
- **Both surfaces live inside the existing web application** and reuse its established navigation,
  route guarding, and session handling rather than introducing a separate application.

## Risks

- **Principle I / Governance.** Constitution Governance states that any change breaching Principle
  I is a project scope change requiring supervisor agreement before implementation. This feature is
  framed as an enhancement to FR-2 and FR-9 rather than a breach, but the framing is a judgement
  call and the developer has already noted the work sits outside the objectives. Confirm with the
  supervisor before implementing, and record the outcome.
  - **Outcome recorded 2026-08-28 (gate condition G1, tasks.md T001): AGREED.** The supervisor
    agreed that feature 007 strengthens IR FR-2 (staff resolution tooling) and FR-9 (account and
    profile administration) rather than breaching project scope, and therefore falls under
    Principle I's enhancement allowance rather than its scope-change clause. The agreement is
    recorded as covering **the specification, plan, and tasks already produced on 2026-08-28 as
    well as the implementation** — not the implementation alone. That distinction is the one
    Principle VII's remaining-order clause requires, because 007 was specified while feature 006
    was still in progress, so the artifacts themselves needed agreement and not just the code that
    follows them. Had agreement been refused, this feature's artifacts would have been withdrawn or
    parked by dated decision rather than left specified and unimplemented. The corresponding entry
    on the supervisor log sheet is a physical artifact and is signed separately; this record and
    `docs/testing/observations.md` are its repository counterpart.
- **Principle VII / delivery record.** The constitution's remaining-order list ends at the refining
  phase, so a seventh increment is not currently declared. The constitution needs amending to name
  this increment, or the delivery record will not match what was built.
  - **Cleared 2026-08-28 (gate condition G2, tasks.md T002).** `.specify/memory/constitution.md`
    amended to declare increment 7 with its requirement tracing in the Principle VII delivery
    record, and to reconcile the clause that named the refining phase as next and last. G2 was
    cleared after G1 and not before: declaring the increment ahead of the supervisor's agreement
    would have put the constitution ahead of the decision it records.
- **Earlier profile-annotation behaviour.** The never-overwrite rule for staff annotations was a
  deliberate earlier design decision with its own requirement and tests. Replacing it changes
  shipped, tested behaviour, so that earlier requirement must be revisited rather than left
  contradicting this spec.
- **Refining-phase evidence.** Feature 006 captured walkthroughs and screenshots of the system as it
  stood. Changing the staff profile surface invalidates the portion of that evidence covering it,
  which must be recaptured rather than left stale.

## Out of Scope

- Any maintainer capability over accounts, roles, tickets, conversations, or remediation policy.
- Turning the maintainer into a real account with a password, or issuing it a session.
- Staff-initiated creation or deletion of user accounts.
- A dedicated change-request queue for owners asking to have a locked field corrected.
- Changing how the six mandated categories classify, or removing any of them.
- Editing the remediation action whitelist or endpoint registry through a screen.
- Bulk editing of profiles, or importing profile data from a file.
