import type { MetricsSplit, MetricsSummary as MetricsSummaryData } from "../../lib/types";

interface MetricsSummaryProps {
  summary: MetricsSummaryData;
}

function formatPercent(proportion: number): string {
  return `${Math.round(proportion * 100)}%`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "No resolved tickets";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

interface BarRowsProps {
  title: string;
  rows: MetricsSplit[];
}

/** research R12/Design Direction: labelled horizontal bar rows backed by real
 * text values -- no charting dependency, no filled-track progress bars. The
 * bar is a magnitude cue beside the number, never the only carrier of it. */
function BarRows({ title, rows }: BarRowsProps) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded border border-gray-200 p-3">
      <h3 className="text-xs font-semibold text-gray-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No data for this period.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs text-gray-600">{row.key.replaceAll("_", " ")}</span>
              <span className="h-2 flex-1 rounded-full bg-gray-100">
                <span
                  className="block h-2 rounded-full bg-blue-500"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-gray-700">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** T105/Design Direction: stat tiles for the headline figures plus labelled
 * horizontal bar rows for the splits and distributions -- real text values
 * throughout, tabular numerals, nothing animated (US5 AS3). The no-data state
 * says plainly there is nothing to report rather than showing a zero-filled
 * frame (FR-023). */
export function MetricsSummary({ summary }: MetricsSummaryProps) {
  if (!summary.hasData) {
    return (
      <div className="rounded border border-gray-200 py-8 text-center">
        <p className="text-sm text-gray-400">Nothing to report for this period.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Tickets" value={String(summary.ticketVolume)} />
        <StatTile label="Resolved without human" value={formatPercent(summary.resolvedWithoutHuman.proportion)} />
        <StatTile label="Escalation rate" value={formatPercent(summary.escalationRate)} />
        <StatTile label="Median time to resolution" value={formatMinutes(summary.timeToResolution.medianMinutes)} />
        <StatTile label="Provider fallbacks" value={String(summary.providerFallbacks)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BarRows title="By category" rows={summary.categorySplit} />
        <BarRows title="By status" rows={summary.statusSplit} />
        <BarRows title="Automated-action outcomes" rows={summary.actionOutcomes} />
        <BarRows title="Time to resolution" rows={summary.timeToResolution.buckets} />
      </div>
    </div>
  );
}
