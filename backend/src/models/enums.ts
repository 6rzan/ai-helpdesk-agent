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
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const CONVERSATION_STATES = ["active", "ended"] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const INPUT_ORIGINS = ["typed", "voice", "mixed"] as const;
export type InputOrigin = (typeof INPUT_ORIGINS)[number];
