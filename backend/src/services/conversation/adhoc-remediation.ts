import type { ConversationDoc } from "../../models/conversation.js";
import type { RefusalReason } from "../../models/enums.js";
import { Conversation } from "../../models/conversation.js";
import { interpretAdHocRequest, resolveAmbiguousReply } from "../remediation/adhoc-request.js";
import { attemptAction } from "../remediation/policy-engine.js";
import { recordAction } from "../remediation/audit-service.js";
import { sendAgentReply } from "./conversation-guidance.js";
import type { ReplyContext } from "./conversation-engine.js";
import { escalateForUserRequest } from "./conversation-engine.js";

// FR-016/FR-006: an ad-hoc "can you reset my password" style request in chat
// is a real policy decision — matched against the same exact, no-fuzzy-
// matching engine every proposed action goes through (matchAction,
// policy-engine.ts), audited with its specific reason either way. Nothing
// this resolves to ever executes from here: no consent was ever actually
// given by the utterance itself (FR-004), so even a fully well-formed match
// is refused — the real path to execution stays the consent block reachable
// through guided troubleshooting (US1) or, once approved, staff approval
// (US3). Extracted from conversation-engine.ts to keep that file under the
// project's 500-line ceiling; it depends only on that module's exported
// `ReplyContext` type and `escalateForUserRequest`.

function adHocRefusalReply(reason: RefusalReason): string {
  switch (reason) {
    case "no_matching_entry":
      return "I don't have an approved way to do that myself, but I can report it and bring in IT staff who can — just ask me to escalate it and I will.";
    case "argument_mismatch":
      return "That's close to something I'm approved to run, but not quite in the form I can act on. I can report this and bring in IT staff who can — just ask me to escalate it and I will.";
    case "unregistered_target":
      return "I can only run approved actions against our own registered test systems, never your own device. I can report this and bring in IT staff who can — just ask me to escalate it and I will.";
    case "endpoint_not_permitted":
      return "That's not something I'm approved to run against that particular system. I can report this and bring in IT staff who can — just ask me to escalate it and I will.";
    default:
      return "I can't do that myself right now, but I can report this and bring in IT staff who can — just ask me to escalate it and I will.";
  }
}

export async function handleAdHocRemediationRequest(ctx: ReplyContext, conversation: ConversationDoc): Promise<void> {
  const interpretation = interpretAdHocRequest(ctx.text);

  if (interpretation.kind === "vague") {
    await recordAction({
      actor: "user",
      ticketId: null,
      conversationId: ctx.conversationId,
      classifiedIntent: "unclear remediation request",
      requestedAction: ctx.text,
      outcome: "refused",
      refusalReason: "low_confidence",
    });
    await sendAgentReply(
      ctx,
      "I'm not sure exactly what you'd like me to do, so I'm bringing in a person to help from here.",
    );
    await escalateForUserRequest(ctx, "low_confidence");
    return;
  }

  if (interpretation.kind === "ambiguous") {
    await Conversation.findByIdAndUpdate(conversation._id, {
      pendingAmbiguousRemediation: { candidates: interpretation.candidates },
    });
    const options = interpretation.candidates.map((candidate) => candidate.description).join(", or ");
    await sendAgentReply(ctx, `Just to be sure — did you mean I should ${options}?`);
    return;
  }

  const { attempt, description } = interpretation;
  const result = await attemptAction({
    actor: "user",
    ticketId: null,
    conversationId: ctx.conversationId,
    classifiedIntent: description,
    policyEntryId: attempt.policyEntryId,
    arguments: attempt.arguments,
    endpointId: attempt.endpointId,
    consent: null,
  });
  await sendAgentReply(ctx, adHocRefusalReply(result.refusalReason ?? "no_matching_entry"));
}

export async function handleAmbiguousRemediationReply(ctx: ReplyContext, conversation: ConversationDoc): Promise<void> {
  const pending = conversation.pendingAmbiguousRemediation;
  await Conversation.findByIdAndUpdate(conversation._id, { pendingAmbiguousRemediation: null });
  if (!pending) {
    return;
  }

  const resolved = resolveAmbiguousReply(
    ctx.text,
    pending.candidates as { description: string; attempt: { policyEntryId: string; arguments: Record<string, string>; endpointId: string } }[],
  );

  if (!resolved) {
    await recordAction({
      actor: "user",
      ticketId: null,
      conversationId: ctx.conversationId,
      classifiedIntent: "ambiguous remediation request",
      requestedAction: ctx.text,
      outcome: "refused",
      refusalReason: "low_confidence",
    });
    await sendAgentReply(ctx, "I still can't tell which one you mean, so I'm bringing in a person to help from here.");
    await escalateForUserRequest(ctx, "low_confidence");
    return;
  }

  const result = await attemptAction({
    actor: "user",
    ticketId: null,
    conversationId: ctx.conversationId,
    classifiedIntent: resolved.description,
    policyEntryId: resolved.attempt.policyEntryId,
    arguments: resolved.attempt.arguments,
    endpointId: resolved.attempt.endpointId,
    consent: null,
  });
  await sendAgentReply(ctx, adHocRefusalReply(result.refusalReason ?? "no_matching_entry"));
}
