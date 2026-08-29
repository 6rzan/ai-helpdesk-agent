import type { ApiErrorBody } from "../lib/types";
import type {
  MaintainerCategoriesResponse,
  MaintainerCategory,
  MaintainerCategoryCreateRequest,
  MaintainerCategoryUpdateRequest,
  MaintainerGuidePublishRequest,
  MaintainerGuidePublishResponse,
  MaintainerGuideVersionsResponse,
  MaintainerStatus,
} from "../lib/maintainerTypes";

/**
 * The maintainer console's API client (007 T017, FR-014, FR-015, research.md R3).
 *
 * **This file deliberately shares no code path with `services/api.ts`.** That helper
 * sends `credentials: "include"` on every call, which is right for the account axis and
 * wrong here: the maintainer is not an account and has no session. Teaching the shared
 * helper about a maintainer key would put the key one bug away from every ordinary app
 * request, so the duplication below is the point rather than an oversight.
 *
 * Three rules hold for every function here:
 *
 *   1. The key is a **parameter**, never module state. There is no `setKey`, no default
 *      header, and no cached credential — the console holds it in React state and hands
 *      it over per call (FR-014).
 *   2. `credentials` is never set, so no cookie is sent or accepted on this axis.
 *   3. The key never reaches a URL, so it cannot end up in a browser history entry, a
 *      server access log, or a referrer header.
 */

export class MaintainerApiError extends Error {
  code: string;
  status: number;
  /** Extra top-level fields from the error body: `retryAfterSeconds` on a throttled
   * sign-in, `stepIndex` and `field` on a rejected guide step. */
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "MaintainerApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Cooling-off period reported by the server, in seconds, or `null` if this is not a
   * throttled response. Read from the server rather than counted locally: the threshold
   * and window are backend policy, and a client-side countdown would drift out of
   * agreement with the behaviour it describes. */
  get retryAfterSeconds(): number | null {
    const value = this.details["retryAfterSeconds"];
    return typeof value === "number" ? value : null;
  }

  /** Zero-based index of the offending guide step, or `null`. */
  get stepIndex(): number | null {
    const value = this.details["stepIndex"];
    return typeof value === "number" ? value : null;
  }

  /** Name of the offending field within that step, or `null`. */
  get field(): string | null {
    const value = this.details["field"];
    return typeof value === "string" ? value : null;
  }
}

export interface MaintainerCredentials {
  key: string;
  name: string;
}

async function maintainerRequest<T>(
  credentials: MaintainerCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/maintainer${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-maintainer-key": credentials.key,
      "x-maintainer-name": credentials.name,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | (ApiErrorBody & Record<string, unknown>)
      | null;
    const details: Record<string, unknown> = {};
    if (body) {
      for (const [key, value] of Object.entries(body)) {
        if (key !== "error") details[key] = value;
      }
    }
    throw new MaintainerApiError(
      res.status,
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? res.statusText,
      details,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Is maintainer administration enabled?
 *
 * The only call here that takes no credentials, because the probe is unauthenticated
 * and always mounted. The console reads it *before* rendering a sign-in form, so it
 * never presents a form that cannot succeed (FR-005).
 */
export async function getMaintainerStatus(): Promise<MaintainerStatus> {
  const res = await fetch("/api/maintainer/status");
  if (!res.ok) {
    throw new MaintainerApiError(res.status, "MAINTAINER_STATUS_UNAVAILABLE", res.statusText);
  }
  return (await res.json()) as MaintainerStatus;
}

export function listMaintainerCategories(
  credentials: MaintainerCredentials,
): Promise<MaintainerCategoriesResponse> {
  return maintainerRequest<MaintainerCategoriesResponse>(credentials, "/categories");
}

export function createMaintainerCategory(
  credentials: MaintainerCredentials,
  body: MaintainerCategoryCreateRequest,
): Promise<{ category: MaintainerCategory; guide: MaintainerGuidePublishResponse }> {
  return maintainerRequest(credentials, "/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMaintainerCategory(
  credentials: MaintainerCredentials,
  name: string,
  body: MaintainerCategoryUpdateRequest,
): Promise<{ category: MaintainerCategory }> {
  return maintainerRequest(credentials, `/categories/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Retires a category. Never deletes one: existing tickets keep it. */
export function retireMaintainerCategory(
  credentials: MaintainerCredentials,
  name: string,
): Promise<{ category: MaintainerCategory }> {
  return maintainerRequest(credentials, `/categories/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function publishMaintainerGuide(
  credentials: MaintainerCredentials,
  name: string,
  body: MaintainerGuidePublishRequest,
): Promise<MaintainerGuidePublishResponse> {
  return maintainerRequest(credentials, `/categories/${encodeURIComponent(name)}/guide`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Read-only. There is no revert, restore, edit, or delete call for a version, because
 * no such endpoint exists — versions are immutable. */
export function listMaintainerGuideVersions(
  credentials: MaintainerCredentials,
  name: string,
): Promise<MaintainerGuideVersionsResponse> {
  return maintainerRequest(
    credentials,
    `/categories/${encodeURIComponent(name)}/guide/versions`,
  );
}
