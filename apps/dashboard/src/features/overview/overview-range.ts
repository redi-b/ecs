export type OverviewRangePreset = "7d" | "30d" | "90d" | "custom";

type DatedRow = { date: string };

export function getSeriesBounds(rows: readonly DatedRow[]) {
  if (rows.length === 0) return null;
  return { start: rows[0]!.date, end: rows[rows.length - 1]!.date };
}

export function getPresetRange(
  rows: readonly DatedRow[],
  preset: Exclude<OverviewRangePreset, "custom">,
) {
  const bounds = getSeriesBounds(rows);
  if (!bounds) return null;
  const days = Number.parseInt(preset, 10);
  const end = parseDay(bounds.end);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: bounds.end,
  };
}

export function filterSeriesByRange<T extends DatedRow>(
  rows: readonly T[],
  range: { start: string; end: string },
) {
  const [start, end] = range.start <= range.end
    ? [range.start, range.end]
    : [range.end, range.start];
  return rows.filter((row) => row.date >= start && row.date <= end);
}

function parseDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
