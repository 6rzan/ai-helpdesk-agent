import type {
  AccountDirectoryResponse,
  Account,
  ActionRecord,
  ApiErrorBody,
  ApprovalRequest,
  AvailabilityStatus,
  ChangePasswordRequest,
  ConsentDecisionResult,
  CreateSessionResponse,
  DecideApprovalResult,
  InputOrigin,
  ImportField,
  ImportOutcomesResponse,
  ImportUploadResponse,
  LoginRequest,
  MetricsSummary,
  RegisterRequest,
  RemediationAvailability,
  Roster,
  SendMessageResponse,
  StaffTicketDetail,
  StaffTicketFilters,
  StaffTicketRow,
  ProfileFieldHistoryEntry,
  ProfileFieldName,
  ProfileFieldsSaveResponse,
  ProfileFieldSubmission,
  ProfileStaffEntry,
  MyTicket,
  SupportProfile,
  TicketDetail,
  TicketStatus,
  TicketSummary,
  TranscriptionResponse,
} from "../lib/types";

export class ApiError extends Error {
  code: string;
  status: number;
  /** Extra top-level fields from the error response (e.g. `currentAssignee` on a
   * takeover conflict). */
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as (ApiErrorBody & Record<string, unknown>) | null;
    const details: Record<string, unknown> = {};
    if (body) {
      for (const [key, value] of Object.entries(body)) {
        if (key !== "error") details[key] = value;
      }
    }
    throw new ApiError(res.status, body?.error.code ?? "UNKNOWN_ERROR", body?.error.message ?? res.statusText, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function createSession(): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/sessions", {
    method: "POST",
  });
}

export function listMyTickets(): Promise<{ tickets: MyTicket[] }> {
  return request<{ tickets: MyTicket[] }>("/my/tickets");
}

export function getMyTicket(reference: string): Promise<{ ticket: MyTicket & TicketDetail }> {
  return request<{ ticket: MyTicket & TicketDetail }>(`/my/tickets/${encodeURIComponent(reference)}`);
}

export function getMyProfile(): Promise<{ profile: SupportProfile }> { return request("/my/profile"); }

/**
 * The owner's own save.
 *
 * 007: the response now carries a per-field outcome map alongside the profile. A field
 * staff took over while the page was open comes back `locked` rather than silently
 * applied or silently dropped, and the page explains it on that field.
 */
/** Partial because the owner sends only the fields they still control (007 FR-021):
 * submitting a staff-controlled field would come back refused every time and turn a
 * standing lock into a fresh error message on every save. */
export function updateMyProfile(
  profile: Partial<Pick<SupportProfile, "remoteAccessIds" | "location" | "hardware">>,
): Promise<ProfileFieldsSaveResponse> {
  return request("/my/profile", { method: "PUT", body: JSON.stringify(profile) });
}

export function getStaffUserProfile(accountId: string): Promise<{ profile: SupportProfile }> {
  return request(`/staff/users/${encodeURIComponent(accountId)}/profile`);
}

// --- 007 US2: staff-authoritative per-field editing ---------------------------
//
// These go through the same shared `request()` helper as everything else on the account
// axis, which is exactly right here and exactly wrong for the maintainer console: this
// file sends the session cookie on every call, and the maintainer has no session. The
// console has its own caller in `maintainerApi.ts` so the key can never reach this file.

/**
 * Save one or more fields authoritatively.
 *
 * Each field carries the `setAt` the page loaded as its concurrency token. A refused
 * field comes back in `results` on a `200`, not as a thrown error: some fields may have
 * been saved, and treating the whole response as a failure would discard the rest.
 */
export function saveStaffProfileFields(
  accountId: string,
  fields: Partial<Record<ProfileFieldName, ProfileFieldSubmission>>,
): Promise<ProfileFieldsSaveResponse> {
  return request(`/staff/users/${encodeURIComponent(accountId)}/profile/fields`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
}

/** Hand a field back to the account owner. */
export function releaseStaffProfileField(
  accountId: string,
  field: ProfileFieldName,
): Promise<{ profile: SupportProfile }> {
  return request(
    `/staff/users/${encodeURIComponent(accountId)}/profile/fields/${encodeURIComponent(field)}/release`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** One field's history, newest first. Staff only: there is no owner-facing equivalent
 * call here because there is no owner-facing route to call (FR-018). */
export function getStaffProfileFieldHistory(
  accountId: string,
  field: ProfileFieldName,
): Promise<{ history: ProfileFieldHistoryEntry[] }> {
  return request(
    `/staff/users/${encodeURIComponent(accountId)}/profile/fields/${encodeURIComponent(field)}/history`,
  );
}

/** The staff account directory (007 T043, FR-030 to FR-032).
 *
 * The term is **debounced at the caller**, not here: this module stays a thin map of the
 * HTTP surface, and a timer hidden inside a request function would fire for every caller
 * whether or not they were typing. `AccountDirectoryPage` owns the delay because it owns
 * the keystrokes.
 *
 * An empty result is a `200` with an empty array, so there is no error path to handle
 * for "nobody matched".
 */
export function listStaffAccounts(term?: string): Promise<AccountDirectoryResponse> {
  const query = term?.trim() ? `?q=${encodeURIComponent(term.trim())}` : "";
  return request(`/staff/accounts${query}`);
}

export function appendStaffProfileEntry(
  accountId: string,
  entry: Pick<ProfileStaffEntry, "kind" | "field" | "value">,
): Promise<{ profile: SupportProfile }> {
  return request(`/staff/users/${encodeURIComponent(accountId)}/profile/entries`, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export function getStaffCredentialStatus(accountId: string): Promise<{ usingInitialPassword: boolean }> {
  return request(`/staff/users/${encodeURIComponent(accountId)}/credentials`);
}

export function resetStaffCredentials(accountId: string, newInitialPassword: string): Promise<{ usingInitialPassword: boolean }> {
  return request(`/staff/users/${encodeURIComponent(accountId)}/credentials/reset`, {
    method: "POST",
    body: JSON.stringify({ newInitialPassword }),
  });
}

export function sendMessage(
  conversationId: string,
  sessionId: string,
  text: string,
  inputOrigin: InputOrigin = "typed",
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ sessionId, text, inputOrigin }),
  });
}

export async function transcribe(sessionId: string, wavBlob: Blob): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("audio", wavBlob, "audio.wav");

  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/transcriptions`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error.code ?? "UNKNOWN_ERROR", body?.error.message ?? res.statusText);
  }

  return (await res.json()) as TranscriptionResponse;
}

export function listTickets(sessionId: string): Promise<{ tickets: TicketSummary[] }> {
  return request<{ tickets: TicketSummary[] }>(`/tickets?sessionId=${encodeURIComponent(sessionId)}`);
}

export function getTicket(reference: string, sessionId: string): Promise<{ ticket: TicketDetail }> {
  return request<{ ticket: TicketDetail }>(
    `/tickets/${encodeURIComponent(reference)}?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

export function register(payload: RegisterRequest): Promise<Account> {
  return request<Account>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export function login(payload: LoginRequest): Promise<Account> {
  return request<Account>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<Account> {
  return request<Account>("/auth/me");
}

export function changePassword(payload: ChangePasswordRequest): Promise<Account> {
  return request<Account>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) });
}

export function listStaffTickets(filters: StaffTicketFilters = {}): Promise<{ tickets: StaffTicketRow[] }> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (typeof filters.escalated === "boolean") params.set("escalated", String(filters.escalated));
  if (filters.sort) params.set("sort", filters.sort);
  const query = params.toString();
  return request<{ tickets: StaffTicketRow[] }>(`/staff/tickets${query ? `?${query}` : ""}`);
}

export function getStaffTicket(reference: string): Promise<{ ticket: StaffTicketDetail }> {
  return request<{ ticket: StaffTicketDetail }>(`/staff/tickets/${encodeURIComponent(reference)}`);
}

export function updateStaffTicketStatus(
  reference: string,
  status: TicketStatus,
): Promise<{ ticket: TicketDetail }> {
  return request<{ ticket: TicketDetail }>(`/staff/tickets/${encodeURIComponent(reference)}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function takeoverTicket(reference: string): Promise<{ ticket: StaffTicketDetail }> {
  return request<{ ticket: StaffTicketDetail }>(`/staff/tickets/${encodeURIComponent(reference)}/takeover`, {
    method: "POST",
  });
}

export function reassignTicket(reference: string, toAccountId: string): Promise<{ ticket: StaffTicketDetail }> {
  return request<{ ticket: StaffTicketDetail }>(`/staff/tickets/${encodeURIComponent(reference)}/assignee`, {
    method: "POST",
    body: JSON.stringify({ toAccountId }),
  });
}

export function getRoster(): Promise<Roster> {
  return request<Roster>("/staff/roster");
}

export function updateAvailability(availability: AvailabilityStatus): Promise<{ availability: AvailabilityStatus }> {
  return request<{ availability: AvailabilityStatus }>("/staff/availability", {
    method: "PUT",
    body: JSON.stringify({ availability }),
  });
}

export function uploadImport(file: File): Promise<ImportUploadResponse> {
  const body = new FormData(); body.append("file", file);
  return fetch("/api/staff/imports", { method: "POST", credentials: "include", body }).then(async r => { if (!r.ok) throw new Error("Import upload failed"); return r.json(); });
}
export function mapImport(id: string, mapping: Partial<Record<string, ImportField>>): Promise<{ ok: true }> { return request<{ ok: true }>(`/staff/imports/${id}/mapping`, { method: "PUT", body: JSON.stringify({ mapping }) }); }
export function previewImport(id: string): Promise<ImportOutcomesResponse> { return request<ImportOutcomesResponse>(`/staff/imports/${id}/preview`, { method: "POST" }); }
export function applyImport(id: string): Promise<ImportOutcomesResponse> { return request<ImportOutcomesResponse>(`/staff/imports/${id}/apply`, { method: "POST" }); }

// --- 005: Constrained Automated Remediation --------------------------------

export function recordActionConsent(
  ticketId: string,
  sessionId: string,
  proposalId: string,
  granted: boolean,
): Promise<{ result: ConsentDecisionResult }> {
  return request<{ result: ConsentDecisionResult }>(
    `/tickets/${encodeURIComponent(ticketId)}/actions/consent?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ proposalId, granted }),
    },
  );
}

export function getTicketActions(
  ticketId: string,
  sessionId: string,
): Promise<{ actions: ActionRecord[]; approvals: ApprovalRequest[] }> {
  return request<{ actions: ActionRecord[]; approvals: ApprovalRequest[] }>(
    `/tickets/${encodeURIComponent(ticketId)}/actions?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

export function listApprovals(status?: ApprovalRequest["status"]): Promise<{ approvals: ApprovalRequest[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ approvals: ApprovalRequest[] }>(`/staff/approvals${query}`);
}

export function approveApproval(approvalId: string): Promise<{ result: DecideApprovalResult }> {
  return request<{ result: DecideApprovalResult }>(`/staff/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: "POST",
  });
}

export function declineApproval(approvalId: string, reason?: string): Promise<{ result: DecideApprovalResult }> {
  return request<{ result: DecideApprovalResult }>(`/staff/approvals/${encodeURIComponent(approvalId)}/decline`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export interface StaffActionFilters {
  ticketId?: string;
  endpointId?: string;
  outcome?: ActionRecord["outcome"];
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface StaffActionsPage {
  actions: ActionRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export function listStaffActions(filters: StaffActionFilters = {}): Promise<StaffActionsPage> {
  const params = new URLSearchParams();
  if (filters.ticketId) params.set("ticketId", filters.ticketId);
  if (filters.endpointId) params.set("endpointId", filters.endpointId);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const query = params.toString();
  return request<StaffActionsPage>(`/staff/actions${query ? `?${query}` : ""}`);
}

export function getRemediationAvailability(): Promise<RemediationAvailability> {
  return request<RemediationAvailability>("/staff/remediation");
}

export type RemediationToggleScope = { scope: "global" } | { scope: "endpoint"; endpointId: string };

export function toggleRemediation(
  scope: RemediationToggleScope,
  enabled: boolean,
): Promise<RemediationAvailability> {
  return request<RemediationAvailability>("/staff/remediation/toggle", {
    method: "POST",
    body: JSON.stringify({ ...scope, enabled }),
  });
}

export function getMetrics(period: MetricsSummary["period"]["preset"] = "30d"): Promise<MetricsSummary> {
  return request<MetricsSummary>(`/staff/metrics?period=${encodeURIComponent(period)}`);
}
