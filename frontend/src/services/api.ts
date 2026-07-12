import type {
  ApiErrorBody,
  CreateSessionResponse,
  InputOrigin,
  SendMessageResponse,
  TicketDetail,
  TicketSummary,
  TranscriptionResponse,
} from "../lib/types";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error.code ?? "UNKNOWN_ERROR", body?.error.message ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function createSession(orgId: string, displayName: string): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({ orgId, displayName }),
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
