# Feature 004 evidence

Registration/sign-in: `/register`, `/login`. User tickets/profile/settings: `/tickets`, `/profile`, `/settings`. Staff dashboard/import: `/staff`, `/staff/import`.

The import flow is sequential: upload `.xlsx`, map columns with required email, preview created/updated/rejected rows, then explicitly apply. Invalid files and rows are rejected before account changes; generated credentials are included for created rows and flagged as initial passwords.

TypeScript checks pass for both packages. Full integration execution is environment-limited because `mongodb-memory-server` cannot start `mongod` without the Microsoft VC++ runtime; passing suites are recorded in the Vitest JSON report.
