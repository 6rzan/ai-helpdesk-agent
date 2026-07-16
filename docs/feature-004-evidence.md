# Feature 004 evidence

Registration/sign-in: `/register`, `/login`. User tickets/profile/settings: `/tickets`, `/profile`, `/settings`. Staff dashboard/import: `/staff`, `/staff/import`.

The import flow is sequential: upload `.xlsx`, map columns with required email, preview created/updated/rejected rows, then explicitly apply. Invalid files and rows are rejected before account changes; generated credentials are included for created rows and flagged as initial passwords.

## Observed quality gates — 2026-07-16

| Gate | Observed result |
|---|---|
| Backend typecheck and lint | PASS |
| Backend Vitest | PASS — 79 files, 217 tests |
| Frontend typecheck and lint | PASS |
| Frontend Vitest | PASS — 17 files, 81 tests |

The automated results above were observed in the local workspace. The completed
demo-machine walkthrough and durable browser captures are recorded in
[`testing/feature-004-uat.md`](testing/feature-004-uat.md) and
[`testing/feature-004-browser/`](testing/feature-004-browser/).

## Browser evidence index — 2026-07-16

| Surface / outcome | Capture |
|---|---|
| Registration and reporter chat | [`uat-user-chat.png`](testing/feature-004-browser/uat-user-chat.png) |
| Staff dashboard and escalated grouping | [`uat-dashboard-list.png`](testing/feature-004-browser/uat-dashboard-list.png) |
| Staff ticket context and takeover | [`uat-ticket-detail.png`](testing/feature-004-browser/uat-ticket-detail.png), [`uat-ticket-takeover.png`](testing/feature-004-browser/uat-ticket-takeover.png) |
| Own-ticket isolation | [`uat-user-own-tickets.png`](testing/feature-004-browser/uat-user-own-tickets.png) |
| Self-service profile and staff-appended details | [`uat-user-profile-saved.png`](testing/feature-004-browser/uat-user-profile-saved.png), [`uat-staff-reporter-profile.png`](testing/feature-004-browser/uat-staff-reporter-profile.png), [`uat-staff-profile-note.png`](testing/feature-004-browser/uat-staff-profile-note.png) |
| Excel upload, map/preview, and transactional Apply | [`uat-import-upload.png`](testing/feature-004-browser/uat-import-upload.png), [`uat-import-preview.png`](testing/feature-004-browser/uat-import-preview.png), [`uat-import-applied-replset.png`](testing/feature-004-browser/uat-import-applied-replset.png) |
| Imported-user sign-in and password change | [`uat-imported-user-login.png`](testing/feature-004-browser/uat-imported-user-login.png), [`uat-imported-user-password-changed.png`](testing/feature-004-browser/uat-imported-user-password-changed.png), [`uat-imported-user-password-relogin.png`](testing/feature-004-browser/uat-imported-user-password-relogin.png) |
