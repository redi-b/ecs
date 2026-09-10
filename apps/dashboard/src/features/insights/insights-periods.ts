export function selectRecentSeries<T extends { date: string }>(series: T[], days: number) {
  if (!series.length) return [];
  const latest = new Date(`${series.at(-1)?.date}T00:00:00.000Z`).getTime();
  const from = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return series.filter((point) => new Date(`${point.date}T00:00:00.000Z`).getTime() >= from);
}

export function selectPreviousSeries<T extends { date: string }>(series: T[], days: number) {
  if (!series.length) return [];
  const current = selectRecentSeries(series, days);
  const firstCurrentDate = current[0]?.date;
  if (!firstCurrentDate) return [];
  const currentStart = new Date(`${firstCurrentDate}T00:00:00.000Z`).getTime();
  const previousStart = currentStart - days * 24 * 60 * 60 * 1000;
  return series.filter((point) => {
    const time = new Date(`${point.date}T00:00:00.000Z`).getTime();
    return time >= previousStart && time < currentStart;
  });
}

export function aggregateSalesSeries<T extends { date: string; orders: number; revenue: number }>(
  series: T[],
  interval: "day" | "month" | "week",
) {
  const buckets = new Map<string, { date: string; orders: number; revenue: number }>();
  for (const point of series) {
    const date = bucketDate(point.date, interval);
    const bucket = buckets.get(date) ?? { date, orders: 0, revenue: 0 };
    bucket.orders += point.orders;
    bucket.revenue += point.revenue;
    buckets.set(date, bucket);
  }
  return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function bucketDate(value: string, interval: "day" | "month" | "week") {
  if (interval === "day") return value;
  if (interval === "month") return `${value.slice(0, 7)}-01`;
  const date = new Date(`${value}T00:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}
