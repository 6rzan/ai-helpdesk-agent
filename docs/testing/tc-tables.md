# Chapter 5 Test Case Traceability

| TC No. | Description | Suite | Status | Duration (ms) |
|---|---|---|---|---|
| AA-000 | routes are mounted only when MAINTAINER_KEY is configured (source-level guard, since config is a process-wide singleton) | backend/tests/integration/admin-guides-api.test.ts | Passed | 102.3 |
| AA-001 | 401 when x-maintainer-key is missing | backend/tests/integration/admin-guides-api.test.ts | Passed | 19.6 |
| AA-002 | 401 when x-maintainer-key is wrong | backend/tests/integration/admin-guides-api.test.ts | Passed | 24.0 |
| AA-003 | 400 when x-maintainer-name is missing | backend/tests/integration/admin-guides-api.test.ts | Passed | 18.5 |
| AA-004 | POST /admin/categories creates a category + guide v1 (201) | backend/tests/integration/admin-guides-api.test.ts | Passed | 15.6 |
| AA-005 | POST /admin/categories 409 on duplicate name | backend/tests/integration/admin-guides-api.test.ts | Passed | 12.7 |
| AA-006 | POST /admin/categories 422 on empty steps, previous content untouched | backend/tests/integration/admin-guides-api.test.ts | Passed | 16.9 |
| AA-007 | PUT /admin/categories/:name edits metadata only | backend/tests/integration/admin-guides-api.test.ts | Passed | 13.4 |
| AA-008 | DELETE /admin/categories/:name 403 MANDATED_CATEGORY_UNDELETABLE for the seeded six | backend/tests/integration/admin-guides-api.test.ts | Passed | 8.7 |
| AA-009 | DELETE /admin/categories/:name soft-retires a custom category | backend/tests/integration/admin-guides-api.test.ts | Passed | 14.0 |
| AA-010 | POST /admin/categories/:name/guide publishes version n+1 (201) | backend/tests/integration/admin-guides-api.test.ts | Passed | 12.8 |
| AA-011 | GET /admin/categories/:name/guide/versions returns full history with changedBy/changedAt | backend/tests/integration/admin-guides-api.test.ts | Passed | 17.1 |
| AA-012 | a zero-step guide is a count-level 422, not a step-level error | backend/tests/integration/admin-guides-api.test.ts | Passed | 9.1 |
| AA-013 | an over-maximum guide is a count-level 422 | backend/tests/integration/admin-guides-api.test.ts | Passed | 11.4 |
| AA-014 | a step missing its instruction names that step and field | backend/tests/integration/admin-guides-api.test.ts | Passed | 7.8 |
| AA-015 | a step missing its success hint names that step and field | backend/tests/integration/admin-guides-api.test.ts | Passed | 8.3 |
| AA-016 | a blank-string field is treated as missing, not as a short value | backend/tests/integration/admin-guides-api.test.ts | Passed | 7.7 |
| AA-017 | a too-short instruction is reported on its own step | backend/tests/integration/admin-guides-api.test.ts | Passed | 10.1 |
| AA-018 | an over-long success hint is reported on its own step | backend/tests/integration/admin-guides-api.test.ts | Passed | 8.6 |
| AA-019 | the first offending step is the one reported | backend/tests/integration/admin-guides-api.test.ts | Passed | 8.3 |
| AA-020 | a rejected guide publishes nothing | backend/tests/integration/admin-guides-api.test.ts | Passed | 15.9 |
| AA-021 | category creation reports step-level errors the same way | backend/tests/integration/admin-guides-api.test.ts | Passed | 13.4 |
| AC-001 | signed-out request to an authenticated route gets 401 with no data | backend/tests/integration/access-control.test.ts | Passed | 102.0 |
| AC-002 | regular user hitting a staff-only route gets 403 with no data | backend/tests/integration/access-control.test.ts | Passed | 68.3 |
| AC-003 | staff account passes both requireAuth and requireStaff | backend/tests/integration/access-control.test.ts | Passed | 38.9 |
| AC-004 | role revoked mid-session is refused on the very next request (per-request re-read) | backend/tests/integration/access-control.test.ts | Passed | 43.1 |
| AC-005 | a non-staff account is refused the staff profile read with no profile in the body | backend/tests/integration/access-control.test.ts | Passed | 67.3 |
| AC-006 | a non-staff account is refused the per-field save with no profile in the body | backend/tests/integration/access-control.test.ts | Passed | 67.7 |
| AC-007 | a non-staff account is refused the release with no profile in the body | backend/tests/integration/access-control.test.ts | Passed | 67.7 |
| AC-008 | a non-staff account is refused the field history with no history in the body | backend/tests/integration/access-control.test.ts | Passed | 67.7 |
| AC-009 | an account owner is refused the history for their own profile | backend/tests/integration/access-control.test.ts | Passed | 38.6 |
| AC-010 | every one of the four is 401 when signed out | backend/tests/integration/access-control.test.ts | Passed | 41.6 |
| AC-011 | a valid maintainer key reaches no /api/staff/* route | backend/tests/integration/access-control.test.ts | Passed | 41.6 |
| AC-012 | a valid maintainer key reaches no /api/my/* route | backend/tests/integration/access-control.test.ts | Passed | 7.9 |
| AC-013 | a signed-in account gets nothing extra from also sending a maintainer key | backend/tests/integration/access-control.test.ts | Passed | 67.6 |
| AC-014 | refuses a signed-out caller on /staff/accounts with 401 and no data | backend/tests/integration/access-control.test.ts | Passed | 6.8 |
| AC-015 | refuses a signed-in non-staff account with 403 and no data | backend/tests/integration/access-control.test.ts | Passed | 38.0 |
| AC-016 | refuses a non-staff account carrying a search term, without answering it | backend/tests/integration/access-control.test.ts | Passed | 39.0 |
| AC-017 | a staff account reaches the directory | backend/tests/integration/access-control.test.ts | Passed | 42.5 |
| AD-001 | carries exactly id, displayName, email and role | backend/tests/unit/account-directory-service.test.ts | Passed | 60.1 |
| AD-001 | lists display name, email and role | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 30.3 |
| AD-002 | never carries a password hash, salt, or availability | backend/tests/unit/account-directory-service.test.ts | Passed | 45.7 |
| AD-002 | shows nothing else about an account | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 31.4 |
| AD-003 | lists every account when no term is given | backend/tests/unit/account-directory-service.test.ts | Passed | 101.6 |
| AD-003 | narrows as the staff member types, with one request per pause | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 81.3 |
| AD-004 | includes staff accounts, because staff have profiles too | backend/tests/unit/account-directory-service.test.ts | Passed | 93.3 |
| AD-004 | names the term in a no-match state rather than showing an empty frame | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 40.5 |
| AD-005 | matches a display name case-insensitively | backend/tests/unit/account-directory-service.test.ts | Passed | 94.3 |
| AD-005 | the no-match line names the term that was searched, not what was typed after | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 43.2 |
| AD-006 | matches a substring rather than only a prefix | backend/tests/unit/account-directory-service.test.ts | Passed | 92.8 |
| AD-006 | an empty directory reads differently from a search that found nothing | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 29.8 |
| AD-007 | matches an email as well as a name | backend/tests/unit/account-directory-service.test.ts | Passed | 93.2 |
| AD-007 | opens the selected account's profile directly | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 21.0 |
| AD-008 | returns an empty list for no match rather than everything | backend/tests/unit/account-directory-service.test.ts | Passed | 96.4 |
| AD-008 | offers no bulk-selection affordance, including a disabled one | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 21.3 |
| AD-009 | treats a term as text, not as a pattern | backend/tests/unit/account-directory-service.test.ts | Passed | 93.1 |
| AD-009 | reports a failed load rather than showing an empty directory | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 20.7 |
| AD-010 | ignores surrounding whitespace on a term | backend/tests/unit/account-directory-service.test.ts | Passed | 92.9 |
| AD-010 | no rendered copy contains an em-dash | frontend/tests/pages/AccountDirectoryPage.test.tsx | Passed | 20.9 |
| AD-011 | treats a whitespace-only term as no term | backend/tests/unit/account-directory-service.test.ts | Passed | 91.8 |
| AD-012 | orders results by display name so the list does not reshuffle between searches | backend/tests/unit/account-directory-service.test.ts | Passed | 91.2 |
| AD-013 | reports the account id as a string the client can use in a URL | backend/tests/unit/account-directory-service.test.ts | Passed | 33.1 |
| AN-001 | signed out, the nav offers no route to the console | frontend/tests/components/AppNav.test.tsx | Passed | 1.2 |
| AN-002 | as a reporter, the nav offers no route to the console | frontend/tests/components/AppNav.test.tsx | Passed | 0.9 |
| AN-003 | as staff, the nav offers no route to the console | frontend/tests/components/AppNav.test.tsx | Passed | 1.3 |
| AN-004 | the console route is mounted outside AppLayout, so AppNav never renders inside it | frontend/tests/components/AppNav.test.tsx | Passed | 0.6 |
| CL-001 | shows display name, machine name, description, and active guide version | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 4.6 |
| CL-002 | says so plainly when a category has no guide yet | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 9.8 |
| CL-003 | a retired category stays visible and is marked retired | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 11.1 |
| CL-004 | a mandated category has no retire control at all — absent, not disabled | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 13.8 |
| CL-005 | a non-mandated category offers retire | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 8.5 |
| CL-006 | an already retired category offers no retire control | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 10.9 |
| CL-007 | the confirmation states the consequence before it is confirmed | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 18.2 |
| CL-008 | confirming sends the retire request; cancelling sends nothing | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 49.1 |
| CL-009 | a malformed machine name is reported on that field | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 29.5 |
| CL-010 | a malformed machine name blocks the request rather than failing after it | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 29.3 |
| CL-011 | a duplicate machine name is caught against the loaded list, before the request | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 32.7 |
| CL-012 | a refusal does not discard what was already typed | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 31.9 |
| CL-013 | a server-side duplicate lands on the machine-name field, not as a generic failure | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 31.5 |
| CL-014 | shows each version with who published it and when, and offers no way to change one | frontend/tests/pages/CategoryListPage.test.tsx | Passed | 23.8 |
| DC-001 | a category added via the admin API classifies a matching report and receives its own guide's step | backend/tests/integration/dynamic-category.test.ts | Passed | 113.9 |
| DC-002 | the mandated-six classification regression still passes after a new category is added | backend/tests/integration/dynamic-category.test.ts | Passed | 225.0 |
| FH-001 | is collapsed by default | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.8 |
| FH-002 | expands and collapses again on the same control | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 4.0 |
| FH-003 | the toggle names the region it controls | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 2.4 |
| FH-004 | fetches on first open only, not on every toggle | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.4 |
| FH-005 | does not refetch when the entries are already loaded | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.7 |
| FH-006 | shows a loading state while the history is on its way | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.6 |
| FH-007 | an empty history says so rather than showing an empty box | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.4 |
| FH-008 | renders entries newest first, in the order given | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 3.0 |
| FH-009 | a list field's previous value is rendered as a list, not a joined sentence | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 2.0 |
| FH-010 | an empty list value reads as empty rather than as a bare label | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.7 |
| FH-011 | an empty string value reads as empty | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.4 |
| FH-012 | a control entry says where control moved, not what the value was | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.8 |
| FH-013 | each entry carries who made the change and when | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.5 |
| FH-014 | an entry with no recorded actor says so rather than showing a blank | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.5 |
| FH-015 | offers no edit or delete affordance, including a disabled one | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.6 |
| FH-016 | no rendered copy contains an em-dash | frontend/tests/components/FieldHistoryDisclosure.test.tsx | Passed | 1.4 |
| FS-001 | sets the value, records who set it, and moves control to staff | backend/tests/unit/profile-field-service.test.ts | Passed | 49.3 |
| FS-002 | works on an account that has never had a profile | backend/tests/unit/profile-field-service.test.ts | Passed | 26.1 |
| FS-003 | leaves the fields it was not asked about alone | backend/tests/unit/profile-field-service.test.ts | Passed | 35.7 |
| FS-004 | takes the whole remote access list as one value | backend/tests/unit/profile-field-service.test.ts | Passed | 13.4 |
| FS-005 | a stale token refuses that field and carries what would have been overwritten | backend/tests/unit/profile-field-service.test.ts | Passed | 10.2 |
| FS-006 | a current token on one field and a stale token on another applies only the current one | backend/tests/unit/profile-field-service.test.ts | Passed | 15.8 |
| FS-007 | a conflict writes nothing at all for that field, including no history | backend/tests/unit/profile-field-service.test.ts | Passed | 19.8 |
| FS-008 | the token from the conflict response resolves it | backend/tests/unit/profile-field-service.test.ts | Passed | 12.5 |
| FS-009 | returns control to the owner and leaves the value and its author untouched | backend/tests/unit/profile-field-service.test.ts | Passed | 9.7 |
| FS-010 | refuses a release on a field the owner already controls | backend/tests/unit/profile-field-service.test.ts | Passed | 7.6 |
| FS-011 | releasing one field does not release another | backend/tests/unit/profile-field-service.test.ts | Passed | 9.8 |
| FS-012 | applies an owner-controlled field and records the owner as its author | backend/tests/unit/profile-field-service.test.ts | Passed | 9.4 |
| FS-013 | refuses a staff-controlled field with who set it and when | backend/tests/unit/profile-field-service.test.ts | Passed | 8.1 |
| FS-014 | applies the fields the owner still controls in the same request | backend/tests/unit/profile-field-service.test.ts | Passed | 10.3 |
| FS-015 | an owner write never moves control, so it cannot take a field back | backend/tests/unit/profile-field-service.test.ts | Passed | 11.0 |
| FS-016 | a staff write over an owner-controlled field appends both a value and a control entry | backend/tests/unit/profile-field-service.test.ts | Passed | 10.9 |
| FS-017 | a second staff write on an already staff-controlled field appends only a value entry | backend/tests/unit/profile-field-service.test.ts | Passed | 11.1 |
| FS-018 | set then release then set records three control transfers, newest first | backend/tests/unit/profile-field-service.test.ts | Passed | 12.9 |
| FS-019 | a value entry records what the field held before, not what it became | backend/tests/unit/profile-field-service.test.ts | Passed | 8.8 |
| FS-020 | clearing a field preserves the value it held | backend/tests/unit/profile-field-service.test.ts | Passed | 8.7 |
| FS-021 | a cleared list field preserves its entries | backend/tests/unit/profile-field-service.test.ts | Passed | 10.4 |
| FS-022 | an owner write appends a value entry even though the owner cannot read it back | backend/tests/unit/profile-field-service.test.ts | Passed | 6.8 |
| FS-023 | history is scoped to one field | backend/tests/unit/profile-field-service.test.ts | Passed | 8.7 |
| FS-024 | a pre-feature correction never appears in history | backend/tests/unit/profile-field-service.test.ts | Passed | 5.4 |
| GC-001 | a network report receives only its own category's step, never another category's | backend/tests/integration/guided-categories.test.ts | Passed | 148.4 |
| GC-001 | a printer report receives only its own category's step, never another category's | backend/tests/integration/guided-categories.test.ts | Passed | 57.7 |
| GC-001 | a peripherals report receives only its own category's step, never another category's | backend/tests/integration/guided-categories.test.ts | Passed | 59.8 |
| GC-001 | a performance report receives only its own category's step, never another category's | backend/tests/integration/guided-categories.test.ts | Passed | 44.1 |
| GC-001 | a service_status report receives only its own category's step, never another category's | backend/tests/integration/guided-categories.test.ts | Passed | 47.7 |
| GC-002 | a network report can end resolved | backend/tests/integration/guided-categories.test.ts | Passed | 264.5 |
| GC-003 | a printer report can end escalated after its single step doesn't help | backend/tests/integration/guided-categories.test.ts | Passed | 78.7 |
| GE-001 | not_worked on the last step escalates with the outcome attached (FR-007) | backend/tests/unit/guidance-escalation.test.ts | Passed | 0.1 |
| GE-001 | starts with one step and numbers steps the way a person counts | frontend/tests/pages/GuideEditor.test.tsx | Passed | 2.1 |
| GE-002 | already_tried on the last step escalates with the outcome attached (FR-007) | backend/tests/unit/guidance-escalation.test.ts | Passed | 0.0 |
| GE-002 | adding and removing steps renumbers the rest | frontend/tests/pages/GuideEditor.test.tsx | Passed | 20.5 |
| GE-003 | wants_human escalates immediately at any step, with no attemptOutcome (partial record — FR-008) | backend/tests/unit/guidance-escalation.test.ts | Passed | 0.1 |
| GE-003 | the last remaining step cannot be removed | frontend/tests/pages/GuideEditor.test.tsx | Passed | 3.8 |
| GE-004 | endSession moves a session to a terminal state and it is never mutated further by the pure decision function | backend/tests/unit/guidance-escalation.test.ts | Passed | 0.2 |
| GE-004 | reordering moves the step and its text together | frontend/tests/pages/GuideEditor.test.tsx | Passed | 13.3 |
| GE-005 | endSession records the abandoned terminal state used when a different problem is reported mid-guide (spec edge case) | backend/tests/unit/guidance-escalation.test.ts | Passed | 0.1 |
| GE-005 | says what publishing does to the active version | frontend/tests/pages/GuideEditor.test.tsx | Passed | 1.7 |
| GE-006 | a first guide is described as version 1, not as replacing something | frontend/tests/pages/GuideEditor.test.tsx | Passed | 1.2 |
| GE-007 | publishes the steps in order with the change note | frontend/tests/pages/GuideEditor.test.tsx | Passed | 18.5 |
| GE-008 | the message appears under the offending instruction | frontend/tests/pages/GuideEditor.test.tsx | Passed | 12.9 |
| GE-009 | a success-hint failure lands on the hint, not the instruction | frontend/tests/pages/GuideEditor.test.tsx | Passed | 7.2 |
| GE-010 | only one step is marked — the others are not implicated | frontend/tests/pages/GuideEditor.test.tsx | Passed | 17.7 |
| GE-011 | a refusal discards nothing that was typed | frontend/tests/pages/GuideEditor.test.tsx | Passed | 23.7 |
| GE-012 | editing the offending step clears its message | frontend/tests/pages/GuideEditor.test.tsx | Passed | 9.8 |
| GE-013 | publishing again after a fix is allowed — the button is not left disabled | frontend/tests/pages/GuideEditor.test.tsx | Passed | 10.3 |
| GE-014 | an error with no step index goes to the caller, not onto a step | frontend/tests/pages/GuideEditor.test.tsx | Passed | 9.6 |
| GE-015 | the step maximum is mirrored as guidance, and publishing is never blocked locally on step content | frontend/tests/pages/GuideEditor.test.tsx | Passed | 242.7 |
| GF-001 | classification + ticket + Step 1 land in one reply, then advance and resolve, recording both attempts | backend/tests/integration/guided-flow-resolution.test.ts | Passed | 422.4 |
| GF-002 | re-reporting the same problem after resolution starts a fresh session on a new ticket, while the prior attempt record stays visible in history | backend/tests/integration/guided-flow-resolution.test.ts | Passed | 358.7 |
| GG-001 | a classified category with no active guide escalates immediately and never presents a step | backend/tests/integration/guidance-guard.test.ts | Passed | 106.8 |
| GG-002 | a vague, low-confidence report is asked for clarification and never presents guide steps from any category | backend/tests/integration/guidance-guard.test.ts | Passed | 231.4 |
| GR-001 | currentStepIndex and guide content are read fresh from MongoDB after the DB connection cycles, not held in server memory | backend/tests/integration/guided-session-resume.test.ts | Passed | 347.8 |
| GT-001 | worked resolves the session | backend/tests/unit/guidance-service.test.ts | Passed | 0.1 |
| GT-002 | not_worked advances to the next step when steps remain | backend/tests/unit/guidance-service.test.ts | Passed | 0.1 |
| GT-003 | not_worked on the last step escalates instead of advancing | backend/tests/unit/guidance-service.test.ts | Passed | 0.0 |
| GT-004 | already_tried records the attempt and advances like not_worked | backend/tests/unit/guidance-service.test.ts | Passed | 0.1 |
| GT-005 | already_tried on the last step escalates | backend/tests/unit/guidance-service.test.ts | Passed | 0.0 |
| GT-006 | wants_human escalates immediately | backend/tests/unit/guidance-service.test.ts | Passed | 0.0 |
| GT-007 | question holds on the current step | backend/tests/unit/guidance-service.test.ts | Passed | 0.0 |
| GT-008 | unclear holds on the current step (FR-013 clarify, do not advance) | backend/tests/unit/guidance-service.test.ts | Passed | 0.0 |
| GT-009 | advisory-only guard — the module imports no executor/command modules | backend/tests/unit/guidance-service.test.ts | Passed | 0.3 |
| IS-001 | accepts a valid step-reply payload | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.1 |
| IS-002 | accepts outcome worked | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.1 |
| IS-002 | accepts outcome not_worked | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.0 |
| IS-002 | accepts outcome already_tried | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.0 |
| IS-002 | accepts outcome question | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.0 |
| IS-002 | accepts outcome wants_human | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.0 |
| IS-002 | accepts outcome unclear | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.0 |
| IS-003 | rejects an outcome outside the enum | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.1 |
| IS-004 | rejects an out-of-range confidence | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.1 |
| IS-005 | rejects an empty reply | backend/tests/unit/interpret-step-reply.test.ts | Passed | 0.1 |
| LP-001 | treats loopback hosts as local so LLM_API_KEY stays optional | backend/tests/unit/llm-base-url.test.ts | Passed | 0.1 |
| LP-002 | treats host.docker.internal as local for containerised backends | backend/tests/unit/llm-base-url.test.ts | Passed | 0.0 |
| LP-003 | requires a key for remote providers | backend/tests/unit/llm-base-url.test.ts | Passed | 0.0 |
| LP-004 | matches the hostname exactly, so a lookalike domain stays remote | backend/tests/unit/llm-base-url.test.ts | Passed | 0.0 |
| LP-005 | accepts absolute http(s) URLs, including an IPv6 literal | backend/tests/unit/llm-base-url.test.ts | Passed | 0.1 |
| LP-006 | accepts an unset value so the provider falls back to its default | backend/tests/unit/llm-base-url.test.ts | Passed | 0.0 |
| LP-007 | rejects a missing scheme rather than reporting it as a missing API key | backend/tests/unit/llm-base-url.test.ts | Passed | 0.2 |
| LP-008 | rejects non-http schemes and free text | backend/tests/unit/llm-base-url.test.ts | Passed | 0.1 |
| MC-001 | renders no sign-in form at all when administration is off | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 8.0 |
| MC-002 | the switched-off message never suggests the key was wrong | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 9.3 |
| MC-003 | renders the sign-in form when administration is on | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 11.4 |
| MC-004 | a wrong key gets one fixed message with no hint about the key itself | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.3 |
| MC-005 | a cooling-off refusal reads differently from a wrong key | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.9 |
| MC-006 | the cooling-off duration comes from the server, not a hardcoded number | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.1 |
| MC-007 | submitting is unavailable while cooling off | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 15.9 |
| MC-008 | a throttled response with no duration still says the pause is temporary | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.1 |
| MC-009 | an unreachable server is not reported as a wrong key | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 23.0 |
| MC-010 | a rotated key returns to sign-in with an explanation, not a dead screen | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 21.8 |
| MC-011 | a rotated key is discarded from the field, not left for a retry | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.5 |
| MC-012 | administration switched off mid-session renders the switched-off state | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 19.9 |
| MC-013 | signing in writes the key to no storage and no cookie | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 23.9 |
| MC-014 | a reload starts signed out — there is nowhere for the key to have survived | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 28.1 |
| MC-015 | signing out clears the field and returns to sign-in without a refusal message | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 30.8 |
| MC-016 | the maintainer's name is sent as a header, never the key in a URL | frontend/tests/pages/MaintainerConsolePage.test.tsx | Passed | 20.9 |
| MS-001 | a correct key and name succeeds | backend/tests/integration/maintainer-signin.test.ts | Passed | 62.1 |
| MS-002 | a wrong key returns 401 MAINTAINER_KEY_INVALID | backend/tests/integration/maintainer-signin.test.ts | Passed | 23.4 |
| MS-003 | the 401 message is byte-identical for keys of different lengths and shapes (FR-004) | backend/tests/integration/maintainer-signin.test.ts | Passed | 53.8 |
| MS-004 | a blank name returns 400 MAINTAINER_NAME_REQUIRED | backend/tests/integration/maintainer-signin.test.ts | Passed | 10.7 |
| MS-005 | the configured number of refusals then returns 429 with retryAfterSeconds | backend/tests/integration/maintainer-signin.test.ts | Passed | 21.1 |
| MS-006 | the 429 is returned before the key is compared, so it is not an oracle | backend/tests/integration/maintainer-signin.test.ts | Passed | 24.5 |
| MS-007 | a blank name is also refused with 429 while cooling off, before any name check | backend/tests/integration/maintainer-signin.test.ts | Passed | 23.0 |
| MS-008 | one MaintainerSignInAttempt exists per refused attempt | backend/tests/integration/maintainer-signin.test.ts | Passed | 14.9 |
| MS-009 | a successful sign-in records no attempt | backend/tests/integration/maintainer-signin.test.ts | Passed | 12.2 |
| MS-010 | a blank-name refusal is recorded as a refusal too | backend/tests/integration/maintainer-signin.test.ts | Passed | 8.7 |
| MS-011 | no document anywhere contains the submitted key (FR-035) | backend/tests/integration/maintainer-signin.test.ts | Passed | 19.6 |
| MS-012 | no response body or header echoes the submitted key | backend/tests/integration/maintainer-signin.test.ts | Passed | 8.3 |
| MS-013 | the window clears once the oldest refusals age out | backend/tests/integration/maintainer-signin.test.ts | Passed | 10.5 |
| MST-001 | returns 200 {"enabled":true} with MAINTAINER_KEY set | backend/tests/integration/maintainer-status.test.ts | Passed | 51.7 |
| MST-002 | returns 200 {"enabled":false} with MAINTAINER_KEY unset | backend/tests/integration/maintainer-status.test.ts | Passed | 20.6 |
| MST-003 | is mounted with the key unset — 200, never 404 | backend/tests/integration/maintainer-status.test.ts | Passed | 18.1 |
| MST-004 | the mount is unconditional in app.ts, not inside the MAINTAINER_KEY guard | backend/tests/integration/maintainer-status.test.ts | Passed | 11.8 |
| MST-005 | requires no authentication | backend/tests/integration/maintainer-status.test.ts | Passed | 16.1 |
| MST-006 | a wrong maintainer key does not change the answer | backend/tests/integration/maintainer-status.test.ts | Passed | 8.1 |
| MST-007 | discloses nothing beyond the boolean | backend/tests/integration/maintainer-status.test.ts | Passed | 6.9 |
| PC-001 | names who set the value and when | frontend/tests/lib/profileCopy.test.ts | Passed | 0.3 |
| PC-002 | keeps the author's name as written, with no case folding | frontend/tests/lib/profileCopy.test.ts | Passed | 0.2 |
| PC-003 | a pre-feature value says there is no record rather than rendering an empty byline | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-004 | formats a time without leaking an ISO string to a reader | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-005 | a conflict with no recorded author still reads as a sentence | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-006 | a conflict message says the typed text is kept | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-007 | answers both why it is locked and how to get it changed | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-008 | the all-locked page still says what the page is for | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-009 | a save refused by a lock explains what happened rather than dropping the value | frontend/tests/lib/profileCopy.test.ts | Passed | 0.1 |
| PC-010 | owner-facing copy uses no internal vocabulary (NFR-2) | frontend/tests/lib/profileCopy.test.ts | Passed | 0.2 |
| PC-011 | no rendered string carries an em-dash (Design Direction) | frontend/tests/lib/profileCopy.test.ts | Passed | 0.3 |
| PC-012 | no other source file hardcodes the locked-field sentence or the byline prefix | frontend/tests/lib/profileCopy.test.ts | Passed | 0.4 |
| PF-001 | a first save on a never-set field applies with expectedSetAt null | backend/tests/integration/profile-field-conflict.test.ts | Passed | 144.0 |
| PF-001 | labels the control, with the label above it | frontend/tests/components/ProfileField.test.tsx | Passed | 1.5 |
| PF-002 | the second of two saves applies the current field and refuses only the stale one | backend/tests/integration/profile-field-conflict.test.ts | Passed | 118.8 |
| PF-002 | an owner-controlled field renders its editable control for the owner | frontend/tests/components/ProfileField.test.tsx | Passed | 0.7 |
| PF-003 | a conflict carries the current value, author, and time so the loser can see what they would have overwritten | backend/tests/integration/profile-field-conflict.test.ts | Passed | 116.9 |
| PF-003 | a staff-controlled field is read-only text for the owner, never an input | frontend/tests/components/ProfileField.test.tsx | Passed | 0.6 |
| PF-004 | a refused field is not written, and the applied field is | backend/tests/integration/profile-field-conflict.test.ts | Passed | 123.2 |
| PF-004 | a locked field is never a disabled input (FR-022, Design Direction) | frontend/tests/components/ProfileField.test.tsx | Passed | 0.5 |
| PF-005 | the returned profile is the profile as it now stands, not the submitted values | backend/tests/integration/profile-field-conflict.test.ts | Passed | 111.5 |
| PF-005 | a lock is neutral, never amber or red | frontend/tests/components/ProfileField.test.tsx | Passed | 0.5 |
| PF-006 | expectedSetAt null on a field that has since been set is refused | backend/tests/integration/profile-field-conflict.test.ts | Passed | 106.5 |
| PF-006 | provenance is a muted byline, not a badge | frontend/tests/components/ProfileField.test.tsx | Passed | 0.6 |
| PF-007 | the remote access list is one field, so a stale token refuses the whole list | backend/tests/integration/profile-field-conflict.test.ts | Passed | 109.6 |
| PF-007 | a field with no recorded authorship says so rather than showing nothing | frontend/tests/components/ProfileField.test.tsx | Passed | 0.4 |
| PF-008 | the action record lists only the applied field (FR-026) | backend/tests/integration/profile-field-conflict.test.ts | Passed | 116.9 |
| PF-008 | an undefined state is treated as owner-controlled | frontend/tests/components/ProfileField.test.tsx | Passed | 0.5 |
| PF-009 | a save where every field conflicts writes no action record at all | backend/tests/integration/profile-field-conflict.test.ts | Passed | 108.2 |
| PF-009 | staff see who controls the field | frontend/tests/components/ProfileField.test.tsx | Passed | 0.9 |
| PF-010 | re-saving with the token from the conflict response succeeds | backend/tests/integration/profile-field-conflict.test.ts | Passed | 116.6 |
| PF-010 | the owner never sees the staff control notes | frontend/tests/components/ProfileField.test.tsx | Passed | 0.5 |
| PF-011 | staff can edit a staff-controlled field | frontend/tests/components/ProfileField.test.tsx | Passed | 0.6 |
| PF-012 | release is offered only on a staff-controlled field | frontend/tests/components/ProfileField.test.tsx | Passed | 2.0 |
| PF-013 | the owner is never offered release | frontend/tests/components/ProfileField.test.tsx | Passed | 0.7 |
| PF-014 | an applied outcome is announced as a status, per field | frontend/tests/components/ProfileField.test.tsx | Passed | 1.0 |
| PF-015 | a conflict explains what happened and keeps the typed value | frontend/tests/components/ProfileField.test.tsx | Passed | 1.1 |
| PF-016 | a locked-on-save outcome is explained neutrally | frontend/tests/components/ProfileField.test.tsx | Passed | 1.0 |
| PF-017 | history is rendered only where the caller passes it | frontend/tests/components/ProfileField.test.tsx | Passed | 1.1 |
| PF-018 | no rendered copy contains an em-dash | frontend/tests/components/ProfileField.test.tsx | Passed | 0.7 |
| PH-001 | records a value change with what the value was before, not what it became | backend/tests/unit/profile-field-history-model.test.ts | Passed | 131.8 |
| PH-002 | a list field's previous value keeps its structure | backend/tests/unit/profile-field-history-model.test.ts | Passed | 13.6 |
| PH-003 | records a control transfer with no value change | backend/tests/unit/profile-field-history-model.test.ts | Passed | 22.2 |
| PH-004 | stores the actor's name alongside the id rather than joining at read time | backend/tests/unit/profile-field-history-model.test.ts | Passed | 13.6 |
| PH-005 | an owner-attributed entry needs no actor id | backend/tests/unit/profile-field-history-model.test.ts | Passed | 7.9 |
| PH-006 | refuses an unknown field, so a fourth profile field cannot appear here first | backend/tests/unit/profile-field-history-model.test.ts | Passed | 7.9 |
| PH-007 | refuses an unknown change kind | backend/tests/unit/profile-field-history-model.test.ts | Passed | 4.2 |
| PH-008 | reads one field's history newest first without touching another field's | backend/tests/unit/profile-field-history-model.test.ts | Passed | 4.7 |
| PH-009 | the model exports no way to change or remove an entry | backend/tests/unit/profile-field-history-model.test.ts | Passed | 3.7 |
| PN-001 | shows the same values the profile pages show | frontend/tests/components/ProfilePanel.test.tsx | Passed | 2.2 |
| PN-002 | carries one byline per field, in the shared wording | frontend/tests/components/ProfilePanel.test.tsx | Passed | 1.5 |
| PN-003 | places the byline directly under its value, muted | frontend/tests/components/ProfilePanel.test.tsx | Passed | 1.3 |
| PN-004 | gives the remote access list one byline, not one per entry | frontend/tests/components/ProfilePanel.test.tsx | Passed | 1.3 |
| PN-005 | says when nobody is recorded as having set a value | frontend/tests/components/ProfilePanel.test.tsx | Passed | 1.0 |
| PN-006 | a response with no field state carries no byline rather than an invented one | frontend/tests/components/ProfilePanel.test.tsx | Passed | 0.8 |
| PN-007 | renders a pre-feature correction as an earlier note, not as a badge | frontend/tests/components/ProfilePanel.test.tsx | Passed | 2.3 |
| PN-008 | keeps its empty state when no profile is on file | frontend/tests/components/ProfilePanel.test.tsx | Passed | 0.6 |
| PN-009 | no rendered copy contains an em-dash | frontend/tests/components/ProfilePanel.test.tsx | Passed | 1.6 |
| PP-001 | saves support-relevant fields and renders attributed staff entries | frontend/tests/pages/ProfilePage.test.tsx | Passed | 21.4 |
| PP-002 | preserves multiple labelled remote-access IDs through save and reload | frontend/tests/pages/ProfilePage.test.tsx | Passed | 21.0 |
| PP-003 | removes one remote-access ID without collapsing the remaining entries | frontend/tests/pages/ProfilePage.test.tsx | Passed | 16.7 |
| PP-004 | every field shows who set it and when | frontend/tests/pages/ProfilePage.test.tsx | Passed | 4.1 |
| PP-005 | a staff-controlled field is read-only text with the explanation on the field | frontend/tests/pages/ProfilePage.test.tsx | Passed | 11.0 |
| PP-006 | a locked field is never a disabled input and is never coloured as a warning | frontend/tests/pages/ProfilePage.test.tsx | Passed | 10.9 |
| PP-007 | fields the owner still controls stay editable exactly as before | frontend/tests/pages/ProfilePage.test.tsx | Passed | 9.6 |
| PP-008 | a locked field is not submitted, so a standing lock is not reported as a new failure | frontend/tests/pages/ProfilePage.test.tsx | Passed | 14.6 |
| PP-009 | a field locked while the page was open is explained, not silently discarded | frontend/tests/pages/ProfilePage.test.tsx | Passed | 13.1 |
| PP-010 | an all-locked page still explains what it is for and how to get a value corrected | frontend/tests/pages/ProfilePage.test.tsx | Passed | 3.5 |
| PP-011 | no field-history affordance appears anywhere, not even collapsed or disabled | frontend/tests/pages/ProfilePage.test.tsx | Passed | 10.8 |
| PP-012 | a profile with no recorded authorship says so rather than showing nothing | frontend/tests/pages/ProfilePage.test.tsx | Passed | 9.9 |
| PP-013 | a pre-feature profile with no field state stays fully editable | frontend/tests/pages/ProfilePage.test.tsx | Passed | 12.2 |
| SA-001 | returns every account to a staff caller | backend/tests/integration/staff-accounts.test.ts | Passed | 117.9 |
| SA-002 | carries exactly the four directory attributes | backend/tests/integration/staff-accounts.test.ts | Passed | 99.6 |
| SA-003 | never leaks credential material or availability | backend/tests/integration/staff-accounts.test.ts | Passed | 98.4 |
| SA-004 | filters on a display name, case-insensitively | backend/tests/integration/staff-accounts.test.ts | Passed | 99.5 |
| SA-005 | filters on an email as well | backend/tests/integration/staff-accounts.test.ts | Passed | 97.1 |
| SA-006 | answers no match with 200 and an empty array, not 404 | backend/tests/integration/staff-accounts.test.ts | Passed | 97.8 |
| SA-007 | refuses a search term over 120 characters | backend/tests/integration/staff-accounts.test.ts | Passed | 97.7 |
| SA-007a | validates profile_edit, which names only the fields that were applied | backend/tests/unit/staff-action-model.test.ts | Passed | 9.8 |
| SA-007b | validates profile_release against the profile target | backend/tests/unit/staff-action-model.test.ts | Passed | 4.2 |
| SA-007c | profile_append is unchanged and still available for notes | backend/tests/unit/staff-action-model.test.ts | Passed | 7.3 |
| SA-008 | accepts a term of exactly 120 characters | backend/tests/integration/staff-accounts.test.ts | Passed | 99.2 |
| SA-009 | treats a term as text rather than as a pattern | backend/tests/integration/staff-accounts.test.ts | Passed | 96.7 |
| SA-010 | an account id in the response opens that account's profile | backend/tests/integration/staff-accounts.test.ts | Passed | 104.0 |
| SA-011 | refuses a signed-out caller with 401 and no data | backend/tests/integration/staff-accounts.test.ts | Passed | 93.1 |
| SA-012 | refuses a signed-in non-staff account with 403 and no data | backend/tests/integration/staff-accounts.test.ts | Passed | 123.5 |
| SP-001 | a pre-feature document still reads its values back unchanged | backend/tests/unit/support-profile-field-state.test.ts | Passed | 107.5 |
| SP-002 | a pre-feature document's fields read as owner-controlled with no recorded author | backend/tests/unit/support-profile-field-state.test.ts | Passed | 15.7 |
| SP-003 | a pre-feature correction stays a staff entry and does not become a value | backend/tests/unit/support-profile-field-state.test.ts | Passed | 14.0 |
| SP-004 | a new document defaults every field to owner control | backend/tests/unit/support-profile-field-state.test.ts | Passed | 14.1 |
| SP-005 | a field can be recorded as staff-controlled with its author and time | backend/tests/unit/support-profile-field-state.test.ts | Passed | 8.0 |
| SP-006 | fieldState holds these three fields and no fourth (FR-028) | backend/tests/unit/support-profile-field-state.test.ts | Passed | 5.7 |
| SP-007 | an unknown controlledBy value is refused | backend/tests/unit/support-profile-field-state.test.ts | Passed | 4.1 |
| SPF-001 | an account with no profile yet reads as empty and fully owner-controlled | backend/tests/integration/staff-profile-fields.test.ts | Passed | 111.0 |
| SPF-002 | the profile read carries no field history | backend/tests/integration/staff-profile-fields.test.ts | Passed | 99.6 |
| SPF-003 | a staff-set value becomes the profile's value with its author and time | backend/tests/integration/staff-profile-fields.test.ts | Passed | 75.3 |
| SPF-004 | works on an account that has never had a profile | backend/tests/integration/staff-profile-fields.test.ts | Passed | 76.0 |
| SPF-005 | the remote access list is set as one field | backend/tests/integration/staff-profile-fields.test.ts | Passed | 76.7 |
| SPF-006 | one StaffActionRecord per save, naming the applied fields | backend/tests/integration/staff-profile-fields.test.ts | Passed | 76.0 |
| SPF-007 | a staff member editing their own profile through this surface is permitted and recorded identically | backend/tests/integration/staff-profile-fields.test.ts | Passed | 44.5 |
| SPF-008 | an unknown account is 404 | backend/tests/integration/staff-profile-fields.test.ts | Passed | 42.0 |
| SPF-009 | an unknown field name is refused, naming it | backend/tests/integration/staff-profile-fields.test.ts | Passed | 70.7 |
| SPF-010 | an over-long location is refused, naming the field | backend/tests/integration/staff-profile-fields.test.ts | Passed | 69.5 |
| SPF-011 | an over-long hardware value is refused | backend/tests/integration/staff-profile-fields.test.ts | Passed | 68.6 |
| SPF-012 | more than ten remote entries is refused | backend/tests/integration/staff-profile-fields.test.ts | Passed | 69.9 |
| SPF-013 | a half-filled remote entry is refused with its index | backend/tests/integration/staff-profile-fields.test.ts | Passed | 70.8 |
| SPF-014 | an empty fields object is refused | backend/tests/integration/staff-profile-fields.test.ts | Passed | 69.6 |
| SPF-015 | a malformed second field leaves the first one unwritten | backend/tests/integration/staff-profile-fields.test.ts | Passed | 75.1 |
| SPF-016 | returns the field to the owner, leaving the value and its author alone | backend/tests/integration/staff-profile-fields.test.ts | Passed | 81.2 |
| SPF-017 | releasing an owner-controlled field is a 409 | backend/tests/integration/staff-profile-fields.test.ts | Passed | 71.4 |
| SPF-018 | an unknown field name is a 400 | backend/tests/integration/staff-profile-fields.test.ts | Passed | 69.6 |
| SPF-019 | a release writes one StaffActionRecord naming the field | backend/tests/integration/staff-profile-fields.test.ts | Passed | 85.1 |
| SPF-020 | a released field can be edited by the owner again (SC-010) | backend/tests/integration/staff-profile-fields.test.ts | Passed | 88.0 |
| SPF-021 | returns the field's history newest first | backend/tests/integration/staff-profile-fields.test.ts | Passed | 87.1 |
| SPF-022 | an account with no history reads as an empty list, not a 404 | backend/tests/integration/staff-profile-fields.test.ts | Passed | 70.0 |
| SPF-023 | history is scoped to the field asked for | backend/tests/integration/staff-profile-fields.test.ts | Passed | 78.9 |
| SPF-024 | there is no owner-facing route that returns history (FR-018) | backend/tests/integration/staff-profile-fields.test.ts | Passed | 37.4 |
| TC-000 | boots the app against an in-memory Mongo and reports healthy | backend/tests/helpers/test-app.smoke.test.ts | Passed | 3.3 |
| TC-001 | wires the mock LLM provider into the factory | backend/tests/helpers/test-app.smoke.test.ts | Passed | 0.1 |
| TC-002 | refuses conversation creation without an authenticated account | backend/tests/integration/sessions.test.ts | Passed | 100.2 |
| TC-003 | creates an account-linked session | backend/tests/integration/sessions.test.ts | Passed | 72.0 |
| TC-004 | a returning account gets a new conversation and its own open tickets | backend/tests/integration/sessions.test.ts | Passed | 48.9 |
| TC-006 | accepts a valid classification payload | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-007 | rejects an empty category (legitimacy is checked at runtime against the categories collection, not by this schema — R2) | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-008 | rejects an out-of-range confidence | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-009 | returns classified when confidence is at or above the threshold | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-010 | returns needs_clarification when confidence is below the threshold | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-011 | returns llm_unavailable when the provider fails | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-012 | falls back to needs_clarification when the provider returns a category unknown to the categories collection | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-012 | classified report produces a plain-language confirmation carrying a quotable ticket reference (US1-AS1) | backend/tests/integration/report-issue.test.ts | Passed | 142.2 |
| TC-013 | a classified ticket records timestamp, category, description, and reporter identity (US1-AS2) | backend/tests/integration/report-issue.test.ts | Passed | 78.5 |
| TC-014 | I forgot my password and can't log into my computer classifies into password_login (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 41.9 |
| TC-014 | my wifi keeps dropping and I can't reach the internet classifies into network (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 50.4 |
| TC-014 | the printer on the 3rd floor is jammed again classifies into printer (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 47.7 |
| TC-014 | my mouse and keyboard stopped responding classifies into peripherals (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 47.0 |
| TC-014 | my laptop is really slow and keeps freezing classifies into performance (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 46.7 |
| TC-014 | is there an outage affecting email right now? classifies into service_status (US1-AS3) | backend/tests/integration/report-issue.test.ts | Passed | 47.1 |
| TC-015 | a bare greeting gets a conversational reply and creates no ticket (US1-AS4) | backend/tests/integration/report-issue.test.ts | Passed | 218.6 |
| TC-016 | password_login classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.1 |
| TC-016 | network classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.0 |
| TC-016 | printer classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.0 |
| TC-016 | peripherals classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.0 |
| TC-016 | performance classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.0 |
| TC-016 | service_status classifies successfully when the provider returns that category with high confidence | backend/tests/unit/classification.test.ts | Passed | 0.0 |
| TC-016 | an unreachable LLM still produces a saved, human-flagged ticket with a quotable reference | backend/tests/integration/degradation.test.ts | Passed | 108.1 |
| TC-017 | GET /api/health reports degraded (still HTTP 200) when the LLM is unreachable | backend/tests/integration/degradation.test.ts | Passed | 13.9 |
| TC-018 | GET /api/health reports degraded (still HTTP 200) when the LLM provider throws | backend/tests/integration/degradation.test.ts | Passed | 22.0 |
| TC-019 | allows status "open" -> "in_progress" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-019 | allows status "open" -> "closed" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-019 | allows status "in_progress" -> "resolved" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-019 | allows status "resolved" -> "in_progress" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-019 | allows status "resolved" -> "closed" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "open" -> "open" | backend/tests/unit/state-machine.test.ts | Passed | 0.3 |
| TC-020 | rejects status "open" -> "resolved" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "in_progress" -> "open" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "in_progress" -> "in_progress" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "in_progress" -> "closed" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "resolved" -> "open" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "resolved" -> "resolved" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "closed" -> "open" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "closed" -> "in_progress" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "closed" -> "resolved" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-020 | rejects status "closed" -> "closed" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-021 | allows handlingMode "automated" -> "waiting_on_user" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-021 | allows handlingMode "automated" -> "human_involved" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-021 | allows handlingMode "waiting_on_user" -> "automated" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-021 | allows handlingMode "waiting_on_user" -> "human_involved" and records history | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-022 | rejects handlingMode "automated" -> "automated" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-022 | rejects handlingMode "waiting_on_user" -> "waiting_on_user" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-022 | rejects handlingMode "human_involved" -> "automated" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-022 | rejects handlingMode "human_involved" -> "waiting_on_user" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-022 | rejects handlingMode "human_involved" -> "human_involved" | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-023 | is append-only across multiple transitions | backend/tests/unit/state-machine.test.ts | Passed | 0.1 |
| TC-024 | human_involved has no outgoing handlingMode transitions | backend/tests/unit/state-machine.test.ts | Passed | 0.2 |
| TC-026 | GET /api/tickets returns every ticket for the session's reporter, any status, newest first (US2-AS1) | backend/tests/integration/status-updates.test.ts | Passed | 242.2 |
| TC-027 | GET /api/tickets/:reference returns detail with history and transcript; 404 unknown; 403 other reporter (FR-007) | backend/tests/integration/status-updates.test.ts | Passed | 123.8 |
| TC-028 | a staff transition pushes a plain-language ticket_updated event within 2 seconds (SC-004, FR-010) | backend/tests/integration/status-updates.test.ts | Passed | 43.1 |
| TC-029 | asking about status in chat yields a per-ticket plain-language summary and no new ticket (US2-AS2) | backend/tests/integration/status-updates.test.ts | Passed | 70.5 |
| TC-030 | a new session with the same orgId sees earlier tickets (FR-008) | backend/tests/integration/status-updates.test.ts | Passed | 59.1 |
| TC-031 | a waiting_on_user ticket returns to automated handling when the user replies (US2-AS3) | backend/tests/integration/status-updates.test.ts | Passed | 95.7 |
| TC-032 | a transition rejected by the state machine returns 409 INVALID_TRANSITION and leaves the ticket unchanged | backend/tests/integration/status-updates.test.ts | Passed | 51.5 |
| TC-033 | PATCH /api/tickets/:reference/state is absent (404) when APP_MODE is not demo or test | backend/tests/integration/test-support-guard.test.ts | Passed | 71.9 |
| TC-034 | marking a ticket resolved prompts the reporter, and a confirmation closes it | backend/tests/integration/resolution-confirm.test.ts | Passed | 160.8 |
| TC-035 | replying that the problem persists reopens the ticket to in_progress | backend/tests/integration/resolution-confirm.test.ts | Passed | 138.1 |
| TC-036 | no reply leaves the ticket Resolved | backend/tests/integration/resolution-confirm.test.ts | Passed | 366.7 |
| TC-037 | an explicit human request escalates immediately, regardless of any other signal | backend/tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-038 | low confidence asks for clarification below the round limit and escalates only once rounds are exhausted | backend/tests/unit/escalation.test.ts | Passed | 0.1 |
| TC-039 | out-of-scope reports escalate with reason out_of_scope | backend/tests/unit/escalation.test.ts | Passed | 0.0 |
| TC-040 | LLM unavailability escalates with reason llm_unavailable | backend/tests/unit/escalation.test.ts | Passed | 0.1 |
| TC-041 | every escalation decision flags escalated and routes to human_involved | backend/tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-042 | never-silent-guess — a low-confidence outcome never proceeds to an unescalated categorised ticket | backend/tests/unit/escalation.test.ts | Passed | 0.2 |
| TC-043 | a confident classification with no other signals proceeds without escalation | backend/tests/unit/escalation.test.ts | Passed | 0.0 |
| TC-044 | an ambiguous report gets a clarifying question and no ticket (US3-AS1) | backend/tests/integration/escalation-flow.test.ts | Passed | 96.1 |
| TC-045 | still unclear after the clarification rounds are exhausted → unclassified escalated ticket (US3-AS2) | backend/tests/integration/escalation-flow.test.ts | Passed | 118.6 |
| TC-046 | an explicit human request escalates immediately with an acknowledgement (US3-AS3) | backend/tests/integration/escalation-flow.test.ts | Passed | 47.4 |
| TC-047 | an escalated ticket carries the full transcript so nothing is re-asked (US3-AS4, FR-007) | backend/tests/integration/escalation-flow.test.ts | Passed | 113.2 |
| TC-048 | non-IT requests are detected as off-topic | backend/tests/unit/refusal.test.ts | Passed | 0.1 |
| TC-049 | requests for the agent to execute remediation are detected | backend/tests/unit/refusal.test.ts | Passed | 0.1 |
| TC-050 | ordinary IT issue reports stay in scope | backend/tests/unit/refusal.test.ts | Passed | 0.0 |
| TC-051 | a message describing two problems is acknowledged one at a time and creates no ticket | backend/tests/integration/edge-cases.test.ts | Passed | 103.9 |
| TC-052 | a duplicate report in the same category surfaces the existing ticket instead of creating a new one | backend/tests/integration/edge-cases.test.ts | Passed | 116.2 |
| TC-053 | confirming a duplicate is the same problem leaves the existing ticket untouched | backend/tests/integration/edge-cases.test.ts | Passed | 110.9 |
| TC-054 | denying a duplicate is the same problem opens a second ticket | backend/tests/integration/edge-cases.test.ts | Passed | 109.9 |
| TC-055 | vowel-less gibberish input is treated as content-free and creates no ticket | backend/tests/integration/edge-cases.test.ts | Passed | 45.6 |
| TC-056 | punctuation-only input is treated as content-free and creates no ticket | backend/tests/integration/edge-cases.test.ts | Passed | 47.1 |
| TC-057 | accepts inputOrigin=typed and persists it on the stored message | backend/tests/integration/messages-origin.test.ts | Passed | 161.9 |
| TC-057 | accepts inputOrigin=voice and persists it on the stored message | backend/tests/integration/messages-origin.test.ts | Passed | 44.0 |
| TC-057 | accepts inputOrigin=mixed and persists it on the stored message | backend/tests/integration/messages-origin.test.ts | Passed | 18.7 |
| TC-058 | defaults inputOrigin to typed when omitted from the request body | backend/tests/integration/messages-origin.test.ts | Passed | 14.4 |
| TC-059 | rejects an invalid inputOrigin value with a validation error | backend/tests/integration/messages-origin.test.ts | Passed | 12.4 |
| TC-060 | returns inputOrigin in the ticket transcript DTO for both user and agent messages | backend/tests/integration/messages-origin.test.ts | Passed | 49.9 |
| TC-061 | returns the result from the first provider that succeeds | backend/tests/unit/stt-service.test.ts | Passed | 0.2 |
| TC-062 | falls through to the next provider when the first one fails | backend/tests/unit/stt-service.test.ts | Passed | 0.2 |
| TC-063 | throws a 503 STT_UNAVAILABLE error when every provider in the chain fails | backend/tests/unit/stt-service.test.ts | Passed | 0.2 |
| TC-064 | throws a 503 STT_UNAVAILABLE error when the chain is empty | backend/tests/unit/stt-service.test.ts | Passed | 0.1 |
| TC-065 | transcribes valid WAV audio and returns 200 with transcript, durationSeconds, provider | backend/tests/integration/transcription.test.ts | Passed | 75.9 |
| TC-066 | returns 400 INVALID_AUDIO when the audio part is missing | backend/tests/integration/transcription.test.ts | Passed | 32.2 |
| TC-067 | returns 400 INVALID_AUDIO when the sample format is wrong | backend/tests/integration/transcription.test.ts | Passed | 20.0 |
| TC-068 | returns 404 SESSION_NOT_FOUND for an unknown session | backend/tests/integration/transcription.test.ts | Passed | 15.2 |
| TC-069 | returns 413 AUDIO_TOO_LARGE when the duration cap is exceeded | backend/tests/integration/transcription.test.ts | Passed | 22.3 |
| TC-070 | returns 503 STT_UNAVAILABLE with a plain-language message when the provider chain is exhausted | backend/tests/integration/transcription.test.ts | Passed | 11.4 |
| TC-070b | returns 503 STT_UNAVAILABLE with a plain-language message when every provider in the chain fails | backend/tests/integration/transcription.test.ts | Passed | 11.2 |
| TC-070c | falls back to the next provider in the chain when the primary provider fails | backend/tests/integration/transcription.test.ts | Passed | 11.4 |
| TC-070d | returns a whitespace-only transcript as-is with 200 (client decides FR-011) | backend/tests/integration/transcription.test.ts | Passed | 14.3 |
| TC-071 | returns 409 TRANSCRIPTION_IN_PROGRESS for a concurrent request on the same session | backend/tests/integration/transcription.test.ts | Passed | 430.8 |
| TC-072 | falls through to the next provider when the first one exceeds its timeout | backend/tests/unit/stt-service.test.ts | Passed | 57.0 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=typed | backend/tests/integration/messages-origin.test.ts | Passed | 41.0 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=voice | backend/tests/integration/messages-origin.test.ts | Passed | 47.1 |
| TC-073 | identical text produces the same ticket creation and handling outcome regardless of inputOrigin=mixed | backend/tests/integration/messages-origin.test.ts | Passed | 46.2 |
| UP-001 | loads each field into an editable control with its provenance | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 64.2 |
| UP-002 | sends every field with the setAt it was loaded with | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 52.3 |
| UP-003 | reports each field's outcome on that field, with no page-level failure banner | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 42.6 |
| UP-004 | a conflict never discards the staff member's typed value | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 31.5 |
| UP-005 | saving again after a conflict carries the token the server just reported | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 39.7 |
| UP-006 | shows nothing as saved until the server has answered (no optimistic UI) | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 20.1 |
| UP-007 | offers release only on a staff-controlled field | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 15.2 |
| UP-008 | a release is applied only from the server's answer | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 26.4 |
| UP-009 | treats the remote access list as one field, not one per row | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 15.8 |
| UP-010 | saves the whole remote access list as one value | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 28.0 |
| UP-011 | field history is fetched on demand and shown newest first | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 26.7 |
| UP-012 | no longer offers the retired correction entry kind | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 10.8 |
| UP-013 | adds an attributed note | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 19.8 |
| UP-014 | renders a pre-feature correction as a note rather than as a value | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 10.9 |
| UP-015 | requires inline confirmation before re-issuing a password | frontend/tests/pages/UserProfilePage.test.tsx | Passed | 19.0 |
| VP-001 | an in-flight session completes on its pinned version; a new session started after publish uses the new version | backend/tests/integration/guide-version-pinning.test.ts | Passed | 333.7 |
