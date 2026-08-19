import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricsSummary } from "../../src/components/staff/MetricsSummary";
import type { MetricsSummary as MetricsSummaryData } from "../../src/lib/types";

// T101/Design Direction (US5 AS3): the no-data state states plainly there is
// nothing to report, figures use tabular numerals, and no numeral is animated.

function buildSummary(overrides: Partial<MetricsSummaryData> = {}): MetricsSummaryData {
  return {
    period: { preset: "30d", from: "2026-07-20T00:00:00.000Z", to: "2026-08-19T00:00:00.000Z" },
    hasData: true,
    ticketVolume: 10,
    categorySplit: [{ key: "network", count: 6 }, { key: "printer", count: 4 }],
    statusSplit: [{ key: "resolved", count: 7 }, { key: "open", count: 3 }],
    resolvedWithoutHuman: { count: 5, proportion: 0.5 },
    escalationRate: 0.2,
    actionOutcomes: [{ key: "succeeded", count: 8 }, { key: "refused", count: 2 }],
    timeToResolution: { medianMinutes: 90, buckets: [{ key: "1-4 hr", count: 5 }] },
    providerFallbacks: 1,
    ...overrides,
  };
}

describe("MetricsSummary", () => {
  it("states plainly there is nothing to report when the period has no data", () => {
    render(<MetricsSummary summary={buildSummary({ hasData: false })} />);
    expect(screen.getByText(/nothing to report/i)).toBeInTheDocument();
    expect(screen.queryByText("10")).toBeNull();
  });

  it("renders the headline stat tiles with tabular numerals", () => {
    render(<MetricsSummary summary={buildSummary()} />);

    const ticketVolume = screen.getByText("10");
    expect(ticketVolume.className).toMatch(/tabular-nums/);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("renders no animation classes or transitions on any numeral or bar", () => {
    const { container } = render(<MetricsSummary summary={buildSummary()} />);
    const animated = container.querySelectorAll(
      '[class*="animate-"], [class*="transition"], [style*="animation"]',
    );
    expect(animated.length).toBe(0);
  });

  it("renders labelled horizontal bar rows backed by real text values", () => {
    render(<MetricsSummary summary={buildSummary()} />);
    expect(screen.getByText("By category")).toBeInTheDocument();
    expect(screen.getByText("network")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});
