import { MagnifyingGlassIcon, WrenchIcon } from "@phosphor-icons/react";
import type { ActionProposal } from "../lib/types";

interface ConsentBlockProps {
  proposal: ActionProposal;
  onDecide: (granted: boolean) => void;
  disabled?: boolean;
}

/** The agent's offer to run an approved action, awaiting the reporter's
 * explicit consent (US1, FR-004). Deliberately not a QuickReplies pill —
 * granting this authorises a real action against a real (test) endpoint,
 * so it gets its own bounded, labelled affordance stating plainly what will
 * run, against what, and that it is a test system, not the reporter's own
 * device (Design Direction). No optimistic state: the buttons only disable
 * while a decision is in flight — the outcome itself always arrives as the
 * server's own chat reply, never rendered here. */
export function ConsentBlock({ proposal, onDecide, disabled = false }: ConsentBlockProps) {
  const isStateChanging = proposal.tier === "state_changing";

  return (
    <div
      role="region"
      aria-label="Action requires your consent"
      className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
    >
      <div className="flex items-center gap-1 text-xs font-medium text-blue-800">
        {isStateChanging ? <WrenchIcon size={14} weight="regular" /> : <MagnifyingGlassIcon size={14} weight="regular" />}
        <span>{isStateChanging ? "State-changing action" : "Read-only diagnostic"}</span>
      </div>
      <p className="mt-1 text-gray-800">
        I can run <strong>{proposal.description}</strong> against <strong>{proposal.endpointLabel}</strong> — a
        test system, not your own device. Would you like me to?
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide(true)}
          className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Yes, go ahead
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide(false)}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          No, don&apos;t
        </button>
      </div>
    </div>
  );
}
