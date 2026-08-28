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
  fieldState?: ProfileFieldStateMap;
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
 * (FR-013). `null` when no account is linked or no profile exists.
 *
 * 007: `fieldState` is optional on this type rather than required, because a
 * response produced before this feature shipped carries no such key. Making it
 * required here would have forced every consumer to assert a shape the server
 * does not always send. */
export interface SupportProfileView {
  remoteAccessIds: RemoteAccessId[];
  location: string;
  hardware: string;
  staffEntries: ProfileStaffEntry[];
  fieldState?: ProfileFieldStateMap;
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
  /** T097: the agent's own action records for this ticket (executed AND
   * refused), interleaved into the timeline alongside conversation, guided
   * steps, and staff actions (data-model.md §5, US4 AS2). */
  actions?: ActionRecord[];
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

/** POST /tickets/:id/actions/consent response (contracts/api.md). Granting a
 * read-only proposal resolves immediately; granting a state-changing one
 * returns `pending_approval` with `approvalId` instead of executing (FR-004a). */
export interface ConsentDecisionResult {
  outcome: ActionOutcome | "pending_approval";
  refusalReason?: RefusalReason;
  observedOutput: string | null;
  description: string;
  approvalId?: string;
}

/** POST /staff/approvals/:id/{approve,decline} response. `execution` is only
 * present when the decision actually ran the action (approved + won the race). */
export interface DecideApprovalResult {
  status: ApprovalStatus;
  execution: {
    outcome: ActionOutcome;
    refusalReason?: RefusalReason;
    observedOutput: string | null;
    actionRecordId?: string;
  } | null;
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

// --- 007: Maintainer Admin Console & Staff-Authoritative Account Editing -----
//
// Shapes from `specs/007-admin-console-account-editing/contracts/api.md`. Two
// conventions run through the whole block and are stated once here rather than
// repeated on every field:
//
//   1. Every provenance field is nullable. A profile written before this feature
//      has a real value but no recorded author or time, and that is a state the
//      client renders rather than an error (contracts/api.md, research.md R8).
//   2. `remoteAccessIds` is one field, not a list of fields. Adding or removing
//      an entry is a change to the whole field, which is why it carries a single
//      `FieldState` and a single history stream (FR-019, research.md R11).

/** The three profile fields this feature makes authoritative. FR-028 fixes the
 * set at exactly these; nothing is added without a requirement change. */
export type ProfileFieldName = "location" | "hardware" | "remoteAccessIds";

/** Who last wrote a field's value. `owner` is the account holder; `staff` is any
 * staff member acting through the staff surface. */
export type FieldActorKind = "owner" | "staff";

/** Who may currently edit a field. A staff write moves control to `staff`; a
 * release returns it to `owner` (FR-023). */
export type FieldControl = "owner" | "staff";

/** Provenance and control for one profile field.
 *
 * All four provenance members are nullable together: a pre-feature profile has a
 * value with no recorded authorship, and `setByName: null` with `setAt: null` is
 * the shape that says so. `controlledBy` is never null, because a field with no
 * recorded staff claim is owner-controlled by definition rather than by absence. */
export interface FieldState {
  setByKind: FieldActorKind | null;
  setById: string | null;
  setByName: string | null;
  setAt: string | null;
  controlledBy: FieldControl;
}

export type ProfileFieldStateMap = Record<ProfileFieldName, FieldState>;

/** The value a field held before a change. Typed per field: a string for
 * `location` and `hardware`, the whole list for `remoteAccessIds`. */
export type ProfileFieldValue = string | RemoteAccessId[];

/** One entry in a field's history (contracts/api.md, data-model.md \u00a74).
 *
 * `changeKind` distinguishes the two things that can happen to a field, and the
 * two carry different members: a `value` entry records what the field held before,
 * a `control` entry records where control moved to. A single staff write that also
 * takes control appends one of each rather than one combined entry, so the history
 * never conflates "the value changed" with "who may edit it changed". */
export interface ProfileFieldHistoryEntry {
  changeKind: "value" | "control";
  previousValue?: ProfileFieldValue | null;
  previousSetByKind?: FieldActorKind | null;
  previousSetByName?: string | null;
  previousSetAt?: string | null;
  newControlledBy?: FieldControl;
  actorKind: FieldActorKind;
  actorId: string | null;
  actorName: string | null;
  at: string;
}

export interface ProfileFieldHistoryResponse {
  history: ProfileFieldHistoryEntry[];
}

/** Outcome of one field within a save.
 *
 * `applied` and `conflict` come from the staff endpoint; `applied` and `locked`
 * come from the owner endpoint. They share one union because both endpoints
 * return the same per-field map shape and the client renders them the same way
 * \u2014 per field, never as a page-level banner (FR-029, contracts/api.md rule 3). */
export type ProfileFieldOutcomeKind = "applied" | "conflict" | "locked";

export interface ProfileFieldApplied {
  outcome: "applied";
}

/** A staff save refused because the field moved since the client loaded it. The
 * current value, author, and time are carried so the staff member can see what
 * they would have overwritten rather than only that they failed (FR-029). */
export interface ProfileFieldConflict {
  outcome: "conflict";
  currentValue: ProfileFieldValue;
  currentSetByName: string | null;
  currentSetAt: string | null;
}

/** An owner save refused because staff control the field. Who set it and when are
 * carried so the page can explain rather than just refuse (FR-021, FR-022). */
export interface ProfileFieldLocked {
  outcome: "locked";
  currentSetByName: string | null;
  currentSetAt: string | null;
}

export type ProfileFieldOutcome =
  | ProfileFieldApplied
  | ProfileFieldConflict
  | ProfileFieldLocked;

/** Per-field results. Partial because a save reports only the fields it was sent,
 * and a mixed result is a `200` rather than a failure (contracts/api.md). */
export type ProfileFieldResults = Partial<Record<ProfileFieldName, ProfileFieldOutcome>>;

/** One field in a save request. `expectedSetAt: null` asserts "this field had never
 * been set when I loaded it" \u2014 which is what stops last-write-wins on a field that
 * was empty at load and has been filled since. */
export interface ProfileFieldSubmission {
  value: ProfileFieldValue;
  expectedSetAt: string | null;
}

export type ProfileFieldSubmissions = Partial<
  Record<ProfileFieldName, ProfileFieldSubmission>
>;

export interface ProfileFieldsSaveRequest {
  fields: ProfileFieldSubmissions;
}

/** Response to either profile save. The full profile is returned alongside the
 * results so the client never has to reload to learn the post-save state. */
export interface ProfileFieldsSaveResponse {
  results: ProfileFieldResults;
  profile: SupportProfileView;
}

export interface StaffProfileResponse {
  profile: SupportProfileView;
}

/** One row of the staff account directory.
 *
 * Exactly four attributes, and the narrowness is the requirement rather than an
 * omission: FR-030 and NFR-5 make this deliberately not a superset of the staff
 * roster, which serves a different audience (research.md R10). */
export interface AccountDirectoryEntry {
  id: string;
  displayName: string;
  email: string;
  role: AccountRole;
}

export interface AccountDirectoryResponse {
  accounts: AccountDirectoryEntry[];
}

// --- Maintainer console views ------------------------------------------------

/** `GET /api/maintainer/status`. Unauthenticated and always mounted, including
 * when administration is switched off \u2014 that is the whole point of it, and the
 * console reads it before rendering a sign-in form at all (FR-005, research.md R2). */
export interface MaintainerStatus {
  enabled: boolean;
}

/** One category row in the console. `activeGuideVersion` is null for a category
 * with no published guide yet. */
export interface MaintainerCategory {
  name: string;
  displayName: string;
  classificationDescription: string;
  mandated: boolean;
  retired: boolean;
  activeGuideVersion: number | null;
}

export interface MaintainerCategoriesResponse {
  categories: MaintainerCategory[];
}

/** One step of a troubleshooting guide as the editor holds it. */
export interface MaintainerGuideStep {
  instruction: string;
  successHint: string;
}

/** One published guide version. Versions are immutable: there is no revert, edit,
 * or delete path at any layer, which is why this type has no id to address one by. */
export interface MaintainerGuideVersion {
  version: number;
  changedBy: string;
  changedAt: string;
  changeNote: string | null;
  active: boolean;
  steps: MaintainerGuideStep[];
}

export interface MaintainerGuideVersionsResponse {
  versions: MaintainerGuideVersion[];
}

export interface MaintainerCategoryCreateRequest {
  name: string;
  displayName: string;
  classificationDescription: string;
  guide: { steps: MaintainerGuideStep[]; changeNote?: string };
}

export interface MaintainerCategoryUpdateRequest {
  displayName?: string;
  classificationDescription?: string;
}

export interface MaintainerGuidePublishRequest {
  steps: MaintainerGuideStep[];
  changeNote?: string;
}

export interface MaintainerGuidePublishResponse {
  version: number;
  active: boolean;
}

/** A guide rejected at a specific step. FR-013 requires the offending step and
 * field, not just that the guide is invalid, so the editor can put the message on
 * the step the maintainer is looking at. */
export interface GuideStepInvalidError extends ApiErrorBody {
  stepIndex: number;
  field: string;
}

/** A remote-access entry rejected for being half-filled. `entryIndex` places the
 * message on the offending row rather than on the fieldset. */
export interface RemoteAccessEntryInvalidError extends ApiErrorBody {
  entryIndex: number;
}

/** A sign-in refused while cooling off. The remaining time is the server's to
 * report: a client-side countdown would drift and could be edited (FR-034). */
export interface MaintainerThrottledError extends ApiErrorBody {
  retryAfterSeconds: number;
}
