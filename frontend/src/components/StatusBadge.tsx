import type { HandlingMode, TicketStatus } from "../lib/types";

const STATUS_STYLES: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  in_progress: { label: "Being worked on", className: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800" },
  closed: { label: "Closed", className: "bg-gray-200 text-gray-600" },
};

const MODE_LABELS: Record<HandlingMode, string | null> = {
  automated: null,
  waiting_on_user: "Waiting on you",
  human_involved: "With IT staff",
};

interface StatusBadgeProps {
  status: TicketStatus;
  handlingMode: HandlingMode;
}

export function StatusBadge({ status, handlingMode }: StatusBadgeProps) {
  const statusStyle = STATUS_STYLES[status];
  const modeLabel = MODE_LABELS[handlingMode];
  return (
    <span className="flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.className}`}>
        {statusStyle.label}
      </span>
      {modeLabel && (
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          {modeLabel}
        </span>
      )}
    </span>
  );
}
