// R2: the mandated six seed the `categories` collection (backend/src/scripts/seed-guides.ts)
// but classification is no longer restricted to this literal union — new categories
// added via the maintainer API classify without a code change (FR-014). `unclassified`
// is the one hardcoded fallback pseudo-category (safety default, FR-012).
export const MANDATED_CATEGORIES = [
  "password_login",
  "network",
  "printer",
  "peripherals",
  "performance",
  "service_status",
] as const;
export const UNCLASSIFIED_CATEGORY = "unclassified" as const;
/** @deprecated kept for the mock provider's static keyword table; prefer the categories collection. */
export const ISSUE_CATEGORIES = [...MANDATED_CATEGORIES, UNCLASSIFIED_CATEGORY] as const;
export type IssueCategory = string;

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const HANDLING_MODES = ["automated", "waiting_on_user", "human_involved"] as const;
export type HandlingMode = (typeof HANDLING_MODES)[number];

export const MESSAGE_AUTHORS = ["user", "agent", "system"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];

export const ACTORS = ["agent", "user", "system", "staff"] as const;
export type Actor = (typeof ACTORS)[number];

export const ESCALATION_REASONS = [
  "user_request",
  "low_confidence",
  "out_of_scope",
  "llm_unavailable",
  "no_guide",
  "guidance_exhausted",
  "remediation_issue",
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const CONVERSATION_STATES = ["active", "ended"] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const INPUT_ORIGINS = ["typed", "voice", "mixed"] as const;
export type InputOrigin = (typeof INPUT_ORIGINS)[number];

export const ACCOUNT_ROLES = ["user", "staff"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const AVAILABILITY_STATUSES = ["available", "busy", "away"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

// Constrained automated remediation (005, FR-8, Constitution Principle II).
export const ACTION_TIERS = ["read_only", "state_changing"] as const;
export type ActionTier = (typeof ACTION_TIERS)[number];

export const ACTION_OUTCOMES = ["succeeded", "failed", "timed_out", "attempted_unverified", "refused"] as const;
export type ActionOutcome = (typeof ACTION_OUTCOMES)[number];

// data-model.md §4 "Approval Request" state transitions (R6, FR-004a/b).
export const APPROVAL_STATUSES = ["pending", "approved", "declined", "expired", "no_longer_applicable"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

// data-model.md §5 "Refusal reason vocabulary". Each maps to a specific requirement.
export const REFUSAL_REASONS = [
  "no_matching_entry",
  "argument_mismatch",
  "unregistered_target",
  "endpoint_not_permitted",
  "missing_consent",
  "missing_approval",
  "remediation_disabled",
  "low_confidence",
  "degraded_model",
  "not_ticket_owner",
  "already_attempted",
  "step_cap_reached",
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

// 007 data-model.md §3.2 / §4. Who set a profile field's value, and who currently
// controls it. Both live here rather than beside either model, because
// `support-profile.ts` and `profile-field-history.ts` each need them and importing one
// from the other would make the two models cyclic.
export const FIELD_ACTOR_KINDS = ["owner", "staff"] as const;
export type FieldActorKind = (typeof FIELD_ACTOR_KINDS)[number];

export const FIELD_CONTROLS = ["owner", "staff"] as const;
export type FieldControl = (typeof FIELD_CONTROLS)[number];

// 007 data-model.md §4. A history entry records either a value change or a control
// transfer; a staff write over an owner-controlled field produces one of each.
export const FIELD_CHANGE_KINDS = ["value", "control"] as const;
export type FieldChangeKind = (typeof FIELD_CHANGE_KINDS)[number];

// 007 FR-028. The support profile holds these three fields and no others. Here rather
// than only in `support-profile.ts` so the history model can validate against the same
// list without importing the model it records changes for.
export const PROFILE_FIELDS = ["remoteAccessIds", "location", "hardware"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
