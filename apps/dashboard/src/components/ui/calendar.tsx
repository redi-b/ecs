"use client";

import {
  addCalendarMonths,
  type CalendarSystem,
  formatCalendarMonthYear,
  fromEthiopianDateParts,
  getCalendarDateParts,
  getCalendarMonthBounds,
  resolveUserCalendarPreference,
} from "@ecs/date-time";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "@/components/ui/date-utils";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function Calendar({
  className,
  month,
  onMonthChange,
  onSelect,
  selected,
  selectedRange,
  minDate,
  maxDate,
  calendarSystem,
}: {
  className?: string;
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date) => void;
  selected?: Date | null | undefined;
  selectedRange?: { start: Date; end?: Date | null | undefined } | null | undefined;
  minDate?: Date | null | undefined;
  maxDate?: Date | null | undefined;
  calendarSystem?: CalendarSystem | undefined;
}) {
  const { calendarPreference, locale, t } = useI18n();
  const activeCalendar =
    calendarSystem ?? resolveCalendarSystemForPicker(locale, calendarPreference);
  const [view, setView] = useState<"days" | "years">("days");
  const bounds = getCalendarMonthBounds(month, { calendar: activeCalendar, locale });
  const monthStart = bounds?.start ?? new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const monthEnd = bounds?.end ?? new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const atMinimumMonth = minDate ? monthStart <= minDate : false;
  const atMaximumMonth = maxDate ? monthEnd >= maxDate : false;
  const days = eachDayOfInterval({
    end: endOfWeek(monthEnd),
    start: startOfWeek(monthStart),
  });
  const activeParts = getCalendarDateParts(month, { calendar: activeCalendar, locale });
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 7, 2 + index)),
      ),
    [locale],
  );
  const yearWindow = useMemo(() => {
    const center = activeParts?.year ?? month.getFullYear();
    const start = center - 6;
    return Array.from({ length: 12 }, (_, index) => start + index);
  }, [activeParts?.year, month]);

  function chooseYear(year: number) {
    if (activeCalendar === "gregory") {
      onMonthChange(new Date(year, month.getMonth(), 1, 12));
    } else {
      onMonthChange(
        fromEthiopianDateParts({ day: 1, month: activeParts?.month ?? 1, year }) ?? month,
      );
    }
    setView("days");
  }

  return (
    <div className={cn("w-full select-none", className)} data-slot="calendar">
      <div className="mb-3 flex items-center justify-between gap-1">
        <Button
          aria-label={
            view === "days"
              ? t("common.datePicker.previousMonth")
              : t("common.datePicker.previousYears")
          }
          className="rounded-full"
          disabled={view === "days" && atMinimumMonth}
          onClick={() =>
            onMonthChange(
              view === "days"
                ? (addCalendarMonths(month, -1, { calendar: activeCalendar, locale }) ?? month)
                : (addCalendarMonths(month, activeCalendar === "ethiopic" ? -12 * 13 : -12, {
                    calendar: activeCalendar,
                    locale,
                  }) ?? month),
            )
          }
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.arrowLeft />
        </Button>

        <button
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-semibold tracking-tight transition-colors",
            "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
          onClick={() => setView((current) => (current === "days" ? "years" : "days"))}
          type="button"
        >
          {view === "days"
            ? (formatCalendarMonthYear(month, { calendar: activeCalendar, locale }) ??
              format(month, "MMMM yyyy"))
            : `${yearWindow[0]} – ${yearWindow[11]}`}
        </button>

        <Button
          aria-label={
            view === "days" ? t("common.datePicker.nextMonth") : t("common.datePicker.nextYears")
          }
          className="rounded-full"
          disabled={view === "days" && atMaximumMonth}
          onClick={() =>
            onMonthChange(
              view === "days"
                ? (addCalendarMonths(month, 1, { calendar: activeCalendar, locale }) ?? month)
                : (addCalendarMonths(month, activeCalendar === "ethiopic" ? 12 * 13 : 12, {
                    calendar: activeCalendar,
                    locale,
                  }) ?? month),
            )
          }
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.arrowRight />
        </Button>
      </div>

      {view === "years" ? (
        <div className="grid grid-cols-3 gap-2 animate-in fade-in-0 zoom-in-95 duration-150">
          {yearWindow.map((year) => {
            const active = year === (activeParts?.year ?? month.getFullYear());
            return (
              <button
                className={cn(
                  "h-10 rounded-xl text-sm font-medium transition-all outline-none",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                  active &&
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                )}
                key={year}
                onClick={() => {
                  chooseYear(year);
                }}
                type="button"
              >
                {year}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="animate-in fade-in-0 duration-150">
          <div className="mb-2 grid grid-cols-7">
            {weekdays.map((day, index) => (
              <div
                className="grid h-8 place-items-center text-[11px] font-medium text-muted-foreground"
                key={WEEKDAY_KEYS[index]}
              >
                {day}
              </div>
            ))}
          </div>
          {/*
            Day buttons fill their grid cell (not fixed size-9 that can overflow/overlap).
            gap keeps circles separated.
          */}
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const dayParts = getCalendarDateParts(day, { calendar: activeCalendar, locale });
              const inMonth =
                dayParts?.year === activeParts?.year && dayParts?.month === activeParts?.month;
              const selectedDay = selected ? isSameDay(day, selected) : false;
              const rangeStart = selectedRange ? isSameDay(day, selectedRange.start) : false;
              const rangeEnd = selectedRange?.end ? isSameDay(day, selectedRange.end) : false;
              const inRange = Boolean(
                selectedRange?.end &&
                  startOfDay(day) >= startOfDay(selectedRange.start) &&
                  startOfDay(day) <= startOfDay(selectedRange.end),
              );
              const disabled = Boolean(
                (minDate && startOfDay(day) < startOfDay(minDate)) ||
                  (maxDate && startOfDay(day) > startOfDay(maxDate)),
              );
              const today = isToday(day);
              return (
                <button
                  aria-current={today ? "date" : undefined}
                  className={cn(
                    "relative aspect-square w-full max-h-10 place-self-center rounded-full text-sm transition-all outline-none",
                    "grid place-items-center",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                    !inMonth && "text-muted-foreground/40",
                    inRange && "bg-primary/10 text-foreground hover:bg-primary/15",
                    today &&
                      !selectedDay &&
                      !rangeStart &&
                      !rangeEnd &&
                      "font-semibold text-primary ring-1 ring-primary/35 ring-inset",
                    (selectedDay || rangeStart || rangeEnd) &&
                      "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                    disabled && "pointer-events-none opacity-30",
                  )}
                  disabled={disabled}
                  key={day.toISOString()}
                  onClick={() => onSelect(day)}
                  type="button"
                >
                  {dayParts?.day ?? format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function resolveCalendarSystemForPicker(
  locale: string,
  preference: "follow-language" | "ethiopian" | "gregorian",
): CalendarSystem {
  return resolveUserCalendarPreference(preference) === "locale"
    ? locale.toLowerCase().startsWith("am")
      ? "ethiopic"
      : "gregory"
    : resolveUserCalendarPreference(preference) === "ethiopic"
      ? "ethiopic"
      : "gregory";
}
