import { useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import type { RemediationAvailability } from "../../lib/types";

export type RemediationScope = { scope: "global" } | { scope: "endpoint"; endpointId: string };

interface RemediationControlsProps {
  availability: RemediationAvailability;
  onToggle: (scope: RemediationScope, enabled: boolean) => void;
  isToggling?: boolean;
}

/** T095/Design Direction: the asymmetric kill switch. Turning something off
 * is one click -- the safe direction should never be slowed down. Turning
 * it back on needs a second, explicit confirmation. A persistent,
 * non-dismissible banner stays up the entire time remediation is globally
 * off, so nobody has to remember it themselves. */
export function RemediationControls({ availability, onToggle, isToggling = false }: RemediationControlsProps) {
  const [confirmingOn, setConfirmingOn] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {!availability.globallyEnabled && (
        <div
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
        >
          Automated remediation is disabled. The agent cannot run any action right now.
        </div>
      )}

      <div className="flex items-center justify-between rounded border border-gray-200 p-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Automated remediation</p>
          <p className="text-xs text-gray-500">{availability.globallyEnabled ? "Currently on." : "Currently off."}</p>
        </div>
        {availability.globallyEnabled ? (
          <button
            type="button"
            disabled={isToggling}
            onClick={() => onToggle({ scope: "global" }, false)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Turn off
          </button>
        ) : confirmingOn ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-amber-700">
              <WarningIcon size={14} weight="regular" />
              This lets the agent act again.
            </span>
            <button
              type="button"
              disabled={isToggling}
              onClick={() => {
                onToggle({ scope: "global" }, true);
                setConfirmingOn(false);
              }}
              className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={isToggling}
              onClick={() => setConfirmingOn(false)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isToggling}
            onClick={() => setConfirmingOn(true)}
            className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Turn on
          </button>
        )}
      </div>

      <div className="rounded border border-gray-200 p-3">
        <p className="text-sm font-semibold text-gray-800">Test endpoints</p>
        <ul className="mt-2 divide-y divide-gray-100">
          {availability.endpoints.map((endpoint) => (
            <li key={endpoint.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm text-gray-800">{endpoint.label}</p>
                <p className="text-xs text-gray-500">{endpoint.enabled ? "Enabled" : "Disabled"}</p>
              </div>
              <button
                type="button"
                disabled={isToggling}
                onClick={() => onToggle({ scope: "endpoint", endpointId: endpoint.id }, !endpoint.enabled)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {endpoint.enabled ? `Turn off ${endpoint.label}` : `Turn on ${endpoint.label}`}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
