const DAY_MS = 86_400_000;
export const REPORTING_TIMEZONE = "Africa/Addis_Ababa";
// Ethiopia uses UTC+03 throughout the year; keep conversion explicit, not server-local.
const OFFSET_MS = 3 * 60 * 60 * 1000;

export function reportingDay(now: Date) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftReportingDay(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function reportingDayStart(day: string) {
  return new Date(`${day}T00:00:00+03:00`);
}

export function reportingDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

export function completeReportingCoverage(from: Date, to: Date) {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return null;
  const firstDay = reportingDay(from);
  const first =
    from.getTime() === reportingDayStart(firstDay).getTime()
      ? firstDay
      : shiftReportingDay(firstDay, 1);
  const last = shiftReportingDay(reportingDay(to), -1);
  return first <= last ? { from: first, to: last } : null;
}
