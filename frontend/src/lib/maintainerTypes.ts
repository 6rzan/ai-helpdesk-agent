// Maintainer console view shapes, from
// `specs/007-admin-console-account-editing/contracts/api.md`.
//
// Split out of `types.ts` at 007 T060, which had reached 719 lines against the
// constitution's 500-line limit (Principle VI). This module is its own file rather
// than part of `profileTypes.ts` because the console is a separate axis from the
// account surfaces entirely: no account, no session, no profile (FR-015). The
// console pages and `services/maintainerApi.ts` import from here directly rather
// than through `types.ts`, which keeps the maintainer shapes out of the module
// every account-facing page pulls in.

import type { ApiErrorBody } from "./types";

/** `GET /api/maintainer/status`. Unauthenticated and always mounted, including
 * when administration is switched off — that is the whole point of it, and the
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

/** A sign-in refused while cooling off. The remaining time is the server's to
 * report: a client-side countdown would drift and could be edited (FR-034). */
export interface MaintainerThrottledError extends ApiErrorBody {
  retryAfterSeconds: number;
}
