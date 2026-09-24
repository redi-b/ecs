export type ListDateRange = { start: string; end: string };

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** URL dates are calendar dates, not instants in the browser's timezone. */
export function parseListDateRange(start?: string, end?: string): ListDateRange | null {
  if (!start || !end || !isCalendarDate(start) || !isCalendarDate(end) || start > end) return null;
  return { start, end };
}

/** Medusa's inclusive timestamp operators cover both selected Ethiopian days. */
export function listDateRangeToTimestamps(range: ListDateRange) {
  if (!parseListDateRange(range.start, range.end)) throw new RangeError("Invalid date range");
  return {
    createdFrom: new Date(`${range.start}T00:00:00.000+03:00`).toISOString(),
    createdTo: new Date(`${range.end}T23:59:59.999+03:00`).toISOString(),
  };
}
