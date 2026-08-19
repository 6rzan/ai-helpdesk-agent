import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";
import {
  actionPolicyFileSchema,
  endpointRegistryFileSchema,
  validatePolicyAgainstRegistry,
  type ActionPolicyEntry,
  type ActionPolicyFile,
  type EndpointRegistryFile,
  type TestEndpoint,
} from "./policy-schema.js";

// R3/FR-005: two committed JSON files, read once at startup, validated, and
// frozen. There is no write path anywhere in this module or its callers —
// that is what makes "the policy cannot be modified at runtime" a structural
// property instead of a promise.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_POLICY_PATH = path.join(__dirname, "action-policy.json");
export const DEFAULT_REGISTRY_PATH = path.join(__dirname, "test-endpoints.json");

export interface LoadedPolicy {
  available: boolean;
  policy: Readonly<ActionPolicyFile> | null;
  registry: Readonly<EndpointRegistryFile> | null;
  /** Policy entries indexed by id, for the exact-match lookups the engine needs. */
  entries: ReadonlyMap<string, ActionPolicyEntry>;
  /** Endpoints indexed by id. */
  endpoints: ReadonlyMap<string, TestEndpoint>;
  error?: string;
}

function unavailable(error: string): LoadedPolicy {
  logger.error({ error }, "remediation.policy.unavailable");
  return { available: false, policy: null, registry: null, entries: new Map(), endpoints: new Map(), error };
}

/**
 * Reads and validates the policy and registry files at the given paths. Any
 * failure — missing file, malformed JSON, a schema violation, an empty entry
 * list, or an `allowedEndpointIds` value with no registry match — resolves to
 * `available: false` rather than throwing, so a bad policy file degrades
 * remediation to unavailable instead of crashing the server (edge case).
 */
export function loadPolicyFromDisk(policyPath: string = DEFAULT_POLICY_PATH, registryPath: string = DEFAULT_REGISTRY_PATH): LoadedPolicy {
  let policyRaw: string;
  let registryRaw: string;
  try {
    policyRaw = readFileSync(policyPath, "utf8");
    registryRaw = readFileSync(registryPath, "utf8");
  } catch (err) {
    return unavailable(`could not read policy or registry file: ${err instanceof Error ? err.message : String(err)}`);
  }

  let policyJson: unknown;
  let registryJson: unknown;
  try {
    policyJson = JSON.parse(policyRaw);
    registryJson = JSON.parse(registryRaw);
  } catch (err) {
    return unavailable(`policy or registry file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const policyResult = actionPolicyFileSchema.safeParse(policyJson);
  const registryResult = endpointRegistryFileSchema.safeParse(registryJson);
  if (!policyResult.success) {
    return unavailable(`policy file failed schema validation: ${policyResult.error.message}`);
  }
  if (!registryResult.success) {
    return unavailable(`registry file failed schema validation: ${registryResult.error.message}`);
  }
  if (policyResult.data.entries.length === 0) {
    return unavailable("policy file has no entries");
  }

  const crossIssues = validatePolicyAgainstRegistry(policyResult.data, registryResult.data);
  if (crossIssues.length > 0) {
    return unavailable(crossIssues.join("; "));
  }

  const entries = new Map(policyResult.data.entries.map((e) => [e.id, e] as const));
  const endpoints = new Map(registryResult.data.entries.map((e) => [e.id, e] as const));

  return {
    available: true,
    policy: Object.freeze(policyResult.data),
    registry: Object.freeze(registryResult.data),
    entries,
    endpoints,
  };
}

let cached: LoadedPolicy | undefined;

/** Read-only accessor. Loads once and caches — never re-reads mid-run. */
export function getPolicy(): LoadedPolicy {
  cached ??= loadPolicyFromDisk();
  return cached;
}

/** Test-only: force a re-load (optionally from custom paths) on the next getPolicy() call. */
export function resetPolicyCacheForTest(): void {
  cached = undefined;
}
