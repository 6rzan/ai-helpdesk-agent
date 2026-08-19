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
  guidance?: {
    categoryName: string;
    guideVersion: number;
    state: string;
    stepAttempts: {
      stepIndex: number;
      outcome: string;
      at: string;
      instruction: string | null;
    }[];
  };
}

export interface MyTicket extends TicketSummary {
  assigneeName: string | null;
  updatedAt: string;
}

export interface SupportProfile {
  remoteAccessIds: RemoteAccessId[];
  location: string;
  hardware: string;
  staffEntries: ProfileStaffEntry[];
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

export type AccountRole = "user" | "staff";
export type AvailabilityStatus = "available" | "busy" | "away";

export interface Account {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  availability?: AvailabilityStatus;
  usingInitialPassword: boolean;
}

export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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

/** One row in the staff dashboard ticket list. `reporter` is the linked account's
 * display name, or `null` for legacy tickets with no account (FR-014). */
export interface StaffTicketRow {
  reference: string;
  category: IssueCategory;
  status: TicketStatus;
  handlingMode: HandlingMode;
  escalated: boolean;
  description: string;
  reporter: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAssignee {
  accountId: string;
  displayName: string;
  since: string;
}

export interface AssignmentRecord {
  assigneeId: string;
  assigneeName: string;
  byId: string;
  byName: string;
  at: string;
  kind: "takeover" | "reassign";
}

export interface RemoteAccessId {
  tool: string;
  id: string;
}

export interface ProfileStaffEntry {
  kind: "note" | "correction";
  field: "remoteAccessIds" | "location" | "hardware" | null;
  value: string;
  staffId: string;
  staffName: string;
  at: string;
}

/** The reporter's support profile, surfaced to handling staff on escalated tickets
 * (FR-013). `null` when no account is linked or no profile exists. */
export interface SupportProfileView {
  remoteAccessIds: RemoteAccessId[];
  location: string;
  hardware: string;
  staffEntries: ProfileStaffEntry[];
}

/** Full-context detail for the staff ticket view: the shared ticket detail plus the
 * linked reporter account id, current assignee, assignment trail and the reporter's
 * support profile (all `null`/empty when not applicable). */
export interface StaffTicketDetail extends TicketDetail {
  reporterAccountId: string | null;
  assignee: TicketAssignee | null;
  assignmentHistory: AssignmentRecord[];
  staffActions?: {
    action: string;
    staffId: string;
    staffName: string;
    details: Record<string, unknown>;
    at: string;
  }[];
  profile: SupportProfileView | null;
}

export interface RosterEntry {
  id: string;
  displayName: string;
  availability: AvailabilityStatus;
  openCaseCount: number;
}

/** The staff roster with an advisory suggested assignee (available, fewest open
 * cases). Advisory only — staff confirm explicitly, never auto-assigned (FR-021). */
export interface Roster {
  staff: RosterEntry[];
  suggestedAssigneeId: string | null;
}

export interface StaffTicketFilters {
  status?: TicketStatus;
  category?: IssueCategory;
  escalated?: boolean;
  sort?: "newest" | "oldest" | "updated";
}

export type ImportField = "email" | "displayName" | "initialPassword" | "remoteAccessId" | "location" | "hardware";

export interface ImportOutcome {
  row: number;
  email: string;
  outcome: "created" | "updated" | "rejected";
  reason?: string;
  initialPassword?: string;
}

export interface ImportUploadResponse {
  importId: string;
  columns: string[];
  sampleRows: string[][];
}

export interface ImportOutcomesResponse {
  importId: string;
  outcomes: ImportOutcome[];
}

/** Payload of a staff-stream SSE event (`ticket_created` / `ticket_updated`). */
export interface StaffStreamEvent {
  ticketId: string;
  reference: string;
  changed: string;
}

// --- 005: Constrained Automated Remediation --------------------------------

export type ActionTier = "read_only" | "state_changing";

export type ActionOutcome = "succeeded" | "failed" | "timed_out" | "attempted_unverified" | "refused";

export type RefusalReason =
  | "no_matching_entry"
  | "argument_mismatch"
  | "unregistered_target"
  | "endpoint_not_permitted"
  | "missing_consent"
  | "missing_approval"
  | "remediation_disabled"
  | "low_confidence"
  | "degraded_model"
  | "not_ticket_owner"
  | "already_attempted"
  | "step_cap_reached";

export interface ConsentRecord {
  given: boolean;
  byAccountId: string;
  at: string;
  messageId: string;
}

export interface ApprovalReference {
  requestId: string;
  byAccountId: string;
  displayName: string;
  at: string;
}

/** data-model.md §5. One executed-or-refused action, shown identically to the
 * reporter (plain-language) and staff (full detail) per the same record. */
export interface ActionRecord {
  id: string;
  at: string;
  actor: Actor;
  ticketId: string | null;
  classifiedIntent: string;
  policyEntryId: string | null;
  tier: ActionTier | null;
  requestedAction: string;
  arguments: Record<string, string>;
  endpointId: string | null;
  endpointLabel: string | null;
  authorisation: {
    consent: ConsentRecord | null;
    approval: ApprovalReference | null;
  };
  outcome: ActionOutcome;
  refusalReason: RefusalReason | null;
  observedOutput: string | null;
  verification: { entryId: string; outcome: ActionOutcome; observedOutput: string | null } | null;
  durationMs: number | null;
}

export type ApprovalStatus = "pending" | "approved" | "declined" | "expired" | "no_longer_applicable";

/** data-model.md §4. One pending-or-decided state-changing action. */
export interface ApprovalRequest {
  id: string;
  ticketReference: string;
  policyEntryId: string;
  description: string;
  command: string;
  arguments: Record<string, string>;
  endpointId: string;
  endpointLabel: string;
  consent: ConsentRecord;
  status: ApprovalStatus;
  raisedAt: string;
  expiresAt: string;
  decidedBy: { accountId: string; displayName: string } | null;
  decidedAt: string | null;
  closureReason: string | null;
}

/** data-model.md §2, the fields the UI is allowed to know about an endpoint —
 * never host/port/credentials (contracts/api.md rule 1). */
export interface TestEndpointSummary {
  id: string;
  label: string;
  description: string;
}

export interface RemediationEndpointAvailability {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
}

/** GET /staff/remediation shape (contracts/api.md). */
export interface RemediationAvailability {
  globallyEnabled: boolean;
  endpoints: RemediationEndpointAvailability[];
}

/** The agent's in-chat offer to run an approved action, before consent (US1). */
export interface ActionProposal {
  ticketId: string;
  proposalId: string;
  tier: ActionTier;
  description: string;
  endpointLabel: string;
}

export interface MetricsPeriod {
  preset: "7d" | "30d" | "90d" | "all";
  from: string | null;
  to: string | null;
}

export interface MetricsSplit {
  key: string;
  count: number;
}

export interface MetricsSummary {
  period: MetricsPeriod;
  hasData: boolean;
  ticketVolume: number;
  categorySplit: MetricsSplit[];
  statusSplit: MetricsSplit[];
  resolvedWithoutHuman: { count: number; proportion: number };
  escalationRate: number;
  actionOutcomes: MetricsSplit[];
  timeToResolution: { medianMinutes: number | null; buckets: MetricsSplit[] };
  providerFallbacks: number;
}

export interface ActionProposedEvent {
  ticketId: string;
  proposalId: string;
  tier: ActionTier;
  description: string;
  endpointLabel: string;
}

export interface ActionRecordedEvent {
  ticketId: string;
  actionRecordId: string;
  outcome: ActionOutcome;
  summary: string;
}

export interface ApprovalPendingEvent {
  ticketId: string;
  approvalId: string;
  description: string;
}

export interface ApprovalDecidedEvent {
  ticketId: string;
  approvalId: string;
  status: ApprovalStatus;
  decidedBy?: string;
}

export interface RemediationAvailabilityChangedEvent {
  globallyEnabled: boolean;
  disabledEndpointIds: string[];
}
