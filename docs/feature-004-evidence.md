# Feature 004 evidence

Registration/sign-in: `/register`, `/login`. User tickets/profile/settings: `/tickets`, `/profile`, `/settings`. Staff dashboard/import: `/staff`, `/staff/import`.

The import flow is sequential: upload `.xlsx`, map columns with required email, preview created/updated/rejected rows, then explicitly apply. Invalid files and rows are rejected before account changes; generated credentials are included for created rows and flagged as initial passwords.

## Observed quality gates — 2026-07-16

| Gate | Observed result |
|---|---|
| Backend typecheck and lint | PASS |
| Backend Vitest | PASS — 79 files, 211 tests |
| Frontend typecheck and lint | PASS |
| Frontend Vitest | PASS — 16 files, 72 tests |

The automated results above were observed in the local workspace. The manual demo and UAT walkthroughs remain separate release activities.
