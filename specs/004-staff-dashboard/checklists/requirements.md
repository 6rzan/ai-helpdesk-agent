# Specification Quality Checklist: Staff Dashboard & User Accounts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The one deliberate scope call is FR-003 (new conversations require sign-in). It is documented in Assumptions with the exact requirement to revisit via `/speckit-clarify` if the author wants to keep an anonymous chat path.
- Remote-access IDs are display-only reference data here; any automation stays in feature 005 (boundary stated in Assumptions and Dependencies).
- A companion `DESIGN-DIRECTION.md` (frontend-design-pro, plan mode) sits next to this spec for `/speckit-plan` to absorb; it contains the design/stack decisions intentionally kept out of the spec.

---

# Requirements Quality Checklist (post-plan review)

**Purpose**: "Unit tests" for the requirements text — completeness, clarity, consistency, and measurability of `spec.md`, reviewed against the planning artifacts. Focus areas: security/access control/credentials, and ticket lifecycle/assignment/real-time consistency.
**Created**: 2026-07-13 (appended by `/speckit-checklist`)
**Audience**: Reviewer, before `/speckit-tasks`
**Resolved**: 2026-07-13 — all 33 items closed via spec edits (8 requirements amended), verification against design artifacts, or documented exclusions in spec Assumptions. Cross-reference: `/speckit-analyze` findings A1–A5, U1–U2, C1.

## Requirement Completeness — Accounts, Sessions & Credentials

- [x] CHK001 Are session lifetime requirements (expiry, idle timeout, sign-out behaviour) specified anywhere, or only implied by the sign-in requirement? [Gap, Spec §FR-001]
  - Resolved: Assumptions now state rolling 7-day expiry and mid-conversation expiry behaviour.
- [x] CHK002 Is a password policy (minimum length/strength) specified as a requirement, rather than being decided silently at implementation time? [Gap, Spec §FR-017]
  - Resolved: FR-017 now requires ≥8 characters (matches data-model.md).
- [x] CHK003 Is it specified how provisioned initial passwords reach imported users (told in person, printed list, other channel), or is credential delivery out of scope and stated as such? [Gap, Spec §FR-016/FR-017]
  - Documented exclusion: delivery is out-of-band by staff (spec Assumptions).
- [x] CHK004 Are the effects of a staff-initiated password re-issue on the account holder's active sessions defined (invalidated immediately vs on next action)? [Gap, Spec §FR-018]
  - Verified: data-model.md (AuthSession) and contracts/api.md — change/reset invalidates all other sessions.
- [x] CHK005 Is brute-force / repeated-failed-login handling addressed, or intentionally excluded for the isolated test environment with that exclusion documented? [Gap, Coverage]
  - Documented exclusion: no lockout/rate limiting in the isolated test environment (spec Assumptions, NFR-3).
- [x] CHK006 Are account lifecycle requirements beyond creation (deactivation, offboarding an imported user, role revocation mechanics) documented or explicitly deferred? [Gap, Spec §FR-002]
  - Documented exclusion: no deactivation/offboarding this feature (spec Assumptions); role revocation effect already covered by the spec edge case.
- [x] CHK007 Is the "administrative/maintainer action" that grants the staff role defined precisely enough to be testable (who, via what mechanism), and does it avoid becoming an undeclared third role alongside the "exactly two roles" requirement? [Clarity/Consistency, Spec §FR-001/FR-002]
  - Resolved: Assumptions clarify maintainer = developer console/seed-script action, not an in-app role.

## Requirement Clarity — Ticket Lifecycle & Assignment

- [x] CHK008 Is "any open ticket" quantified — i.e., is the exact set of statuses eligible for takeover enumerated, and is takeover of a resolved/closed ticket explicitly ruled in or out? [Ambiguity, Spec §FR-007]
  - Resolved: FR-007 now defines takeover eligibility (not resolved/closed).
- [x] CHK009 Is "current open-case count" defined — which statuses count as an active case for load display and the suggested-assignee computation? [Ambiguity, Spec §FR-021]
  - Resolved: FR-021 now defines an active case (assigned, not resolved/closed).
- [x] CHK010 Are the ticket status values and allowed transitions staff can perform from the dashboard enumerated, or does "update ticket status" leave the permitted set implicit in the existing 001 state machine? [Clarity, Spec §FR-007]
  - Verified: staff status changes are explicitly routed through the existing 001 state machine (plan.md, data-model.md); the permitted set is inherited and tested in T016.
- [x] CHK011 Is "visually distinguished" for escalated tickets given at least one objective criterion (grouping, ordering, or marker) so US2 scenario 1 can be verified without taste judgement? [Measurability, Spec §FR-005]
  - Verified: plan.md Design Direction fixes the criterion (escalated tickets pinned in a distinct amber-marked group).
- [x] CHK012 After takeover, is the division of labour inside the conversation specified — does the agent still respond to the reporter's messages (and in what capacity), or does the conversation become staff-only? [Ambiguity, Spec §FR-019, Edge Cases]
  - Resolved: FR-019 now specifies post-takeover agent behaviour (status/handling-mode replies only, no troubleshooting; messages preserved for the assignee).
- [x] CHK013 Is reassignment scope fully specified: may staff reassign a ticket they do not currently hold, may they reassign to themselves, and is assignment-without-prior-takeover (direct assignment of an unassigned ticket) allowed? [Coverage/Ambiguity, Spec §FR-019/FR-021]
  - Resolved: FR-019 now states any staff member may reassign (attributed), and first assignment happens only via takeover.

## Requirement Consistency

- [x] CHK014 Do FR-009/FR-020's "without delay" and SC-004/SC-008's "within 5 seconds" refer to the same obligation, and is the 5-second bound the single authoritative number? [Consistency, Spec §FR-009/§SC-004]
  - Verified: same obligation; the 5-second bound in SC-004/SC-008 is the authoritative quantification.
- [x] CHK015 Is the retirement of the existing anonymous session entry (name-only start form) explicitly required by the sign-in mandate, including what happens to in-flight anonymous sessions at rollout? [Consistency/Gap, Spec §FR-003]
  - Resolved: Assumptions now document the FR-003 rollout (anonymous entry retired; legacy data workable via FR-014).
- [x] CHK016 Are legacy no-account tickets consistently handled across requirements — FR-014 covers the dashboard, but can the original session-based reporter still view them, and can they ever be linked to a later-created account? [Coverage/Gap, Spec §FR-010/FR-014]
  - Resolved: Assumptions state no retroactive linking in this feature; legacy tickets remain readable/workable under FR-014.
- [x] CHK017 Does FR-008's attribution requirement align with Constitution Principle II's immutability expectation — is it stated that staff action records cannot be edited or deleted? [Consistency, Spec §FR-008, Constitution §II]
  - Resolved: FR-008 now states records are append-only with no edit/delete path.
- [x] CHK018 Are the profile fields listed identically everywhere they appear (FR-011, FR-013, Key Entities, US2/US4), so "hardware details" and "remote-access ID(s)" cannot drift into different field sets per surface? [Consistency, Spec §FR-011/FR-013]
  - Verified: field set is identical across FR-011, FR-013, Key Entities, US2, US4 (remote-access ID(s), location/desk, hardware).

## Acceptance Criteria Quality

- [x] CHK019 Does SC-001's 60-second measurement define its starting state (signed in? dashboard already open? seeded data volume) so the timing is reproducible? [Measurability, Spec §SC-001]
  - Verified: quickstart US1/US2 walkthroughs define the starting state (signed-in staff, dashboard open, seeded data).
- [x] CHK020 Is the resource set behind SC-003's "100% of access attempts refused" enumerable from the requirements (dashboard, ticket detail, others' tickets, profiles, credential status, imports, staff events stream), so 100% coverage is testable rather than aspirational? [Measurability, Spec §SC-003]
  - Verified: data-model.md access-rules matrix + contracts/api.md enumerate the full protected resource set; T007/T016/T040/T048 test it.
- [x] CHK021 Do the timed criteria SC-005 and SC-007 define start/end boundaries (e.g., import timer starts at file selection or at upload?) precisely enough for a UAT stopwatch test? [Measurability, Spec §SC-005/§SC-007]
  - Verified: quickstart walkthroughs define the flows; import timed from upload to applied outcome report (SC-007).

## Scenario Coverage

- [x] CHK022 Are requirements defined for session expiry or sign-out occurring mid-conversation (does the chat lock, warn, or lose input)? [Coverage, Gap, Spec §FR-003]
  - Resolved: Assumptions define the behaviour (redirect to sign-in; conversation preserved server-side).
- [x] CHK023 Is the dual-role scenario addressed — a staff member who is also a reporter (can they take over or resolve their own ticket, and how is it attributed)? [Coverage, Gap, Spec §FR-007]
  - Resolved: Assumptions permit staff-as-reporter with normal attribution.
- [x] CHK024 Are requirements defined for what the reporter sees when their ticket is reassigned repeatedly in quick succession (final-name-wins vs every change announced)? [Coverage, Spec §FR-020]
  - Verified: FR-020 requires notice on every change; each reassignment emits its own event and conversation message.
- [x] CHK025 Is the behaviour specified when an import row maps a valid email but no initial-password column is mapped — generated password, rejected row, or mapping refused? [Gap, Spec §FR-016/FR-017]
  - Resolved: FR-016 now specifies generated initial passwords reported in per-row outcomes.
- [x] CHK026 Are email normalisation rules (case, whitespace) specified for both registration uniqueness and import matching-by-email, so the same address cannot create two accounts? [Edge Case, Spec §FR-001/FR-016]
  - Verified: data-model.md requires a case-insensitive unique email index; import upsert matches on the normalised email (research R3).

## Edge Case Coverage

- [x] CHK027 Are empty states specified as requirements — dashboard with zero tickets, roster with a single staff member (no colleague to suggest), user with zero tickets? [Edge Case, Gap, Spec §FR-004/FR-021]
  - Verified: Design Direction mandates teaching empty states; the all-busy roster edge case already covers the degenerate roster (lists everyone, flags none available).
- [x] CHK028 Are bounds defined for profile content (number of remote-access IDs, free-text length for hardware/notes) and for import files (max rows, accepted extensions — .xlsx only?), or are limits intentionally unstated? [Gap, Spec §FR-011/FR-016]
  - Verified: import bounded at 1000 rows, .xlsx only (data-model.md, research R3); field bounds are boundary-validation details set by zod per Constitution Principle VI, deliberately not spec-level.
- [x] CHK029 For the concurrent-action edge case, is the loser's experience specified beyond "safely applied or clearly rejected" — does the requirement say what the second staff member is shown (current assignee, retry path)? [Clarity, Edge Cases, Spec §US2-5]
  - Verified: contracts/api.md defines 409 with the current assignee returned to the losing staff member.
- [x] CHK030 Is availability-status persistence defined — default value for new staff, whether it survives sign-out/restart, and whether it ever resets automatically? [Gap, Spec §FR-021]
  - Verified: data-model.md defaults availability to Available, persisted on the account, never auto-reset; staleness is harmless because availability is advisory (spec edge case).

## Non-Functional Requirements Quality

- [x] CHK031 Does the data-minimisation requirement constrain staff-appended free-text notes (which may carry personal data) with any guidance or retention rule, or is the constraint limited to the user-editable fields? [Coverage, Spec §FR-012/FR-015, NFR-5]
  - Resolved: FR-012 now limits staff-appended content to support-relevant information (NFR-5 applies to notes as to fields).
- [x] CHK032 Are accessibility requirements (keyboard navigation, contrast, focus order) stated for the new dashboard and account surfaces anywhere in spec or plan, or only implied by the design direction? [Gap, Non-Functional]
  - Verified: plan.md Design Direction + task T062 carry WCAG AA contrast, keyboard navigation, and reduced-motion; intentionally held at plan level, not spec level.
- [x] CHK033 Is degraded-mode behaviour specified for the dashboard when the live-update channel is unavailable (stale list indicator, manual refresh affordance), given SC-004 assumes the channel works? [Coverage, Gap, Spec §FR-009/§SC-004]
  - Documented exclusion: manual browser refresh is the accepted fallback (spec Assumptions).

## Notes

- All 33 items closed on 2026-07-13: 12 resolved by spec edits, 16 verified against design artifacts (plan.md, data-model.md, contracts/api.md, quickstart.md), 5 recorded as deliberate exclusions in spec Assumptions.
- tasks.md remains valid unchanged: every edit refines wording inside requirements that already had task coverage (T033 now has a defined takeover precondition and active-case rule; T041/T043 have a defined post-takeover conversation contract; T057 has a defined no-password-column outcome).