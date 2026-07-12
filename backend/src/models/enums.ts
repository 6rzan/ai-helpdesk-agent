export const ISSUE_CATEGORIES = [
  "password_login",
  "network",
  "printer",
  "peripherals",
  "performance",
  "service_status",
  "unclassified",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

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
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const CONVERSATION_STATES = ["active", "ended"] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const INPUT_ORIGINS = ["typed", "voice", "mixed"] as const;
export type InputOrigin = (typeof INPUT_ORIGINS)[number];
