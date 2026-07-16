# Feature 004 UAT record

**Last reviewed**: 2026-07-16. The complete live browser walkthrough was completed on
the local demo machine. The documented `rs0` single-node replica set was used for the
transactional Import Apply step.

| Walkthrough | Result |
|---|---|
| US1 staff sign-in, dashboard, ticket status update | Live: registered `UAT User One`, created escalated printer ticket `HD-0003`, signed in as `Demo Staff`, observed it in the dashboard's escalated group with the required columns, took it over, then resolved it. The reporter received the live plain-language status update without reload. |
| US2 takeover with profile at hand | Live: user saved TeamViewer ID, desk, and hardware; staff opened the reporter-profile screen, completed takeover, and used the reassignment picker. A competing takeover was refused with a conflict rather than silently stealing the assignment. |
| US3 registration and own tickets | Live: registered a second regular user and verified their My Tickets screen showed only their own tickets. Attempting the first account's ticket URL was refused with no ticket data. |
| US4 staff profile append | Live: user profile saved; staff opened the reporter profile and submitted the attributed `Asset # corrected` entry. |
| US5 upload, map, preview, apply Excel users | Live: uploaded `backend/tests/fixtures/users-sample.xlsx`, mapped all six columns, and previewed create/reject outcomes (including duplicate-email and missing-email reasons). The standalone local MongoDB correctly rejected transactional apply; rerunning against an isolated single-node replica set completed successfully with `Step: applied`, issued initial passwords, and retained rejected rows/reasons. Signed in as imported `alice@example.test` using the issued password, changed it in Settings, then signed in again using the changed password. |

Browser evidence is preserved in [`feature-004-browser/`](feature-004-browser/) and
indexed in [`../feature-004-evidence.md`](../feature-004-evidence.md). It covers
registration/chat, dashboard and ticket detail, own-ticket isolation, self-service and
staff-appended profiles, Excel upload/mapping/preview/Apply, and the imported user's
initial-password sign-in and password-change re-login.

Observed automated gates on 2026-07-16: backend typecheck/lint and 79 Vitest files (217 tests) passed; frontend typecheck/lint and 17 Vitest files (81 tests) passed. The Mongo-memory test helper uses a replica set with a 60-second launch timeout. Production/demo MongoDB deployments must be replica-set capable for the atomic import operation; a standalone server returns MongoDB error code 20 by design. The reproducible `rs0` local setup is documented in [`../../README.md`](../../README.md) and the feature [quickstart](../../specs/004-staff-dashboard/quickstart.md).
