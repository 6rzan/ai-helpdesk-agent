import type { StaffTicketDetail, TransitionRecord } from "../lib/types";

// Extracted from TicketDetailPage (T008): the ticket's history, staff activity,
// assignment history, and guided-troubleshooting timeline sections, kept
// together because 005 interleaves action records into this same view
// rather than building a second timeline (T097, Design Direction).
interface TicketTimelineProps {
  ticket: StaffTicketDetail;
}

function HistoryRow({ record }: { record: TransitionRecord }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <span className="text-sm text-gray-700">
        {record.field === "status" ? "Status" : "Handling"} changed from{" "}
        <span className="font-medium">{record.from}</span> to <span className="font-medium">{record.to}</span>
      </span>
      <span className="text-xs tabular-nums text-gray-400">
        {new Date(record.at).toLocaleString()} · by {record.actor}
      </span>
    </li>
  );
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  return (
    <>
      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">History</h2>
        {ticket.history.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No changes recorded yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100">
            {ticket.history.map((record, i) => (
              <HistoryRow key={`${record.at}-${i}`} record={record} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Staff activity</h2>
        {!ticket.staffActions || ticket.staffActions.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No staff actions recorded yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100">
            {ticket.staffActions.map((record, i) => (
              <li key={`${record.at}-${i}`} className="py-2 text-sm text-gray-700">
                <span className="font-medium">{record.staffName}</span> {record.action.replace("_", " ")}
                {Object.keys(record.details).length > 0 && (
                  <span className="block text-xs text-gray-500">
                    {Object.entries(record.details)
                      .map(([key, value]) => `${key}: ${String(value)}`)
                      .join(", ")}
                  </span>
                )}
                <span className="mt-0.5 block text-xs tabular-nums text-gray-400">
                  {new Date(record.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Assignment history</h2>
        {ticket.assignmentHistory.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No assignments recorded yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100">
            {ticket.assignmentHistory.map((record, i) => (
              <li key={`${record.at}-${i}`} className="py-2 text-sm text-gray-700">
                <span className="font-medium">{record.assigneeName}</span> was{" "}
                {record.kind === "takeover" ? "assigned by" : "reassigned by"} {record.byName}
                <span className="block text-xs tabular-nums text-gray-400">
                  {new Date(record.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Troubleshooting attempts</h2>
        {!ticket.guidance || ticket.guidance.stepAttempts.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No guided troubleshooting attempts were recorded.</p>
        ) : (
          <ol className="mt-1 divide-y divide-gray-100">
            {ticket.guidance.stepAttempts.map((attempt, i) => (
              <li key={`${attempt.at}-${i}`} className="py-2 text-sm text-gray-700">
                <p>{attempt.instruction ?? `Step ${attempt.stepIndex + 1}`}</p>
                <span className="mt-0.5 block text-xs tabular-nums text-gray-400">
                  {attempt.outcome.replaceAll("_", " ")} · {new Date(attempt.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
