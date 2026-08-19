import { Types } from "mongoose";
import { ActionRecord, type ActionRecordDoc } from "../../models/action-record.js";
import { Ticket } from "../../models/ticket.js";
import type { Actor, ActionOutcome, ActionTier, RefusalReason } from "../../models/enums.js";
import { getPolicy } from "../../policy/policy-loader.js";

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

/** Chronological (oldest first) read view for a ticket's own action history —
 * both executed and refused, exactly as recorded (US1 AS1, US3 AS6). */
export async function getActionsForTicket(ticketId: Types.ObjectId): Promise<ActionRecordDoc[]> {
  return ActionRecord.find({ ticketId }).sort({ at: 1 });
}

// frontend/src/lib/types.ts `ActionRecord` — the one shape shown identically
// to the reporter (plain-language) and to staff (full detail) from the same
// record (data-model.md §5). `endpointLabel` is resolved here rather than
// stored, since the registry is the single source of truth for it.
// `ticketReference` is passed in by the caller (already known from the route
// or a batch lookup) rather than re-derived here — the frontend never sees a
// raw Mongo id for a ticket anywhere else in the system (contracts/api.md).
export function toActionRecordJson(record: ActionRecordDoc, ticketReference: string | null = null) {
  const policy = getPolicy();
  const endpointLabel = record.endpointId ? (policy.endpoints.get(record.endpointId)?.label ?? null) : null;
  return {
    id: record._id.toString(),
    at: record.at,
    actor: record.actor,
    ticketId: ticketReference,
    classifiedIntent: record.classifiedIntent,
    policyEntryId: record.policyEntryId ?? null,
    tier: record.tier ?? null,
    requestedAction: record.requestedAction,
    arguments: record.arguments ?? {},
    endpointId: record.endpointId ?? null,
    endpointLabel,
    authorisation: {
      consent: record.authorisation.consent
        ? {
            given: record.authorisation.consent.given,
            byAccountId: record.authorisation.consent.byAccountId.toString(),
            at: record.authorisation.consent.at,
            messageId: record.authorisation.consent.messageId.toString(),
          }
        : null,
      approval: record.authorisation.approval
        ? {
            requestId: record.authorisation.approval.requestId.toString(),
            byAccountId: record.authorisation.approval.byAccountId.toString(),
            displayName: record.authorisation.approval.displayName,
            at: record.authorisation.approval.at,
          }
        : null,
    },
    outcome: record.outcome,
    refusalReason: record.refusalReason ?? null,
    observedOutput: record.observedOutput ?? null,
    verification: record.verification ?? null,
    durationMs: record.durationMs ?? null,
  };
}

export interface StaffActionFilters {
  /** Ticket reference (e.g. "TICK-0001"), never a raw Mongo id (contracts/api.md rule 1). */
  ticketId?: string | undefined;
  endpointId?: string | undefined;
  outcome?: ActionOutcome | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** T089/contracts/api.md "Action trail": the complete trail across all
 * tickets, executed and refused together by default (FR-021), paginated and
 * filterable by ticket, endpoint, outcome, and date. */
export async function listActionsForStaff(filters: StaffActionFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const query: Record<string, unknown> = {};
  if (filters.ticketId) {
    const ticket = await Ticket.findOne({ reference: filters.ticketId });
    // No matching ticket: an id that can never match a real ActionRecord,
    // so the filter still behaves as "no results" rather than "no filter".
    query.ticketId = ticket ? ticket._id : new Types.ObjectId();
  }
  if (filters.endpointId) {
    query.endpointId = filters.endpointId;
  }
  if (filters.outcome) {
    query.outcome = filters.outcome;
  }
  if (filters.from || filters.to) {
    const at: Record<string, Date> = {};
    if (filters.from) at.$gte = new Date(filters.from);
    if (filters.to) at.$lte = new Date(filters.to);
    query.at = at;
  }

  const [total, records] = await Promise.all([
    ActionRecord.countDocuments(query),
    ActionRecord.find(query)
      .sort({ at: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  const ticketIds = [...new Set(records.map((r) => r.ticketId).filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  const tickets = ticketIds.length > 0 ? await Ticket.find({ _id: { $in: ticketIds } }).select("reference") : [];
  const referenceById = new Map(tickets.map((t) => [String(t._id), t.reference]));

  return {
    actions: records.map((record) =>
      toActionRecordJson(record, record.ticketId ? (referenceById.get(String(record.ticketId)) ?? null) : null),
    ),
    total,
    page,
    pageSize,
  };
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
