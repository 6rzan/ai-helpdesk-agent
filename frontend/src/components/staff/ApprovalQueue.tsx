import { useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react";
import type { ApprovalRequest } from "../../lib/types";

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  onApprove: (approvalId: string) => void;
  onDecline: (approvalId: string, reason?: string) => void;
  decidingId?: string | null;
}

function ageLabel(raisedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(raisedAt).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

interface RowProps {
  approval: ApprovalRequest;
  onApprove: (approvalId: string) => void;
  onDecline: (approvalId: string, reason?: string) => void;
  isDeciding: boolean;
}

function ApprovalRow({ approval, onApprove, onDecline, isDeciding }: RowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium tabular-nums text-gray-900">{approval.ticketReference}</span>
        <span className="text-xs tabular-nums text-gray-400">{ageLabel(approval.raisedAt)}</span>
      </div>

      <p className="text-sm text-gray-800">{approval.description}</p>
      <p className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600">{approval.command}</p>
      <p className="text-xs text-gray-500">
        Target: {approval.endpointLabel} · Reporter consented {new Date(approval.consent.at).toLocaleString()}
      </p>

      {confirming ? (
        <div
          role="region"
          aria-label="Confirm approval"
          className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
        >
          <p className="text-gray-800">This will run:</p>
          <p className="mt-1 rounded bg-white px-2 py-1 font-mono text-xs text-gray-700">{approval.command}</p>
          <p className="mt-1 text-xs text-gray-600">against {approval.endpointLabel}.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={isDeciding}
              onClick={() => onApprove(approval.id)}
              className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={isDeciding}
              onClick={() => setConfirming(false)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => setConfirming(true)}
            className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecline(approval.id, undefined)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </li>
  );
}

/** T093/Design Direction: the decision queue for state-changing actions
 * awaiting staff sign-off. Approve is deliberately two steps — the second
 * restates the exact command and target so nobody approves on trust alone.
 * Decline is a routine, expected outcome (the policy asking for a human
 * check), never styled as destructive. The empty state reads as a good
 * outcome: nothing is waiting on a person right now. */
export function ApprovalQueue({ approvals, onApprove, onDecline, decidingId = null }: ApprovalQueueProps) {
  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-gray-200 py-8 text-center">
        <CheckCircleIcon size={24} weight="regular" className="text-green-600" />
        <p className="text-sm text-gray-600">Nothing is waiting on you right now.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded border border-gray-200 px-3">
      {approvals.map((approval) => (
        <ApprovalRow
          key={approval.id}
          approval={approval}
          onApprove={onApprove}
          onDecline={onDecline}
          isDeciding={decidingId === approval.id}
        />
      ))}
    </ul>
  );
}
