import type { Types } from "mongoose";
import { getPolicy } from "../../policy/policy-loader.js";
import type { ActionPolicyEntry, TestEndpoint } from "../../policy/policy-schema.js";
import { isRemediationAvailable } from "./availability-service.js";
import { recordAction, type ApprovalReferenceInput, type ConsentRecordInput } from "./audit-service.js";
import type { Actor, ActionOutcome, RefusalReason } from "../../models/enums.js";

// The default-deny policy engine (Constitution Principle II, FR-002, FR-006).
// This module is the ONLY caller of the executor anywhere in the codebase —
// every tool, every consent flow, and every approval decision routes an
// attempt through `attemptAction` below. Matching is exact: an action id,
// every argument, and the target endpoint must all match a policy entry
// exactly, or the attempt is refused and audited with a specific reason.
// There is no fuzzy, prefix, or nearest-neighbour acceptance anywhere here.

export interface ExecutionRequest {
  endpoint: TestEndpoint;
  command: string;
  timeoutMs: number;
}

export interface ExecutionResult {
  outcome: "succeeded" | "failed" | "timed_out";
  observedOutput: string | null;
  durationMs: number;
}

export type Executor = (request: ExecutionRequest) => Promise<ExecutionResult>;

let executor: Executor | undefined;

/** Wired once at startup by the real ssh2-backed executor (executor.ts, T038). */
export function setExecutor(fn: Executor): void {
  executor = fn;
}

/** Test-only: install a stub executor, or clear it to force the "not configured" path. */
export function setExecutorForTest(fn: Executor | undefined): void {
  executor = fn;
}

export type MatchResult =
  | { ok: true; entry: ActionPolicyEntry; endpoint: TestEndpoint; command: string }
  | { ok: false; reason: RefusalReason };

const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;

function substitute(command: string, args: Record<string, string>): string {
  return command.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => args[name] ?? "");
}

/**
 * Pure exact-match decision: does (policyEntryId, args, endpointId) resolve to
 * exactly one whitelisted, endpoint-permitted action? No side effects, no
 * execution, no audit write — callers decide what to do with the result.
 */
export function matchAction(policyEntryId: string, args: Record<string, string>, endpointId: string): MatchResult {
  const policy = getPolicy();

  const entry = policy.available ? policy.entries.get(policyEntryId) : undefined;
  if (!entry) {
    return { ok: false, reason: "no_matching_entry" };
  }

  const declaredNames = new Set(entry.arguments.map((spec) => spec.name));
  for (const key of Object.keys(args)) {
    if (!declaredNames.has(key)) {
      return { ok: false, reason: "argument_mismatch" };
    }
  }
  for (const spec of entry.arguments) {
    const value = args[spec.name];
    if (value === undefined) {
      return { ok: false, reason: "argument_mismatch" };
    }
    if (spec.kind === "enum") {
      if (!spec.values.includes(value)) {
        return { ok: false, reason: "argument_mismatch" };
      }
    } else {
      const anchored = new RegExp(`^(?:${spec.pattern})$`);
      if (!anchored.test(value)) {
        return { ok: false, reason: "argument_mismatch" };
      }
    }
  }

  const endpoint = policy.endpoints.get(endpointId);
  if (!endpoint) {
    return { ok: false, reason: "unregistered_target" };
  }
  if (!entry.allowedEndpointIds.includes(endpointId)) {
    return { ok: false, reason: "endpoint_not_permitted" };
  }

  return { ok: true, entry, endpoint, command: substitute(entry.command, args) };
}

export interface AttemptActionInput {
  actor: Actor;
  ticketId: Types.ObjectId | null;
  conversationId: Types.ObjectId | null;
  classifiedIntent: string;
  policyEntryId: string;
  arguments: Record<string, string>;
  endpointId: string;
  consent?: ConsentRecordInput | null;
  approval?: ApprovalReferenceInput | null;
}

export interface AttemptActionResult {
  outcome: "succeeded" | "failed" | "timed_out" | "attempted_unverified" | "refused";
  refusalReason?: RefusalReason;
  observedOutput: string | null;
  actionRecordId?: Types.ObjectId;
}

type VerificationJudgement = "confirmed" | "contradicted" | "inconclusive";

/**
 * R10: interprets a verification read against the state-changing entry it is
 * judging. Keyed by the state-changing entry's id (not the shared `verifiedBy`
 * entry) because the same read-only check means different things for
 * different actions — e.g. `account-status` output is read one way to confirm
 * an unlock and another way to confirm a password expiry. Deliberately exact,
 * substring-anchored matching on the known script output vocabulary — no
 * inference, consistent with the rest of this module.
 */
function judgeVerification(policyEntryId: string, output: string | null): VerificationJudgement {
  if (!output) {
    return "inconclusive";
  }
  switch (policyEntryId) {
    case "unlock-account":
      if (/\blocked=false\b/.test(output)) return "confirmed";
      if (/\blocked=true\b/.test(output)) return "contradicted";
      return "inconclusive";
    case "expire-password":
      if (/\bpassword_change_required=true\b/.test(output)) return "confirmed";
      if (/\bpassword_change_required=false\b/.test(output)) return "contradicted";
      return "inconclusive";
    case "clear-print-queue":
      if (/\bqueue_empty=true\b/.test(output)) return "confirmed";
      if (/^printer=/m.test(output)) return "contradicted";
      return "inconclusive";
    case "restart-service":
      if (/\bis running\b/.test(output)) return "confirmed";
      if (/\bis not running\b/.test(output)) return "contradicted";
      return "inconclusive";
    default:
      return "inconclusive";
  }
}

/**
 * The single funnel every proposed action passes through: exact match, the
 * availability gate (checked immediately before execution, never cached),
 * tier-appropriate authorisation, then — and only then — the executor. Every
 * outcome, executed or refused, is audited (FR-009, FR-010).
 */
export async function attemptAction(input: AttemptActionInput): Promise<AttemptActionResult> {
  const match = matchAction(input.policyEntryId, input.arguments, input.endpointId);

  if (!match.ok) {
    await recordAction({
      actor: input.actor,
      ticketId: input.ticketId,
      conversationId: input.conversationId,
      classifiedIntent: input.classifiedIntent,
      policyEntryId: null,
      tier: null,
      requestedAction: input.policyEntryId,
      arguments: input.arguments,
      endpointId: null,
      consent: input.consent ?? null,
      approval: input.approval ?? null,
      outcome: "refused",
      refusalReason: match.reason,
    });
    return { outcome: "refused", refusalReason: match.reason, observedOutput: null };
  }

  const { entry, endpoint, command } = match;

  const available = await isRemediationAvailable(endpoint.id);
  if (!available) {
    await recordAction({
      actor: input.actor,
      ticketId: input.ticketId,
      conversationId: input.conversationId,
      classifiedIntent: input.classifiedIntent,
      policyEntryId: entry.id,
      tier: entry.tier,
      requestedAction: command,
      arguments: input.arguments,
      endpointId: endpoint.id,
      consent: input.consent ?? null,
      approval: input.approval ?? null,
      outcome: "refused",
      refusalReason: "remediation_disabled",
    });
    return { outcome: "refused", refusalReason: "remediation_disabled", observedOutput: null };
  }

  if (!input.consent?.given) {
    await recordAction({
      actor: input.actor,
      ticketId: input.ticketId,
      conversationId: input.conversationId,
      classifiedIntent: input.classifiedIntent,
      policyEntryId: entry.id,
      tier: entry.tier,
      requestedAction: command,
      arguments: input.arguments,
      endpointId: endpoint.id,
      consent: input.consent ?? null,
      approval: input.approval ?? null,
      outcome: "refused",
      refusalReason: "missing_consent",
    });
    return { outcome: "refused", refusalReason: "missing_consent", observedOutput: null };
  }

  if (entry.tier === "state_changing" && !input.approval) {
    await recordAction({
      actor: input.actor,
      ticketId: input.ticketId,
      conversationId: input.conversationId,
      classifiedIntent: input.classifiedIntent,
      policyEntryId: entry.id,
      tier: entry.tier,
      requestedAction: command,
      arguments: input.arguments,
      endpointId: endpoint.id,
      consent: input.consent ?? null,
      approval: input.approval ?? null,
      outcome: "refused",
      refusalReason: "missing_approval",
    });
    return { outcome: "refused", refusalReason: "missing_approval", observedOutput: null };
  }

  if (!executor) {
    throw new Error("policy-engine: no executor configured (setExecutor was never called)");
  }

  const startedAt = Date.now();
  const result = await executor({
    endpoint,
    command,
    timeoutMs: entry.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
  });
  const durationMs = Date.now() - startedAt;

  // R10: a state-changing action's own "succeeded" exit code is not trusted on
  // its own — its named verification entry is read afterward, and only a
  // confirming observation reports success. Read-only actions and any
  // non-succeeded state-changing attempt skip this (nothing to verify).
  let outcome: ActionOutcome = result.outcome;
  let verification: { entryId: string; outcome: ActionOutcome; observedOutput: string | null } | null = null;

  if (entry.tier === "state_changing" && result.outcome === "succeeded") {
    if (!entry.verifiedBy) {
      outcome = "attempted_unverified";
    } else {
      const verifyMatch = matchAction(entry.verifiedBy, input.arguments, endpoint.id);
      if (!verifyMatch.ok) {
        outcome = "attempted_unverified";
        verification = { entryId: entry.verifiedBy, outcome: "refused", observedOutput: null };
      } else {
        const verifyResult = await executor({
          endpoint: verifyMatch.endpoint,
          command: verifyMatch.command,
          timeoutMs: verifyMatch.entry.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
        });
        verification = {
          entryId: entry.verifiedBy,
          outcome: verifyResult.outcome,
          observedOutput: verifyResult.observedOutput,
        };
        if (verifyResult.outcome !== "succeeded") {
          outcome = "attempted_unverified";
        } else {
          const judgement = judgeVerification(entry.id, verifyResult.observedOutput);
          outcome = judgement === "confirmed" ? "succeeded" : judgement === "contradicted" ? "failed" : "attempted_unverified";
        }
      }
    }
  }

  const record = await recordAction({
    actor: input.actor,
    ticketId: input.ticketId,
    conversationId: input.conversationId,
    classifiedIntent: input.classifiedIntent,
    policyEntryId: entry.id,
    tier: entry.tier,
    requestedAction: command,
    arguments: input.arguments,
    endpointId: endpoint.id,
    consent: input.consent ?? null,
    approval: input.approval ?? null,
    outcome,
    observedOutput: result.observedOutput,
    verification,
    durationMs,
  });

  return { outcome, observedOutput: result.observedOutput, actionRecordId: record._id };
}
