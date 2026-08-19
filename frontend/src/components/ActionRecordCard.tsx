import { useState } from "react";
import { MagnifyingGlassIcon, WrenchIcon } from "@phosphor-icons/react";
import type { ActionRecord } from "../lib/types";
import { ActionOutcomeBadge } from "./ActionOutcomeBadge";

interface ActionRecordCardProps {
  record: ActionRecord;
}

const REFUSAL_TEXT: Record<NonNullable<ActionRecord["refusalReason"]>, string> = {
  no_matching_entry: "No approved action matches this request.",
  argument_mismatch: "The requested arguments do not match the approved form.",
  unregistered_target: "The target is not a registered test endpoint.",
  endpoint_not_permitted: "This action is not permitted against that endpoint.",
  missing_consent: "The reporter had not given consent.",
  missing_approval: "Staff had not yet approved this action.",
  remediation_disabled: "Automated remediation was turned off.",
  low_confidence: "The classification confidence was too low.",
  degraded_model: "The model was degraded and declined this class of action.",
  not_ticket_owner: "The requester is not the ticket's reporter.",
  already_attempted: "This action was already attempted for this ticket.",
  step_cap_reached: "The agent reached its step limit.",
};

/** The one component that renders an executed-or-refused action everywhere it
 * appears (chat, ticket history, approval queue, audit view). Field order is
 * fixed across every surface: timestamp, actor, classified intent, tier,
 * exact command, target endpoint, authorisation, outcome, observed output.
 * See DESIGN-DIRECTION.md "Action record (the reusable atom)". */
export function ActionRecordCard({ record }: ActionRecordCardProps) {
  const [outputExpanded, setOutputExpanded] = useState(false);
  const isStateChanging = record.tier === "state_changing";

  return (
    <div className="rounded border border-gray-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-gray-400">
          {new Date(record.at).toLocaleString()} · by {record.actor}
        </span>
        <ActionOutcomeBadge outcome={record.outcome} />
      </div>

      <p className="mt-1 text-gray-700">{record.classifiedIntent}</p>

      {record.tier && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          {isStateChanging ? (
            <WrenchIcon size={14} weight="regular" />
          ) : (
            <MagnifyingGlassIcon size={14} weight="regular" />
          )}
          <span>{isStateChanging ? "State-changing" : "Read-only diagnostic"}</span>
        </div>
      )}

      {record.requestedAction && (
        <p className="mt-2 rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600">{record.requestedAction}</p>
      )}

      {record.endpointLabel && <p className="mt-1 text-xs text-gray-500">Target: {record.endpointLabel}</p>}

      {(record.authorisation.consent || record.authorisation.approval) && (
        <p className="mt-1 text-xs text-gray-500">
          {record.authorisation.consent && `Consent given ${new Date(record.authorisation.consent.at).toLocaleString()}`}
          {record.authorisation.consent && record.authorisation.approval && " · "}
          {record.authorisation.approval && `Approved by ${record.authorisation.approval.displayName}`}
        </p>
      )}

      {record.outcome === "refused" && record.refusalReason && (
        <p className="mt-1 text-xs text-gray-500">{REFUSAL_TEXT[record.refusalReason]}</p>
      )}

      {record.observedOutput && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOutputExpanded((v) => !v)}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {outputExpanded ? "Hide output" : "Show output"}
          </button>
          {outputExpanded && (
            <pre className="mt-1 max-h-64 overflow-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-600">
              {record.observedOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
