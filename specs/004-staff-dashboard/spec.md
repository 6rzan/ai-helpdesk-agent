# Feature Specification: Staff Dashboard & User Accounts

**Feature Branch**: `004-staff-dashboard`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "next feature" (per roadmap priority 1: staff dashboard & user accounts — web dashboard for IT staff to view tickets, take over escalated cases, and resolve them, with role-restricted access; user accounts with self-service profiles surfaced automatically on escalated tickets)

**IR traceability (Constitution Principle I)**: **FR-9** (web-based dashboard where IT staff see tickets, follow progress updates, and handle urgent or escalated matters), **FR-6** (ticket status visible in plain messages; every handling-mode change reflected without delay), **FR-7** (escalation to human IT staff — this feature delivers the staff-side handling), **NFR-4** (human oversight for critical operations), **NFR-5** (data minimisation; stored data access restricted to approved roles), **NFR-6** (AI handles simple tasks, complex cases route to humans). Constitution Principle III requires the dashboard to give staff full visibility and override authority, with handover context preserved so users never repeat themselves.

## Clarifications

### Session 2026-07-13

- Q: Must starting a new support conversation require a signed-in account, or does anonymous chat remain? → A: Sign-in required for all new conversations; every new ticket is account-linked.
- Q: Can staff take over any ticket, or only escalated ones? → A: Any open ticket at any stage; escalation is just the usual trigger.
- Q: What form do staff-appended profile details take? → A: Hybrid — attributed free-text notes plus corrected values alongside (never overwriting) the user's own fields. Additionally requested: bulk import of user details from an existing Excel file with staff-controlled column-to-field mapping, and provisioned sign-in credentials (email + set initial password, changeable later in settings).
- Q: What can staff see of a user's credentials? → A: Credential status only (still on issued initial password vs changed) plus the ability to re-issue/reset an initial password; staff never see a user-typed password.
- Q: After takeover, can a ticket move again? → A: Reassignable between staff (attributed); no hand-back to the automated agent. Additionally requested: the reporter sees who their ticket is assigned/reassigned to, and staff have an availability status plus a suggested default assignee (available, least loaded) when assigning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Sign In and Manage Tickets on the Dashboard (Priority: P1)

An IT staff member signs in with a staff account and lands on a web dashboard listing every ticket in the system: ticket number, category, status, handling mode, reporter, and age. They can filter and sort the list, open any ticket to see its full context — the complete conversation, the classification, and every troubleshooting step already attempted — and update its status or mark it resolved. Anyone without the staff role cannot reach the dashboard at all.

**Why this priority**: This is the core of IR FR-9 and the biggest missing piece of the system: staff currently have no way to see or act on the tickets the agent creates. Even alone, it turns the agent from a ticket generator into a working support loop.

**Independent Test**: Can be fully tested by signing in as a seeded staff account, viewing tickets created through the existing chat, opening one, and resolving it — while a non-staff account is refused access.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member, **When** they open the dashboard, **Then** they see all tickets with number, category, status, handling mode, reporter, and creation/last-update times.
2. **Given** the dashboard list, **When** the staff member filters by status or category, **Then** only matching tickets are shown.
3. **Given** an open ticket detail, **When** the staff member reviews it, **Then** the full conversation, the classified category, and all attempted troubleshooting steps are visible without leaving the page.
4. **Given** a ticket detail, **When** the staff member marks the ticket resolved, **Then** the ticket status changes, the change is attributed to that staff member, and the reporter sees the update in their conversation in plain language without delay.
5. **Given** a signed-in regular user (or a signed-out visitor), **When** they attempt to open the dashboard, **Then** access is refused with a clear message and no ticket data is exposed.
6. **Given** the dashboard is open, **When** a new ticket is created or an existing ticket changes, **Then** the list reflects the change without the staff member manually reloading.

---

### User Story 2 - Take Over an Escalated Ticket with the Reporter's Profile at Hand (Priority: P2)

Escalated tickets appear prominently on the dashboard. When a staff member opens one, the reporter's support profile — remote-access ID (e.g. TeamViewer/UltraViewer), location/desk, and hardware details — is shown automatically alongside the conversation and attempted steps, so the staff member never has to ask for or search out this information. They take over the ticket, which switches its handling mode to human-involved, work the case, and resolve it.

**Why this priority**: Escalation handling is the reason the dashboard exists (IR FR-7, NFR-6): complex cases must land with a human who has full context. Automatic profile surfacing removes the top support frustration of users repeating themselves.

**Independent Test**: Can be fully tested by escalating a ticket through the existing chat flow (with a profile on file for the reporter), then taking it over and resolving it from the dashboard while checking what the reporter sees in the chat.

**Acceptance Scenarios**:

1. **Given** tickets in escalated state, **When** the staff member views the dashboard, **Then** escalated tickets are visually distinguished and grouped or sortable so they can be found first.
2. **Given** an escalated ticket whose reporter has a profile, **When** the staff member opens it, **Then** the reporter's remote-access ID, location/desk, and hardware details are displayed automatically on the ticket view.
3. **Given** an escalated ticket whose reporter has no profile on file, **When** the staff member opens it, **Then** the ticket clearly states that no profile exists rather than showing blank or misleading fields.
4. **Given** an escalated ticket, **When** a staff member takes it over, **Then** the handling mode changes to human-involved, the takeover is attributed to that staff member, and the reporter is told in plain language that a person is now handling their case, without delay.
5. **Given** a ticket already taken over by one staff member, **When** a second staff member views it, **Then** they can see who is handling it; the system prevents a silent conflicting takeover.
6. **Given** a taken-over ticket, **When** the handling staff member reassigns it to a colleague, **Then** the new assignee is recorded, the change is attributed to whoever reassigned it, and the reporter sees in plain language that a different named person is now handling their case, without delay.
7. **Given** a staff member choosing an assignee, **When** the assignment picker opens, **Then** it shows each staff member's availability status and current open-case count and suggests a default (an available colleague with the fewest active cases); the suggestion never auto-assigns — a person confirms.

---

### User Story 3 - Users Sign In and Follow Their Own Tickets (Priority: P3)

A user creates an account and signs in before chatting with the agent. Their conversations and tickets are linked to their account, and they can view a list of their own tickets and each one's current status in plain language. They can see only their own tickets — never anyone else's.

**Why this priority**: Accounts give tickets an owner, which is what makes profile surfacing (P2) and role restriction (P1) trustworthy. Letting users revisit their own tickets strengthens IR FR-6 status visibility beyond the live conversation.

**Independent Test**: Can be fully tested by registering a new account, reporting an issue through the chat, and confirming the ticket appears under "my tickets" with its live status — while a second account cannot see it.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** they create an account and sign in, **Then** they can start a support conversation as before, and the resulting ticket is linked to their account.
2. **Given** a signed-in user with past tickets, **When** they open their ticket list, **Then** they see all and only their own tickets with current status and handling mode in plain language.
3. **Given** a signed-in user, **When** a staff member updates one of their tickets, **Then** the updated status is visible to the user without delay.
4. **Given** any signed-in regular user, **When** they attempt to view another user's ticket or profile, **Then** access is refused.
5. **Given** a returning user, **When** they sign in on a new day, **Then** their history and profile are intact.

---

### User Story 4 - Self-Service Profiles with Staff-Appended Details (Priority: P4)

A signed-in user maintains their own support profile: remote-access ID(s), location/desk, and hardware details — only fields that help resolve support cases, nothing more. IT staff can view any user's profile and append additional details (e.g. corrected asset numbers, site notes); staff-appended entries are attributed and timestamped and distinguishable from the user's own entries.

**Why this priority**: The profile is what makes P2's automatic surfacing valuable, but a minimal seeded profile is enough to demo P2, so full self-service editing can land last.

**Independent Test**: Can be fully tested by a user filling in their profile, a staff member appending a detail to it, and confirming both appear (correctly attributed) on the profile and on the user's next escalated ticket.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they edit their profile, **Then** they can save remote-access ID, location/desk, and hardware details, and the saved values are shown on their next visit.
2. **Given** a staff member viewing any user's profile, **When** they append a detail, **Then** the entry is saved with the staff member's identity and timestamp, and the user's own fields remain unchanged.
3. **Given** a user viewing their own profile, **When** staff-appended details exist, **Then** the user can see them and see that staff added them.
4. **Given** the profile form, **When** the user looks for fields to fill, **Then** only support-relevant fields are requested — no personal details unnecessary for IT support (data minimisation).
5. **Given** a profile updated moments before an escalation, **When** staff open the escalated ticket, **Then** the surfaced profile shows the latest values.

---

### User Story 5 - Bulk-Import Users from an Existing Excel File (Priority: P5)

A staff member imports the organisation's existing user records from an Excel file instead of waiting for every user to register and type their own details. During import, the staff member sees the spreadsheet's columns and chooses which column maps to which account/profile field (e.g. "Column C → location/desk"), previews the result, and applies it. Imported users receive sign-in credentials: their email from the sheet plus a set initial password they can change later in their settings.

**Why this priority**: A quality-of-life accelerator for onboarding many users at once; everything it produces can also be achieved manually through US3/US4, so it lands last.

**Independent Test**: Can be fully tested by importing a sample spreadsheet, adjusting one column mapping, applying it, and signing in as one of the imported users with the issued credentials.

**Acceptance Scenarios**:

1. **Given** a staff member with an Excel file of user details, **When** they start an import, **Then** they see the file's columns and can choose which column maps to which account/profile field before anything is applied.
2. **Given** a completed mapping, **When** the staff member previews the import, **Then** they see what will be created or updated and can correct the mapping before confirming.
3. **Given** a confirmed import, **When** it is applied, **Then** valid rows create accounts (email + set initial password) with populated profiles, rows matching an existing account update that profile, and every rejected row is reported with its reason.
4. **Given** an imported user, **When** they sign in with the issued credentials, **Then** they can use the system like any registered user and change their password in settings.

---

### Edge Cases

- What happens to tickets created before accounts existed (or by the seeded test flows)? They remain visible and workable on the staff dashboard, marked as having no linked account/profile.
- What happens when a staff member's role is revoked while they are signed in? Their next dashboard action is refused; they lose access without needing to sign out.
- What happens when two staff members act on the same ticket at nearly the same time? The second action is either safely applied or clearly rejected; the ticket never ends up in an inconsistent state, and both actions are attributed.
- What happens when a user tries to register with an already-used identifier? A clear, plain-language message; no account data leaks.
- What happens if a user asks the agent about their ticket while a staff member has taken it over? The conversation still reflects the human-involved handling mode honestly (IR FR-6); the agent does not pretend to be working the case.
- What happens when a user leaves their profile empty and never fills it? Everything still works; escalated tickets simply state no profile is on file.
- What happens when an import file contains duplicate emails, rows with missing required values, or an unreadable format? Duplicates within the file and invalid rows are rejected with per-row reasons; the rest of the import still applies; an unreadable file is refused with a clear message before any change is made.
- What happens when every staff member is Busy or Away? The picker still works — it lists everyone with their status and load and simply flags that no one is currently available; assignment remains possible because availability is advisory, not blocking.
- What happens when a staff member forgets to update their availability? Nothing breaks: availability only shapes the suggested default, and the open-case count still gives an honest load signal.
- Can the reporter see staff availability? No — reporters see only the display name of who is handling their ticket; availability and workload are staff-internal.
- What happens when a wrong column mapping is confirmed by mistake? The preview step is the guard; if bad data still lands, staff can correct profiles manually (US4), and a re-import with the fixed mapping updates the same accounts by email rather than duplicating them.
- What happens on the demo machine if the dashboard is open in one browser window and the chat in another? Both stay consistent — a change made in one is reflected in the other without manual refresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide user accounts with sign-up and sign-in, and exactly two roles: regular user and IT staff.
- **FR-002**: The staff role MUST NOT be self-assignable; it is granted only through an administrative/maintainer action.
- **FR-003**: Starting a new support conversation MUST require a signed-in account, so every new ticket is linked to its reporter's account.
- **FR-004**: The system MUST provide a web dashboard, accessible only to signed-in staff, listing all tickets with number, category, status, handling mode, reporter, and creation/last-update times, with filtering and sorting at least by status and category.
- **FR-005**: The dashboard MUST visually distinguish escalated tickets so staff can find urgent matters first.
- **FR-006**: The ticket detail view MUST show the complete conversation, the classified category, all attempted troubleshooting steps, and the status history — full handover context, so reporters never repeat themselves.
- **FR-007**: Staff MUST be able to take over any open ticket at any stage — escalation is the usual trigger, not a precondition (Principle III override authority). Takeover sets the handling mode to human-involved; staff MUST also be able to update ticket status and mark tickets resolved.
- **FR-008**: Every staff action on a ticket (takeover, status change, resolution, profile append) MUST be attributed to the acting staff member with a timestamp.
- **FR-009**: Any ticket change made from the dashboard MUST be reflected to the reporter in plain language in their conversation/ticket view without delay; any ticket change made in the chat MUST be reflected on the dashboard without a manual reload.
- **FR-010**: Signed-in users MUST be able to view a list of their own tickets with current status and handling mode; users MUST NOT be able to access tickets, conversations, or profiles belonging to others.
- **FR-011**: Signed-in users MUST be able to maintain a self-service support profile limited to support-relevant fields: remote-access ID(s) (e.g. TeamViewer/UltraViewer), location/desk, and hardware details.
- **FR-012**: Staff MUST be able to view any user's profile and append details in hybrid form: attributed free-text notes, and corrected values recorded alongside (never overwriting) the user's own field values. Staff-appended entries MUST be attributed, timestamped, visibly distinct from the user's own entries, and visible to the profile's owner.
- **FR-013**: When staff open an escalated ticket, the reporter's current profile MUST be displayed automatically on the ticket view; if none exists, the view MUST say so explicitly.
- **FR-014**: Tickets that predate accounts MUST remain visible and manageable on the dashboard, clearly marked as having no linked account.
- **FR-015**: The profile MUST NOT request or store personal details unnecessary for IT support, and profile access MUST be restricted to the profile's owner and staff (data minimisation, NFR-5).
- **FR-016**: Staff MUST be able to bulk-import user details from an existing Excel file, choosing during the import which spreadsheet column maps to which account/profile field, with a preview before applying; rejected rows MUST be reported with reasons, and rows matching an existing account (by email) MUST update that profile rather than duplicate it.
- **FR-017**: Accounts MUST support provisioned credentials: an account can be created (individually or via import) with an email and a set initial password, and every account holder MUST be able to change their own password in a settings area.
- **FR-018**: Staff MUST be able to see an account's credential status — whether it still uses the issued initial password or the holder has changed it — and to re-issue/reset an initial password; no one, staff included, can view a password the account holder typed. Credential re-issues are staff actions under FR-008 attribution.
- **FR-019**: A taken-over ticket MUST be reassignable to another staff member (attributed, with the full assignment history kept on the ticket); tickets are never handed back to automated agent handling once a human is involved.
- **FR-020**: The reporter MUST always be able to see, in plain language on their ticket/conversation view, the display name of the staff member currently handling their case, and MUST be informed without delay when that changes (extends IR FR-6 status visibility).
- **FR-021**: Each staff member MUST be able to set an availability status (Available / Busy / Away) visible to other staff; when assigning or reassigning, the picker MUST show every staff member's availability and current open-case count and suggest a default assignee (available, fewest active cases). The suggestion is advisory only — assignment always requires a human choice (NFR-4).

### Key Entities

- **User Account**: A person who can sign in; has an identifier, a display name, and a role (regular user or IT staff). Owns conversations, tickets, and one support profile. Staff accounts additionally carry an availability status (Available / Busy / Away).
- **Support Profile**: Support-relevant details for one account — remote-access ID(s), location/desk, hardware — plus zero or more staff-appended entries (each attributed and timestamped). Surfaced automatically on the owner's escalated tickets.
- **Ticket (existing, extended)**: Gains a link to the reporter's account (optional for legacy tickets), a current assignee once taken over, and an assignment history (who handled it, when, reassigned by whom).
- **Staff Action Record**: Attribution of each dashboard action — who, what, when, on which ticket or profile.
- **Profile Import**: One staff-initiated bulk import — the source spreadsheet, the staff-defined column-to-field mapping, and the per-row outcome (created / updated / rejected with reason).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member can go from opening the dashboard to acting on the most urgent escalated ticket (taken over, with full context and reporter profile on screen) in under 60 seconds.
- **SC-002**: For escalated tickets with a profile on file, staff need zero additional questions or searches to obtain the reporter's remote-access ID, location, or hardware details — the information is already on the ticket view in 100% of cases.
- **SC-003**: 100% of dashboard, ticket, and profile access attempts by non-authorised roles are refused, with no data exposed.
- **SC-004**: A ticket change made on either side (chat or dashboard) is visible on the other side within 5 seconds, without a manual reload.
- **SC-005**: A new user can register, sign in, and start a support conversation in under 2 minutes; a user can complete their support profile in under 2 minutes.
- **SC-006**: In a UAT walkthrough, a staff-role tester resolves an escalated ticket end-to-end on the first attempt without assistance.
- **SC-007**: A staff member can import a spreadsheet of 50 users — including adjusting the column mapping — in under 5 minutes, with every valid row producing a working account and profile and every rejected row individually explained.
- **SC-008**: At any moment after takeover, the reporter can answer "who is handling my case?" directly from their own ticket view, and after a reassignment the new name appears there within 5 seconds.

## Assumptions

- **Sign-in is the entry point for new conversations** (confirmed in clarification): starting a new support conversation requires an account (FR-003), so every ticket is owner-linked and profile surfacing is dependable. Existing pre-account tickets remain workable (FR-014).
- Simple credential-based sign-in managed by the system itself is sufficient for the isolated test environment; no external identity provider is required (NFR-7: no mandatory external infrastructure). Password/credential handling follows standard good practice.
- Staff accounts are provisioned by the maintainer (seeded or promoted via the existing admin/maintainer mechanism) with an email and a set initial password, changeable in settings (FR-017), consistent with FR-002.
- User accounts arise two ways: self-registration (FR-001) or staff bulk import (FR-016); both produce the same kind of account.
- 24/7 availability (IR FR-5) is unchanged: accounts gate identity, not availability, within the controlled test environment.
- The dashboard is part of the same web application users already use, served on the same demo machine; staff and user surfaces differ by role, not by separate deployments.
- Remote-access IDs are stored as reference information for staff, displayed on escalated tickets; this feature does not initiate or automate any remote-access session (automation remains feature 005's strictly whitelisted scope).
- The existing audit/attribution discipline (Constitution Principle II) extends to staff dashboard actions via the Staff Action Record; full audit-log browsing UI may be minimal in this feature and grow with feature 005.

## Dependencies

- Builds directly on the shipped foundation (tickets, conversations, escalation, status/handling-mode model, live status updates) from features 001–003.
- The escalation flow from features 001/003 is the producer of the escalated tickets this feature consumes.
- Constrained automated remediation (planned feature 005) is out of scope here; nothing in this feature executes actions on endpoints.
