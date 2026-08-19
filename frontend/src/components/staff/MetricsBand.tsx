import { useCallback, useEffect, useState } from "react";
import { getMetrics } from "../../services/api";
import { MetricsSummary } from "./MetricsSummary";
import type { MetricsSummary as MetricsSummaryData } from "../../lib/types";

const PERIOD_OPTIONS: { value: MetricsSummaryData["period"]["preset"]; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

/** T106/T107: the metrics band, extracted from DashboardPage so the page
 * itself stays a thin composition of sections rather than growing past the
 * line ceiling. Switching the period updates the figures in place -- no
 * reload, no route change (US5 AS2). */
export function MetricsBand() {
  const [period, setPeriod] = useState<MetricsSummaryData["period"]["preset"]>("30d");
  const [summary, setSummary] = useState<MetricsSummaryData>();
  const [error, setError] = useState<string>();

  const load = useCallback((preset: MetricsSummaryData["period"]["preset"]) => {
    getMetrics(preset)
      .then((result) => {
        setSummary(result);
        setError(undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load metrics"));
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  return (
    <section className="rounded border border-gray-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Support operation</h2>
        <div className="flex gap-1" role="group" aria-label="Metrics period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors duration-150 ${
                period === option.value
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {summary ? (
        <MetricsSummary summary={summary} />
      ) : (
        <div className="h-24 animate-pulse rounded bg-gray-100" aria-hidden="true" />
      )}
    </section>
  );
}
