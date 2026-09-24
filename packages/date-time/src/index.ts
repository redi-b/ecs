export const supportedCalendarSystems = ["gregory", "ethiopic"] as const;

export type CalendarSystem = (typeof supportedCalendarSystems)[number];
export type CalendarPreference = "locale" | CalendarSystem;
export const userCalendarPreferences = ["follow-language", "ethiopian", "gregorian"] as const;
export type UserCalendarPreference = (typeof userCalendarPreferences)[number];
export type EcsDateLocale = "am" | "en";
export type DateInput = Date | number | string;

export const ETHIOPIA_TIME_ZONE = "Africa/Addis_Ababa";

export function resolveUserCalendarPreference(
  preference: UserCalendarPreference,
): CalendarPreference {
  if (preference === "ethiopian") return "ethiopic";
  if (preference === "gregorian") return "gregory";
  return "locale";
}

export function resolveCalendarSystem(
  locale: string,
  preference: CalendarPreference = "locale",
): CalendarSystem {
  if (preference !== "locale") return preference;
  return locale.toLowerCase().startsWith("am") ? "ethiopic" : "gregory";
}

export function getCalendarLocale(locale: string, preference: CalendarPreference = "locale") {
  const language: EcsDateLocale = locale.toLowerCase().startsWith("am") ? "am" : "en";
  return `${language}-ET-u-ca-${resolveCalendarSystem(locale, preference)}`;
}

export function toValidDate(value: DateInput): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toCanonicalIsoInstant(value: DateInput): string | null {
  return toValidDate(value)?.toISOString() ?? null;
}

export function formatCalendarDate(
  value: DateInput,
  options: {
    calendar?: CalendarPreference;
    dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
    locale: string;
    timeZone?: string;
  },
) {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(getCalendarLocale(options.locale, options.calendar), {
    dateStyle: options.dateStyle ?? "medium",
    timeZone: options.timeZone ?? ETHIOPIA_TIME_ZONE,
  }).format(date);
}

export function formatCalendarDateTime(
  value: DateInput,
  options: {
    calendar?: CalendarPreference;
    dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
    locale: string;
    timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
    timeZone?: string;
  },
) {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(getCalendarLocale(options.locale, options.calendar), {
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.timeStyle ?? "short",
    timeZone: options.timeZone ?? ETHIOPIA_TIME_ZONE,
  }).format(date);
}

export function formatDualCalendarDate(
  value: DateInput,
  options: {
    dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
    locale: string;
    primary?: CalendarSystem;
    timeZone?: string;
  },
) {
  const primary = options.primary ?? resolveCalendarSystem(options.locale);
  const secondary: CalendarSystem = primary === "ethiopic" ? "gregory" : "ethiopic";
  const common = {
    locale: options.locale,
    ...(options.dateStyle ? { dateStyle: options.dateStyle } : {}),
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  };
  const primaryLabel = formatCalendarDate(value, { ...common, calendar: primary });
  const secondaryLabel = formatCalendarDate(value, { ...common, calendar: secondary });
  if (!primaryLabel || !secondaryLabel) return null;
  return { primary, primaryLabel, secondary, secondaryLabel };
}

export function getCalendarDateParts(
  value: DateInput,
  options: {
    calendar?: CalendarPreference;
    locale: string;
    timeZone?: string;
  },
) {
  const date = toValidDate(value);
  if (!date) return null;
  const timeZone = options.timeZone ?? ETHIOPIA_TIME_ZONE;
  const formatterKey = `${getCalendarLocale(options.locale, options.calendar)}|${timeZone}`;
  let formatter = calendarPartsFormatterCache.get(formatterKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(getCalendarLocale(options.locale, options.calendar), {
      day: "numeric",
      era: "short",
      month: "numeric",
      timeZone,
      year: "numeric",
    });
    calendarPartsFormatterCache.set(formatterKey, formatter);
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    calendar: resolveCalendarSystem(options.locale, options.calendar),
    day: Number(values.day),
    era: values.era ?? null,
    month: Number(values.month),
    year: Number(values.year),
  };
}

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const ethiopianDateCache = new Map<string, Date>();
const calendarPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function fromEthiopianDateParts(parts: CalendarDateParts): Date | null {
  if (
    !Number.isInteger(parts.year) ||
    !Number.isInteger(parts.month) ||
    !Number.isInteger(parts.day)
  )
    return null;
  if (parts.year < 1 || parts.month < 1 || parts.month > 13 || parts.day < 1 || parts.day > 30)
    return null;
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const cached = ethiopianDateCache.get(key);
  if (cached) return new Date(cached.getTime());

  const cursor = new Date(Date.UTC(parts.year + 7, 7, 1, 9, 0, 0, 0));
  const limit = new Date(Date.UTC(parts.year + 8, 9, 20, 9, 0, 0, 0));
  while (cursor <= limit) {
    const candidate = getCalendarDateParts(cursor, { calendar: "ethiopic", locale: "en" });
    if (
      candidate?.year === parts.year &&
      candidate.month === parts.month &&
      candidate.day === parts.day
    ) {
      const result = new Date(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        12,
      );
      ethiopianDateCache.set(key, result);
      return new Date(result.getTime());
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export function getCalendarMonthBounds(
  value: DateInput,
  options: { calendar: CalendarSystem; locale?: string },
) {
  const date = toValidDate(value);
  if (!date) return null;
  if (options.calendar === "gregory") {
    return {
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 12),
      start: new Date(date.getFullYear(), date.getMonth(), 1, 12),
    };
  }
  const parts = getCalendarDateParts(date, {
    calendar: "ethiopic",
    locale: options.locale ?? "en",
  });
  if (!parts) return null;
  const start = fromEthiopianDateParts({ day: 1, month: parts.month, year: parts.year });
  const nextMonth =
    parts.month === 13
      ? { day: 1, month: 1, year: parts.year + 1 }
      : { day: 1, month: parts.month + 1, year: parts.year };
  const next = fromEthiopianDateParts(nextMonth);
  if (!start || !next) return null;
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  return { end, start };
}

export function addCalendarMonths(
  value: DateInput,
  amount: number,
  options: { calendar: CalendarSystem; locale?: string },
) {
  const date = toValidDate(value);
  if (!date || !Number.isInteger(amount)) return null;
  if (options.calendar === "gregory") {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  }
  const parts = getCalendarDateParts(date, {
    calendar: "ethiopic",
    locale: options.locale ?? "en",
  });
  if (!parts) return null;
  const absoluteMonth = parts.year * 13 + (parts.month - 1) + amount;
  const year = Math.floor(absoluteMonth / 13);
  const month = (((absoluteMonth % 13) + 13) % 13) + 1;
  return fromEthiopianDateParts({ day: 1, month, year });
}

export function formatCalendarMonthYear(
  value: DateInput,
  options: { calendar?: CalendarPreference; locale: string; timeZone?: string },
) {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(getCalendarLocale(options.locale, options.calendar), {
    month: "long",
    timeZone: options.timeZone ?? ETHIOPIA_TIME_ZONE,
    year: "numeric",
  }).format(date);
}
