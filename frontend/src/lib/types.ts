export type IssueCategory =
  | "password_login"
  | "network"
  | "printer"
  | "peripherals"
  | "performance"
  | "service_status"
  | "unclassified";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type HandlingMode = "automated" | "waiting_on_user" | "human_involved";

export type MessageAuthor = "user" | "agent" | "system";

export type InputOrigin = "typed" | "voice" | "mixed";

export type Actor = "agent" | "user" | "system" | "staff";

export type EscalationReason = "user_request" | "low_confidence" | "out_of_scope" | "llm_unavailable";

export interface MessageGuidance {
  stepIndex: number;
  stepCount: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  author: MessageAuthor;
  text: string;
  inputOrigin: InputOrigin;
  sentAt: string;
  guidance?: MessageGuidance;
}

export interface TransitionRecord {
  at: string;
  field: "status" | "handlingMode";
  from: string;
  to: string;
  actor: Actor;
}

export interface TicketSummary {
  reference: string;
  category: IssueCategory;
  status: TicketStatus;
  handlingMode: HandlingMode;
  escalated: boolean;
  description: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  escalationReason: EscalationReason | null;
  classificationConfidence: number | null;
  history: TransitionRecord[];
  transcript: Message[];
}

export interface Reporter {
  orgId: string;
  displayName: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  reporter: Reporter;
  conversationId: string;
  openTickets: TicketSummary[];
}

export interface SendMessageResponse {
  messageId: string;
}

export interface TranscriptionResponse {
  transcript: string;
  durationSeconds: number;
  provider: "local" | "openai_compat";
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface AgentTokenEvent {
  conversationId: string;
  messageId: string;
  token: string;
}

export interface AgentMessageEvent {
  conversationId: string;
  message: Message;
}

export interface TicketCreatedEvent {
  ticket: TicketSummary;
}

export interface TicketUpdatedEvent {
  reference: string;
  field: "status" | "handlingMode";
  from: string;
  to: string;
  at: string;
  plainText: string;
}
