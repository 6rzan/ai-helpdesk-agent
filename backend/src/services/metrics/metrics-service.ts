import { Ticket, type TicketDoc } from "../../models/ticket.js";
import { ActionRecord } from "../../models/action-record.js";
import { ProviderFallbackEvent } from "../../models/provider-fallback-event.js";
import { ValidationError } from "../../lib/errors.js";
import type { ActionOutcome } from "../../models/enums.js";

// research.md R8: the metric definitions are fixed here so the tests and the
// surface cannot drift apart. Computed on demand over the tickets and action
// records collections for a selected period -- no precomputed collection, no
// cache (SC-009 demands the figures match an independently counted set of
// records exactly).

export const METRICS_PERIOD_PRESETS = ["7d", "30d", "90d", "all"] as const;
export type MetricsPeriodPreset = (typeof METRICS_PERIOD_PRESETS)[number];

export interface MetricsPeriod {
  preset: MetricsPeriodPreset;
  from: string | null;
  to: string | null;
}

export interface MetricsSplit {
  key: string;
  count: number;
}

export interface MetricsSummary {
  period: MetricsPeriod;
  hasData: boolean;
  ticketVolume: number;
  categorySplit: MetricsSplit[];
  statusSplit: MetricsSplit[];
  resolvedWithoutHuman: { count: number; proportion: number };
  escalationRate: number;
  actionOutcomes: MetricsSplit[];
  timeToResolution: { medianMinutes: number | null; buckets: MetricsSplit[] };
  providerFallbacks: number;
}

const DAYS_BY_PRESET: Record<Exclude<MetricsPeriodPreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function isMetricsPeriodPreset(value: string): value is MetricsPeriodPreset {
  return (METRICS_PERIOD_PRESETS as readonly string[]).includes(value);
}

function resolveBounds(preset: MetricsPeriodPreset, now: Date): { from: Date | null; to: Date | null } {
  if (preset === "all") {
    return { from: null, to: null };
  }
  const days = DAYS_BY_PRESET[preset];
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

function toSplit(counts: Map<string, number>): MetricsSplit[] {
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

// Distribution buckets for time-to-resolution (R8: "reported as median and as
// a distribution, never as a mean alone"). Boundaries are a presentation
// choice, not a spec value -- fixed here so tests and the surface agree.
const RESOLUTION_BUCKETS: { key: string; maxMinutes: number | null }[] = [
  { key: "< 15 min", maxMinutes: 15 },
  { key: "15-60 min", maxMinutes: 60 },
  { key: "1-4 hr", maxMinutes: 4 * 60 },
  { key: "4-24 hr", maxMinutes: 24 * 60 },
  { key: "> 24 hr", maxMinutes: null },
];

function bucketResolutionTimes(minutesList: number[]): MetricsSplit[] {
  const counts = new Map(RESOLUTION_BUCKETS.map((b) => [b.key, 0]));
  for (const minutes of minutesList) {
    const bucket = RESOLUTION_BUCKETS.find((b) => b.maxMinutes === null || minutes < b.maxMinutes);
    const key = bucket ? bucket.key : RESOLUTION_BUCKETS[RESOLUTION_BUCKETS.length - 1]!.key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return RESOLUTION_BUCKETS.map((b) => ({ key: b.key, count: counts.get(b.key) ?? 0 })).filter((s) => s.count > 0);
}

/** T102/research.md R8: the metrics summary for one period preset. Ticket-level
 * figures (volume, splits, resolution) are scoped by ticket `createdAt`; action
 * records and provider fallbacks are scoped by their own `at` -- an action taken
 * this week on a ticket opened last month still belongs in this week's figures. */
export async function getMetricsSummary(presetInput: string): Promise<MetricsSummary> {
  if (!isMetricsPeriodPreset(presetInput)) {
    throw new ValidationError(`Unknown period preset "${presetInput}"`, "METRICS_PERIOD_INVALID");
  }
  const preset = presetInput;
  const now = new Date();
  const { from, to } = resolveBounds(preset, now);
  const period: MetricsPeriod = { preset, from: from ? from.toISOString() : null, to: to ? to.toISOString() : null };

  const ticketQuery: Record<string, unknown> = {};
  if (from) ticketQuery.createdAt = { $gte: from };

  const eventQuery: Record<string, unknown> = {};
  if (from) eventQuery.at = { $gte: from };

  const [tickets, actionRecords, fallbackEvents] = await Promise.all([
    Ticket.find(ticketQuery),
    ActionRecord.find(eventQuery),
    ProviderFallbackEvent.find(eventQuery),
  ]);

  const ticketVolume = tickets.length;
  const hasData = ticketVolume > 0 || actionRecords.length > 0 || fallbackEvents.length > 0;

  if (!hasData) {
    return {
      period,
      hasData: false,
      ticketVolume: 0,
      categorySplit: [],
      statusSplit: [],
      resolvedWithoutHuman: { count: 0, proportion: 0 },
      escalationRate: 0,
      actionOutcomes: [],
      timeToResolution: { medianMinutes: null, buckets: [] },
      providerFallbacks: 0,
    };
  }

  const categoryCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let resolvedWithoutHumanCount = 0;
  let escalatedCount = 0;
  const resolutionMinutes: number[] = [];

  for (const ticket of tickets as unknown as TicketDoc[]) {
    categoryCounts.set(ticket.category, (categoryCounts.get(ticket.category) ?? 0) + 1);
    statusCounts.set(ticket.status ?? "open", (statusCounts.get(ticket.status ?? "open") ?? 0) + 1);
    if (ticket.escalated) escalatedCount += 1;

    if (ticket.status === "resolved") {
      const wentHumanInvolved = ticket.history.some((h) => h.field === "handlingMode" && h.to === "human_involved");
      if (!ticket.escalated && !wentHumanInvolved) {
        resolvedWithoutHumanCount += 1;
      }

      const resolvedEntry = [...ticket.history].reverse().find((h) => h.field === "status" && h.to === "resolved");
      if (resolvedEntry) {
        const minutes = (resolvedEntry.at.getTime() - (ticket as unknown as { createdAt: Date }).createdAt.getTime()) / 60_000;
        resolutionMinutes.push(minutes);
      }
    }
  }

  const actionOutcomeCounts = new Map<string, number>();
  for (const record of actionRecords) {
    const outcome = record.outcome as ActionOutcome;
    actionOutcomeCounts.set(outcome, (actionOutcomeCounts.get(outcome) ?? 0) + 1);
  }

  return {
    period,
    hasData: true,
    ticketVolume,
    categorySplit: toSplit(categoryCounts),
    statusSplit: toSplit(statusCounts),
    resolvedWithoutHuman: {
      count: resolvedWithoutHumanCount,
      proportion: ticketVolume > 0 ? resolvedWithoutHumanCount / ticketVolume : 0,
    },
    escalationRate: ticketVolume > 0 ? escalatedCount / ticketVolume : 0,
    actionOutcomes: toSplit(actionOutcomeCounts),
    timeToResolution: {
      medianMinutes: median(resolutionMinutes),
      buckets: bucketResolutionTimes(resolutionMinutes),
    },
    providerFallbacks: fallbackEvents.length,
  };
}
