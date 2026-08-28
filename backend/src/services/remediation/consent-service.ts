import { randomUUID } from "node:crypto";
import type { HydratedDocument, Types } from "mongoose";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { ActionRecord, type ActionRecordDoc } from "../../models/action-record.js";
import type { RefusalReason } from "../../models/enums.js";
import { Message } from "../../models/message.js";
import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { getPolicy } from "../../policy/policy-loader.js";
import { publishEvent, publishStaffEvent } from "../../api/sse/event-bus.js";
import { runAgentLoop, type Planner, type ToolLike } from "../agent/agent-loop.js";
import { getToolsForGuideStep, type RegisteredTool } from "../agent/tools/index.js";
import { describeArgumentSchema } from "../agent/tools/argument-hint.js";
import { escalateTicketForGuidance, sendAgentReply } from "../conversation/conversation-guidance.js";
import { getLlmProvider } from "../llm/factory.js";
import type { ConversationTurn } from "../llm/types.js";
import { recordAction } from "./audit-service.js";
import { asClause } from "./disclosure.js";
import { isRemediationAvailable } from "./availability-service.js";
import { attemptAction } from "./policy-engine.js";
import { raiseApprovalRequest } from "./approval-service.js";

// T043: proposal issuance and consent recording. This is the one place that
// decides *whether to offer* a registered diagnostic at a guided step
// (research.md R5 "Plan"), and the one place a reporter's explicit decision on
// that specific offer is recorded (FR-004). Execution itself always goes
// through policy-engine.attemptAction — nothing here calls the executor.

export interface StepProposalContext {
  sessionId: string;
  conversationId: Types.ObjectId;
  ticket: HydratedDocument<TicketDoc>;
  categoryName: string;
  stepIndex: number;
  history: ConversationTurn[];
  stepInstruction: string;
}

export interface StepProposalOutcome {
  text: string;
  proposalId: string;
}

function toolLikeMap(tools: RegisteredTool[]): Map<string, ToolLike> {
  return new Map(tools.map((tool) => [tool.name, tool as ToolLike]));
}

/**
 * `degradedRef` is a closure-captured mutable flag rather than a field on the
 * agent loop's own types (agent-loop.ts stays pure/provider-agnostic): it
 * records whether the most recent proposal this planner returned came from a
 * fallback LLM provider (`ProposeActionResult.degraded`, US6/FR-025). The
 * caller reads it once `runAgentLoop` settles on a valid proposal.
 */
function makeLlmPlanner(
  history: ConversationTurn[],
  stepInstruction: string,
  tools: { name: string; description: string }[],
  degradedRef: { current: boolean },
  ticketId: Types.ObjectId,
): Planner {
  const provider = getLlmProvider();
  return async (attempts) => {
    const result = await provider.proposeAction({
      history,
      latestMessage: stepInstruction,
      stepInstruction,
      tools,
      attempts: attempts.map((attempt) => ({
        toolName: attempt.proposal.toolName,
        arguments: attempt.proposal.arguments,
        valid: attempt.valid,
      })),
      ticketId: ticketId.toString(),
    });
    if (!result.ok || !result.proposal) {
      return null;
    }
    degradedRef.current = result.degraded === true;
    return result.proposal;
  };
}

/**
 * Called only at the points the guided flow presents a step (T046) — never
 * woven into step transition or version pinning (FR-014). Returns null
 * whenever there is nothing to offer: no tool maps to this exact step, every
 * candidate already failed for this ticket (contracts/tools.md), remediation
 * is unavailable, or the model's own plan step never validates. A validated
 * plan reaching the loop's own bound (cap or no-progress) escalates the
 * ticket instead of silently saying nothing, since the employee is at a point
 * a diagnostic was expected to apply (T051, FR-011/FR-012).
 */
export async function proposeActionForStep(ctx: StepProposalContext): Promise<StepProposalOutcome | null> {
  if (ctx.ticket.pendingActionProposal) {
    return null;
  }

  const candidates = getToolsForGuideStep(ctx.categoryName, ctx.stepIndex);
  if (candidates.length === 0) {
    return null;
  }

  const failedPolicyEntryIds = new Set(
    await ActionRecord.find({ ticketId: ctx.ticket._id, outcome: { $in: ["failed", "timed_out"] } }).distinct(
      "policyEntryId",
    ),
  );
  const untried = candidates.filter((tool) => !failedPolicyEntryIds.has(tool.policyEntryId));
  if (untried.length === 0) {
    // FR-012 edge case: every candidate for this step already failed for
    // this ticket. Never re-offer it silently -- the refusal is audited like
    // any other, not just swallowed as "nothing to propose" (FR-009).
    await recordAction({
      actor: "agent",
      ticketId: ctx.ticket._id,
      conversationId: ctx.conversationId,
      classifiedIntent: ctx.stepInstruction,
      requestedAction: candidates.map((tool) => tool.policyEntryId).join(", "),
      outcome: "refused",
      refusalReason: "already_attempted",
    });
    return null;
  }

  const policy = getPolicy();
  if (!policy.available) {
    return null;
  }

  const runnable: RegisteredTool[] = [];
  for (const tool of untried) {
    const entry = policy.entries.get(tool.policyEntryId);
    const endpointId = entry?.allowedEndpointIds[0];
    if (endpointId && (await isRemediationAvailable(endpointId))) {
      runnable.push(tool);
    }
  }
  if (runnable.length === 0) {
    return null;
  }

  const degradedRef = { current: false };
  const planner = makeLlmPlanner(
    ctx.history,
    ctx.stepInstruction,
    runnable.map((tool) => ({
      name: tool.name,
      // LLM-facing only (T046 fix): appends a schema-derived argument hint so
      // the model knows the exact argument key(s) and enum value(s) to use,
      // never mixed into `tool.description` itself — that string is also
      // shown verbatim to the employee in chat and the audit trail below.
      description: `${tool.description} ${describeArgumentSchema(tool.argumentSchema)}`.trim(),
    })),
    degradedRef,
    ctx.ticket._id,
  );

  const result = await runAgentLoop(planner, toolLikeMap(runnable));

  if (result.outcome === "escalate") {
    await escalateTicketForGuidance(
      { sessionId: ctx.sessionId, conversationId: ctx.conversationId, reporterId: ctx.ticket.reporterId, text: "" },
      ctx.ticket,
      "remediation_issue",
    );
    return null;
  }

  const tool = runnable.find((candidate) => candidate.name === result.toolName);
  const entry = policy.entries.get(tool?.policyEntryId ?? "");
  const endpointId = entry?.allowedEndpointIds[0];
  const endpoint = endpointId ? policy.endpoints.get(endpointId) : undefined;
  if (!tool || !entry || !endpoint) {
    return null;
  }

  if (degradedRef.current) {
    // US6 AS4/FR-025: no automated action executes on a classification
    // produced while the system is in a degraded model state -- refused and
    // audited here, before the reporter is ever offered it.
    await attemptAction({
      actor: "agent",
      ticketId: ctx.ticket._id,
      conversationId: ctx.conversationId,
      classifiedIntent: ctx.stepInstruction,
      policyEntryId: tool.policyEntryId,
      arguments: result.arguments as Record<string, string>,
      endpointId: endpoint.id,
      modelDegraded: true,
    });
    return null;
  }

  const proposalId = randomUUID();
  // OBS-11: `tool.description` is the *planner*-facing blurb -- it names the
  // verification tool ("Verified by print_queue_status.") because the agent
  // loop needs to know how the action is checked. The reporter must never see
  // that. `entry.description` is the user-facing one the staff approval queue
  // and the outcome report already use (approval-service), so the consent path
  // uses it too and all three surfaces finally agree.
  const actionDescription = entry.description;
  const offerText =
    `I can run an approved action against ${endpoint.label}, a test system, not your own device. ` +
    // Descriptions are authored as whole sentences, so this stands as its own
    // sentence rather than being wedged into a noun slot ("I can run "Clears
    // the endpoint's print queue." against ...", which is what OBS-11 caught).
    `${actionDescription} Would you like me to?`;

  const message = await sendAgentReply(
    { sessionId: ctx.sessionId, conversationId: ctx.conversationId, reporterId: ctx.ticket.reporterId, text: "" },
    offerText,
  );

  ctx.ticket.pendingActionProposal = {
    proposalId,
    toolName: tool.name,
    policyEntryId: tool.policyEntryId,
    tier: entry.tier,
    // OBS-11 (T085): the *stored* description is the user-facing one too. Every
    // downstream reader of `pendingActionProposal.description` -- the consent
    // decision message, the sign-off notice, the outcome report, the audit
    // summary, and the frontend's `action_proposed` payload -- shows it to the
    // reporter, so storing `tool.description` leaked the planner blurb into all
    // of them. `remediation-state-changing.test.ts` already encoded the entry
    // description as the expected fixture value.
    description: actionDescription,
    arguments: result.arguments,
    endpointId: endpoint.id,
    endpointLabel: endpoint.label,
    raisedAt: new Date(),
    raisedInMessageId: message._id,
  };
  await ctx.ticket.save();

  publishEvent(ctx.sessionId, "action_proposed", {
    // The frontend never sees a raw Mongo id for a ticket — every other
    // ticket-carrying payload (toTicketSummary, toTicketDetail) uses the
    // human-readable reference, and that's what the consent POST route
    // itself is keyed by (contracts/api.md).
    ticketId: ctx.ticket.reference,
    proposalId,
    tier: entry.tier,
    description: actionDescription,
    endpointLabel: endpoint.label,
  });

  return { text: offerText, proposalId };
}

export interface ConsentDecisionInput {
  sessionId: string;
  reference: string;
  reporterId: Types.ObjectId;
  proposalId: string;
  granted: boolean;
}

export interface ConsentDecisionResult {
  outcome: "succeeded" | "failed" | "timed_out" | "attempted_unverified" | "refused" | "pending_approval";
  refusalReason?: RefusalReason;
  observedOutput: string | null;
  description: string;
  approvalId?: string;
}

/**
 * Records an explicit, per-proposal consent decision (FR-004): granting a
 * read-only proposal executes it immediately through the policy engine;
 * granting a state-changing one raises an approval request instead of
 * executing (FR-004a) — approval-service.decideApproval is the only path
 * that ever lets a state-changing action reach the executor from there.
 * Declining is refused with `missing_consent` — recorded, nothing raised.
 */
export async function recordConsent(input: ConsentDecisionInput): Promise<ConsentDecisionResult> {
  const ticket = await Ticket.findOne({ reference: input.reference });
  if (!ticket) {
    throw new NotFoundError("Unknown ticket reference", "TICKET_NOT_FOUND");
  }

  if (!ticket.reporterId.equals(input.reporterId)) {
    await recordAction({
      actor: "user",
      ticketId: ticket._id,
      classifiedIntent: ticket.category,
      requestedAction: input.proposalId,
      outcome: "refused",
      refusalReason: "not_ticket_owner",
    });
    throw new ForbiddenError("This ticket belongs to another reporter", "TICKET_FORBIDDEN");
  }

  const proposal = ticket.pendingActionProposal;
  if (!proposal || proposal.proposalId !== input.proposalId) {
    throw new ValidationError("Unknown, stale, or already-consumed proposal", "PROPOSAL_INVALID");
  }

  // Single-use: cleared before any further awaited work, so a duplicate or
  // racing request can never consume the same proposal twice (FR-004).
  ticket.pendingActionProposal = null;
  await ticket.save();

  const byAccountId = ticket.reporterAccountId;
  if (!byAccountId) {
    throw new ConflictError("This ticket has no linked account to attribute consent to", "ACCOUNT_REQUIRED");
  }

  const decisionMessage = await Message.create({
    conversationId: ticket.conversationId,
    author: "user",
    text: input.granted
      ? `Yes, go ahead: ${asClause(proposal.description)}`
      : `No, don't run that: ${asClause(proposal.description)}`,
    inputOrigin: "typed",
  });

  const replyCtx = {
    sessionId: input.sessionId,
    conversationId: ticket.conversationId,
    reporterId: ticket.reporterId,
    text: "",
  };

  if (!input.granted) {
    // FR-004/US3 AS4: declining records the decision (below) and raises
    // nothing else — no approval request, no execution, no escalation.
    await attemptAction({
      actor: "user",
      ticketId: ticket._id,
      conversationId: ticket.conversationId,
      classifiedIntent: ticket.category,
      policyEntryId: proposal.policyEntryId,
      arguments: proposal.arguments as Record<string, string>,
      endpointId: proposal.endpointId,
      consent: { given: false, byAccountId, at: new Date(), messageId: decisionMessage._id },
    });
    await sendAgentReply(replyCtx, "Okay, I won't run that.");
    return { outcome: "refused", refusalReason: "missing_consent", observedOutput: null, description: proposal.description };
  }

  const consentInput = { given: true as const, byAccountId, at: new Date(), messageId: decisionMessage._id };

  if (proposal.tier === "state_changing") {
    // FR-004a: a state-changing grant never reaches the executor from here —
    // it raises a pending approval request and waits on a named staff
    // decision (approval-service.decideApproval).
    const request = await raiseApprovalRequest({
      ticketId: ticket._id,
      ticketReference: ticket.reference,
      conversationId: ticket.conversationId,
      reporterAccountId: byAccountId,
      policyEntryId: proposal.policyEntryId,
      arguments: proposal.arguments as Record<string, string>,
      endpointId: proposal.endpointId,
      description: proposal.description,
      consent: consentInput,
    });

    await sendAgentReply(replyCtx, `That needs IT staff sign-off first: ${asClause(proposal.description)}. I'll let you know as soon as it's decided.`);

    return { outcome: "pending_approval", observedOutput: null, description: proposal.description, approvalId: request._id.toString() };
  }

  const result = await attemptAction({
    actor: "user",
    ticketId: ticket._id,
    conversationId: ticket.conversationId,
    classifiedIntent: ticket.category,
    policyEntryId: proposal.policyEntryId,
    arguments: proposal.arguments as Record<string, string>,
    endpointId: proposal.endpointId,
    consent: consentInput,
  });

  const record = await mostRecentActionRecord(ticket._id);
  // contracts/api.md "Server-sent events": action_recorded reaches both the
  // employee (their own chat session) and staff (live audit/dashboard).
  const actionRecordedPayload = {
    ticketId: ticket.reference,
    actionRecordId: record?._id.toString() ?? null,
    outcome: result.outcome,
    summary: describeOutcome(proposal.description, result.outcome, result.refusalReason),
  };
  publishEvent(input.sessionId, "action_recorded", actionRecordedPayload);
  publishStaffEvent("action_recorded", actionRecordedPayload);

  // US1 AS1/AS3: the diagnostic's result always reaches the transcript in
  // plain language (research.md R5 "Observe") — it informs the guided flow
  // without ever mutating step index or guide version pinning (FR-014).
  await sendAgentReply(replyCtx, chatReportFor(proposal.description, result.outcome, result.refusalReason));

  if (result.outcome === "failed" || result.outcome === "timed_out" || result.outcome === "attempted_unverified") {
    await escalateTicketForGuidance(replyCtx, ticket, "remediation_issue");
  }

  return {
    outcome: result.outcome,
    ...(result.refusalReason ? { refusalReason: result.refusalReason } : {}),
    observedOutput: result.observedOutput,
    description: proposal.description,
  };
}

function chatReportFor(description: string, outcome: string, refusalReason?: RefusalReason): string {
  // OBS-11 (T085): each of these wedges the description into a parenthetical or
  // ahead of a full stop, so the authored trailing period has to come off first
  // ("(Clears the endpoint's print queue.) and it completed successfully.").
  const clause = asClause(description);
  switch (outcome) {
    case "succeeded":
      return `I ran that check (${clause}) and it completed successfully.`;
    case "failed":
      return `I tried that (${clause}) but it didn't succeed. I'm bringing in a person to help from here.`;
    case "timed_out":
      return `I tried that (${clause}) but the test system didn't respond in time. I'm bringing in a person to help from here.`;
    case "attempted_unverified":
      return `I ran that (${clause}) but couldn't confirm the result. I'm bringing in a person to help from here.`;
    case "refused":
      return `I wasn't able to do that (${refusalReason ?? "refused"}): ${clause}.`;
    default:
      return `${clause}: ${outcome}`;
  }
}

async function mostRecentActionRecord(ticketId: Types.ObjectId): Promise<ActionRecordDoc | null> {
  return ActionRecord.findOne({ ticketId }).sort({ at: -1, _id: -1 });
}

function describeOutcome(description: string, outcome: string, refusalReason?: RefusalReason): string {
  if (outcome === "succeeded") {
    return `Ran successfully: ${description}`;
  }
  if (outcome === "refused") {
    return `Not run (${refusalReason ?? "refused"}): ${description}`;
  }
  return `${outcome}: ${description}`;
}
