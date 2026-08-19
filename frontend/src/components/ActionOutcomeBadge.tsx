import type { ActionOutcome, ApprovalStatus } from "../lib/types";

// A separate vocabulary from StatusBadge.tsx (ticket status) by design — see
// DESIGN-DIRECTION.md "Palette commitment". A refusal is the policy working
// correctly, not an error, so it is never red; red is reserved for an
// approved action that ran and failed.
const OUTCOME_STYLES: Record<ActionOutcome, { label: string; className: string }> = {
  succeeded: { label: "Succeeded", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  timed_out: { label: "Timed out", className: "bg-red-100 text-red-800" },
  attempted_unverified: { label: "Attempted, unverified", className: "bg-amber-100 text-amber-800" },
  refused: { label: "Refused", className: "bg-gray-200 text-gray-600" },
};

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending approval", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  declined: { label: "Declined", className: "bg-gray-200 text-gray-600" },
  expired: { label: "Expired", className: "bg-gray-200 text-gray-600" },
  no_longer_applicable: { label: "No longer applicable", className: "bg-gray-200 text-gray-600" },
};

interface ActionOutcomeBadgeProps {
  outcome: ActionOutcome;
}

/** Renders an executed-or-refused action's outcome. See ActionRecordCard for the
 * full atom this badge is one field of. */
export function ActionOutcomeBadge({ outcome }: ActionOutcomeBadgeProps) {
  const style = OUTCOME_STYLES[outcome];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
  );
}

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
}

/** Renders a state-changing action's approval-queue status. Declining is a
 * routine outcome, not a destructive one, so it is never red. */
export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const style = APPROVAL_STYLES[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
  );
}
