import type { IssueCategory, TicketSummary } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  password_login: "Password & Login",
  network: "Network",
  printer: "Printer",
  peripherals: "Peripherals",
  performance: "Performance",
  service_status: "Service Status",
  unclassified: "Unclassified",
};

interface TicketCardProps {
  ticket: TicketSummary;
}

export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-blue-700">{ticket.reference}</span>
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {CATEGORY_LABELS[ticket.category]}
          </span>
          <StatusBadge status={ticket.status} handlingMode={ticket.handlingMode} />
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{ticket.description}</p>
      <p className="mt-2 text-xs text-gray-500">
        Your report has been saved as ticket {ticket.reference}. Quote this reference any time.
      </p>
    </div>
  );
}
