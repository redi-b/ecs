/** Lightweight date helpers used by Calendar / DatePicker / DateTimePicker. */

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function subMonths(date: Date, amount: number) {
  return addMonths(date, -amount);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function eachDayOfInterval({ start, end }: { start: Date; end: Date }) {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function format(
  date: Date,
  pattern: "MMMM yyyy" | "MMM" | "d" | "yyyy" | "PPP" | "PP" | "PP p" | "HH:mm",
) {
  if (pattern === "d") return String(date.getDate());
  if (pattern === "yyyy") return String(date.getFullYear());
  if (pattern === "HH:mm") {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (pattern === "MMM") {
    return new Intl.DateTimeFormat("en", { month: "short" }).format(date);
  }
  if (pattern === "MMMM yyyy") {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
  }
  if (pattern === "PP") {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  if (pattern === "PPP") {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function combineDateAndTime(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/** Value for date-only storage: `YYYY-MM-DD` */
export function toDateValue(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateValue(value: string) {
  if (!value.trim()) return null;
  // Parse as local date to avoid UTC off-by-one.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Value for datetime-local-compatible storage: `YYYY-MM-DDTHH:mm` */
export function toDateTimeLocalValue(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${toDateValue(date)}T${format(date, "HH:mm")}`;
}

export function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (match) {
    const parsed = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      0,
      0,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
