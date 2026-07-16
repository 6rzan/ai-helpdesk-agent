# Feature 004 role and data design

```mermaid
erDiagram
  USER_ACCOUNT ||--o{ AUTH_SESSION : has
  USER_ACCOUNT ||--o| SUPPORT_PROFILE : owns
  USER_ACCOUNT ||--o{ TICKET : reports
  TICKET ||--o{ STAFF_ACTION_RECORD : records
  USER_ACCOUNT ||--o{ STAFF_ACTION_RECORD : performs
  PROFILE_IMPORT }o--|| USER_ACCOUNT : initiated_by
```

The application has exactly two HTTP roles: regular users own their tickets/profile, while staff can operate the dashboard, append profile entries, manage credentials, and import users. Maintainer seed actions are outside the application role model.
