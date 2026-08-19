import type { Types } from "mongoose";
import { ActionRecord, type ActionRecordDoc } from "../../models/action-record.js";
import type { Actor, ActionOutcome, ActionTier, RefusalReason } from "../../models/enums.js";

// data-model.md §5. The append-only write API for the audit trail: exactly
// one exported function, and it only ever creates. No update or delete
// function exists here or anywhere else (R7, FR-010) — see action-record.ts
// for the schema-level enforcement of the same rule.

export interface ConsentRecordInput {
  given: boolean;
  byAccountId: Types.ObjectId;
  at: Date;
  messageId: Types.ObjectId;
}

export interface ApprovalReferenceInput {
  requestId: Types.ObjectId;
  byAccountId: Types.ObjectId;
  displayName: string;
  at: Date;
}

export interface RecordActionInput {
  actor: Actor;
  ticketId?: Types.ObjectId | null;
  conversationId?: Types.ObjectId | null;
  classifiedIntent: string;
  policyEntryId?: string | null;
  tier?: ActionTier | null;
  requestedAction: string;
  arguments?: Record<string, string>;
  endpointId?: string | null;
  consent?: ConsentRecordInput | null;
  approval?: ApprovalReferenceInput | null;
  outcome: ActionOutcome;
  refusalReason?: RefusalReason | null;
  observedOutput?: string | null;
  verification?: { entryId: string; outcome: ActionOutcome; observedOutput?: string | null } | null;
  durationMs?: number | null;
}

export async function recordAction(input: RecordActionInput): Promise<ActionRecordDoc> {
  return ActionRecord.create({
    at: new Date(),
    actor: input.actor,
    ticketId: input.ticketId ?? null,
    conversationId: input.conversationId ?? null,
    classifiedIntent: input.classifiedIntent,
    policyEntryId: input.policyEntryId ?? null,
    tier: input.tier ?? null,
    requestedAction: input.requestedAction,
    arguments: input.arguments ?? {},
    endpointId: input.endpointId ?? null,
    authorisation: {
      consent: input.consent ?? null,
      approval: input.approval ?? null,
    },
    outcome: input.outcome,
    refusalReason: input.refusalReason ?? null,
    observedOutput: input.observedOutput ?? null,
    verification: input.verification ?? null,
    durationMs: input.durationMs ?? null,
  });
}
