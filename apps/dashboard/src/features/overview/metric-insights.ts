export type MetricDay = { date: string; revenue: number; orders: number };
export type MetricInterval = { start: string; end: string; value: number | null };

const DAY = 86_400_000;

/** Missing days remain unknown; grouping never turns absent reporting into zero. */
export function metricIntervals(
  rows: readonly MetricDay[],
  range: { start: string; end: string } | null,
  metric: "revenue" | "orders",
  maxIntervals = 24,
  verifiedCoverage?: { start: string; end: string },
): MetricInterval[] {
  if (!range || !Number.isInteger(maxIntervals) || maxIntervals < 1) return [];
  const dates = [range.start, range.end].sort();
  const start = Date.parse(`${dates[0]}T00:00:00Z`);
  const end = Date.parse(`${dates[1]}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const days = Math.round((end - start) / DAY) + 1;
  const width = Math.max(1, Math.ceil(days / maxIntervals));
  const values = new Map(rows.map((row) => [row.date, row[metric]]));
  return Array.from({ length: Math.ceil(days / width) }, (_, index) => {
    const first = start + index * width * DAY;
    const last = Math.min(end, first + (width - 1) * DAY);
    let value: number | null = 0;
    for (let date = first; date <= last; date += DAY) {
      const day = new Date(date).toISOString().slice(0, 10);
      const amount =
        values.get(day) ??
        (verifiedCoverage && day >= verifiedCoverage.start && day <= verifiedCoverage.end
          ? 0
          : undefined);
      if (amount == null || !Number.isFinite(amount) || amount < 0) {
        value = null;
        break;
      }
      value += amount;
    }
    return {
      start: new Date(first).toISOString().slice(0, 10),
      end: new Date(last).toISOString().slice(0, 10),
      value,
    };
  });
}

/** Reject inconsistent or unavailable snapshots instead of drawing a false ratio. */
export function metricSplit(total: number | null | undefined, subset: number | null | undefined) {
  if (
    total == null ||
    subset == null ||
    !Number.isInteger(total) ||
    !Number.isInteger(subset) ||
    total <= 0 ||
    subset < 0 ||
    subset > total
  )
    return null;
  return { subset, rest: total - subset, share: subset / total };
}
