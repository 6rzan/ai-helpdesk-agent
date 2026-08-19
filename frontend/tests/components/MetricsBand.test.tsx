import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MetricsBand } from "../../src/components/staff/MetricsBand";
import type { MetricsSummary } from "../../src/lib/types";

// T106/US5 AS2: switching the period updates the figures in place, no reload.

const getMetrics = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return { ...actual, getMetrics: (...args: unknown[]) => getMetrics(...args) };
});

function buildSummary(overrides: Partial<MetricsSummary> = {}): MetricsSummary {
  return {
    period: { preset: "30d", from: null, to: null },
    hasData: true,
    ticketVolume: 5,
    categorySplit: [],
    statusSplit: [],
    resolvedWithoutHuman: { count: 0, proportion: 0 },
    escalationRate: 0,
    actionOutcomes: [],
    timeToResolution: { medianMinutes: null, buckets: [] },
    providerFallbacks: 0,
    ...overrides,
  };
}

describe("MetricsBand", () => {
  it("loads the default 30-day period on mount", async () => {
    getMetrics.mockResolvedValue(buildSummary({ ticketVolume: 5 }));
    render(<MetricsBand />);

    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(getMetrics).toHaveBeenCalledWith("30d");
  });

  it("updates the figures in place when a different period is selected, without a reload", async () => {
    getMetrics.mockResolvedValueOnce(buildSummary({ ticketVolume: 5 }));
    render(<MetricsBand />);
    await screen.findByText("5");

    getMetrics.mockResolvedValueOnce(buildSummary({ ticketVolume: 42 }));
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(getMetrics).toHaveBeenLastCalledWith("7d");
    expect(screen.queryByText("5")).toBeNull();
  });
});
