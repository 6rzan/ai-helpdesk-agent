import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRemediationAvailability, toggleRemediation, type RemediationToggleScope } from "../../services/api";
import { useStaffEvents } from "../../services/useEvents";
import { RemediationControls } from "../../components/staff/RemediationControls";
import type { RemediationAvailability } from "../../lib/types";

/** T085/T095/T096: the automation kill switch, global and per-endpoint
 * (FR-008, FR-022). Live-refreshed on `remediation_availability_changed` so
 * every open staff tab reflects a toggle the instant anyone makes it. */
export function RemediationPage() {
  const [availability, setAvailability] = useState<RemediationAvailability>();
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    getRemediationAvailability()
      .then((result) => {
        setAvailability(result);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load remediation status"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useStaffEvents(true, { onRemediationAvailabilityChanged: load });

  const handleToggle = useCallback((scope: RemediationToggleScope, enabled: boolean) => {
    setIsToggling(true);
    toggleRemediation(scope, enabled)
      .then((result) => {
        setAvailability(result);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to update remediation"))
      .finally(() => setIsToggling(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/staff" className="text-sm text-blue-600 hover:underline">
        Back to dashboard
      </Link>
      <header className="mt-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Automation</h1>
        <p className="text-sm text-gray-500">Turn automated remediation off, globally or for one endpoint.</p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {availability ? (
        <RemediationControls availability={availability} onToggle={handleToggle} isToggling={isToggling} />
      ) : (
        <div className="h-32 animate-pulse rounded bg-gray-100" aria-hidden="true" />
      )}
    </div>
  );
}
