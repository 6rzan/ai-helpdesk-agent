import { getPolicy } from "../../../policy/policy-loader.js";
import { accountStatusTool } from "./account-status.js";
import { clearPrintQueueTool } from "./clear-print-queue.js";
import { expirePasswordTool } from "./expire-password.js";
import { networkProbeTool } from "./network-probe.js";
import { peripheralListTool } from "./peripheral-list.js";
import { printQueueStatusTool } from "./print-queue-status.js";
import { restartServiceTool } from "./restart-service.js";
import { serviceStatusTool } from "./service-status.js";
import { unlockAccountTool } from "./unlock-account.js";
import type { RegisteredTool } from "./types.js";

export type { RegisteredTool } from "./types.js";

// contracts/tools.md: all nine tools. The four state-changing ones
// (unlock_account, expire_password, clear_print_queue, restart_service) route
// through approval-gated execution (Phase 5) — consent-service raises an
// approval request for any of these instead of executing directly; the read-
// only five still execute immediately on consent.
const REGISTERED_TOOLS: RegisteredTool[] = [
  accountStatusTool,
  networkProbeTool,
  printQueueStatusTool,
  peripheralListTool,
  serviceStatusTool,
  unlockAccountTool,
  expirePasswordTool,
  clearPrintQueueTool,
  restartServiceTool,
];

/**
 * Every registered tool must map 1:1 onto a real policy entry (FR-013,
 * contracts/tools.md). A tool with no matching entry — a typo, a stale
 * reference after a policy edit — fails loudly at startup rather than
 * silently never being selectable or, worse, being selectable with no policy
 * behind it. An entry with no tool is fine (e.g. a `verifiedBy`-only entry).
 */
export function validateToolRegistry(): string[] {
  const errors: string[] = [];
  const policy = getPolicy();
  const seenNames = new Set<string>();

  for (const tool of REGISTERED_TOOLS) {
    if (seenNames.has(tool.name)) {
      errors.push(`duplicate tool name: ${tool.name}`);
    }
    seenNames.add(tool.name);

    if (!policy.available) {
      errors.push(`policy unavailable: cannot validate tool "${tool.name}"`);
      continue;
    }
    if (!policy.entries.has(tool.policyEntryId)) {
      errors.push(`tool "${tool.name}" references unknown policy entry "${tool.policyEntryId}"`);
    }
  }

  return errors;
}

export function getRegisteredTools(): readonly RegisteredTool[] {
  return REGISTERED_TOOLS;
}

export function getToolRegistryMap(): ReadonlyMap<string, RegisteredTool> {
  return new Map(REGISTERED_TOOLS.map((tool) => [tool.name, tool]));
}

/**
 * Tools whose policy entry names this exact guided step (research.md R5,
 * `${categoryName}:${stepIndex}`, 0-indexed). Consent-service uses this to
 * offer a diagnostic only at the moments the guided flow actually reaches —
 * never woven into step transition itself (FR-014).
 */
export function getToolsForGuideStep(categoryName: string, stepIndex: number): RegisteredTool[] {
  const stepRef = `${categoryName}:${stepIndex}`;
  const policy = getPolicy();
  if (!policy.available) {
    return [];
  }
  return REGISTERED_TOOLS.filter((tool) => policy.entries.get(tool.policyEntryId)?.guidedStepRef === stepRef);
}
