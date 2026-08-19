import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { approveApproval, declineApproval, listApprovals } from "../../services/api";
import { useStaffEvents } from "../../services/useEvents";
import { ApprovalQueue } from "../../components/staff/ApprovalQueue";
import type { ApprovalRequest } from "../../lib/types";

/** T093/T096: the staff decision queue for state-changing actions awaiting
 * sign-off, live-refreshed whenever an approval is raised or decided
 * anywhere (including from another staff member's tab). */
export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(() => {
    listApprovals("pending")
      .then((result) => {
        setApprovals(result.approvals);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load approvals"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  useStaffEvents(true, {
    onApprovalPending: load,
    onApprovalDecided: load,
  });

  const handleApprove = useCallback(
    (approvalId: string) => {
      setDecidingId(approvalId);
      approveApproval(approvalId)
        .then(load)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to approve"))
        .finally(() => setDecidingId(null));
    },
    [load],
  );

  const handleDecline = useCallback(
    (approvalId: string, reason?: string) => {
      setDecidingId(approvalId);
      declineApproval(approvalId, reason)
        .then(load)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to decline"))
        .finally(() => setDecidingId(null));
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/staff" className="text-sm text-blue-600 hover:underline">
        Back to dashboard
      </Link>
      <header className="mt-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Approval queue</h1>
        <p className="text-sm text-gray-500">State-changing actions waiting on a staff decision.</p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded bg-gray-100" aria-hidden="true" />
      ) : (
        <ApprovalQueue approvals={approvals} onApprove={handleApprove} onDecline={handleDecline} decidingId={decidingId} />
      )}
    </div>
  );
}
