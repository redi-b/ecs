"use client";

import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "@/components/ui/date-utils";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Calendar({
  className,
  month,
  onMonthChange,
  onSelect,
  selected,
}: {
  className?: string;
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date) => void;
  selected?: Date | null | undefined;
}) {
  const [view, setView] = useState<"days" | "years">("days");
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    end: endOfWeek(endOfMonth(monthStart)),
    start: startOfWeek(monthStart),
  });

  const yearWindow = useMemo(() => {
    const center = month.getFullYear();
    const start = center - 6;
    return Array.from({ length: 12 }, (_, index) => start + index);
  }, [month]);

  return (
    <div className={cn("w-full select-none", className)} data-slot="calendar">
      <div className="mb-3 flex items-center justify-between gap-1">
        <Button
          aria-label={view === "days" ? "Previous month" : "Previous years"}
          className="rounded-full"
          onClick={() =>
            onMonthChange(
              view === "days"
                ? subMonths(month, 1)
                : new Date(month.getFullYear() - 12, month.getMonth(), 1),
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
          {view === "days" ? format(month, "MMMM yyyy") : `${yearWindow[0]} – ${yearWindow[11]}`}
        </button>

        <Button
          aria-label={view === "days" ? "Next month" : "Next years"}
          className="rounded-full"
          onClick={() =>
            onMonthChange(
              view === "days"
                ? addMonths(month, 1)
                : new Date(month.getFullYear() + 12, month.getMonth(), 1),
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
            const active = year === month.getFullYear();
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
                  onMonthChange(new Date(year, month.getMonth(), 1));
                  setView("days");
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
            {WEEKDAYS.map((day) => (
              <div
                className="grid h-8 place-items-center text-[11px] font-medium text-muted-foreground"
                key={day}
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
              const inMonth = isSameMonth(day, month);
              const selectedDay = selected ? isSameDay(day, selected) : false;
              const today = isToday(day);
              return (
                <button
                  aria-current={today ? "date" : undefined}
                  aria-selected={selectedDay}
                  className={cn(
                    "relative aspect-square w-full max-h-10 place-self-center rounded-full text-sm transition-all outline-none",
                    "grid place-items-center",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                    !inMonth && "text-muted-foreground/40",
                    today &&
                      !selectedDay &&
                      "font-semibold text-primary ring-1 ring-primary/35 ring-inset",
                    selectedDay &&
                      "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                  )}
                  key={day.toISOString()}
                  onClick={() => onSelect(day)}
                  type="button"
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
