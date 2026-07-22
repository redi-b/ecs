"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  addDays,
  clamp,
  combineDateAndTime,
  format,
  fromDateTimeLocalValue,
  isToday,
  toDateTimeLocalValue,
} from "@/components/ui/date-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const HOURS_24 = Array.from({ length: 24 }, (_, index) => index);
const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1);

const TIME_LIST_HEIGHT_PX = 200;
const TIME_ITEM_HEIGHT_PX = 32;
const TIME_FORMAT_KEY = "ecs.datetime-picker.time-format";

type TimeFormat = "12h" | "24h";
type Period = "AM" | "PM";

type DateTimePickerProps = {
  className?: string;
  id?: string;
  onChange: (value: string) => void;
  value: string;
  placeholder?: string;
  disabled?: boolean;
};

export function DateTimePicker({
  className,
  id,
  onChange,
  value,
  placeholder = "Pick date and time",
  disabled = false,
}: DateTimePickerProps) {
  const selected = useMemo(() => fromDateTimeLocalValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const [draftDate, setDraftDate] = useState<Date | null>(selected);
  const [hour, setHour] = useState(selected?.getHours() ?? 9);
  const [minute, setMinute] = useState(selected?.getMinutes() ?? 0);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TIME_FORMAT_KEY);
      if (stored === "12h" || stored === "24h") setTimeFormat(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftDate(selected);
    setMonth(selected ?? new Date());
    setHour(selected?.getHours() ?? 9);
    setMinute(selected?.getMinutes() ?? 0);
  }, [open, selected]);

  function setFormat(next: TimeFormat) {
    setTimeFormat(next);
    try {
      window.localStorage.setItem(TIME_FORMAT_KEY, next);
    } catch {
      // ignore
    }
  }

  function commit(date: Date | null, nextHour = hour, nextMinute = minute) {
    if (!date) {
      onChange("");
      return;
    }
    onChange(
      toDateTimeLocalValue(
        combineDateAndTime(date, clamp(nextHour, 0, 23), clamp(nextMinute, 0, 59)),
      ),
    );
  }

  function pickDate(date: Date) {
    setDraftDate(date);
    setMonth(date);
    commit(date, hour, minute);
  }

  function pickTime(nextHour: number, nextMinute: number) {
    setHour(nextHour);
    setMinute(nextMinute);
    if (draftDate) commit(draftDate, nextHour, nextMinute);
  }

  const period: Period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const displayTime =
    timeFormat === "24h"
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      : `${hour12}:${String(minute).padStart(2, "0")} ${period}`;

  const triggerLabel = selected
    ? timeFormat === "24h"
      ? `${format(selected, "PP")} · ${format(selected, "HH:mm")}`
      : format(selected, "PP p")
    : placeholder;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "group h-9 w-full justify-between gap-2 rounded-xl border-input bg-background px-3 font-normal shadow-none",
            "hover:bg-background hover:border-foreground/20",
            open && "border-ring ring-3 ring-ring/30",
            !selected && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AppIcons.calendar className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          {selected ? (
            <span
              aria-label="Clear date and time"
              className="grid size-6 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange("");
                }
              }}
              role="button"
              tabIndex={0}
            >
              <AppIcons.close className="size-3.5" />
            </span>
          ) : (
            <AppIcons.arrowDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "w-[min(22.5rem,calc(100vw-1.25rem))] gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/10",
          "duration-200 ease-out",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
        collisionPadding={16}
        data-datetime-picker=""
        onOpenAutoFocus={(event) => event.preventDefault()}
        onTouchMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        side="bottom"
        sideOffset={8}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight">
            {draftDate ? `${format(draftDate, "PP")} · ${displayTime}` : "Select date & time"}
          </p>
          <SegmentedControl
            ariaLabel="Time format"
            className="w-[5.75rem] shrink-0"
            fullWidth
            onChange={setFormat}
            options={[
              { id: "12h", label: "12h" },
              { id: "24h", label: "24h" },
            ]}
            size="sm"
            value={timeFormat}
          />
        </div>

        <div className="p-3 pb-2">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            onSelect={pickDate}
            selected={draftDate}
          />
        </div>

        <div className="border-t px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Time</p>
            <p className="text-sm font-semibold tabular-nums">{displayTime}</p>
          </div>
          <div
            className={cn(
              "grid overflow-hidden rounded-xl border bg-muted/20",
              timeFormat === "12h" ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {timeFormat === "24h" ? (
              <TimeColumn
                label="Hour"
                onChange={(next) => pickTime(next, minute)}
                options={HOURS_24}
                value={hour}
              />
            ) : (
              <TimeColumn
                label="Hour"
                onChange={(next) => pickTime(to24Hour(next, period), minute)}
                options={HOURS_12}
                value={hour12}
              />
            )}
            <TimeColumn
              label="Min"
              onChange={(next) => pickTime(hour, next)}
              options={MINUTES}
              value={minute}
            />
            {timeFormat === "12h" ? (
              <PeriodColumn
                onChange={(nextPeriod) => pickTime(to24Hour(hour12, nextPeriod), minute)}
                value={period}
              />
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <div className="flex flex-wrap gap-1">
            <PresetChip
              active={Boolean(draftDate && isToday(draftDate))}
              label="Today"
              onClick={() => pickDate(new Date())}
            />
            <PresetChip label="Tomorrow" onClick={() => pickDate(addDays(new Date(), 1))} />
            <PresetChip
              label={timeFormat === "12h" ? "9 AM" : "09:00"}
              onClick={() => pickTime(9, 0)}
            />
          </div>
          <div className="flex shrink-0 gap-1">
            {value ? (
              <Button
                onClick={() => {
                  onChange("");
                  setDraftDate(null);
                  setOpen(false);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)} size="sm" type="button">
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastCentered = useRef<number | null>(null);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const index = options.indexOf(value);
    if (index < 0) return;
    if (lastCentered.current === value && Math.abs(root.scrollTop - expectedScrollTop(index)) < 4) {
      return;
    }
    lastCentered.current = value;
    const top = expectedScrollTop(index);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = top;
    });
  }, [value, options]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l first:border-l-0">
      <p className="shrink-0 border-b py-1.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
        onTouchMove={(event) => event.stopPropagation()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        ref={listRef}
        style={{ height: TIME_LIST_HEIGHT_PX, maxHeight: TIME_LIST_HEIGHT_PX }}
      >
        <div className="flex flex-col gap-0.5">
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                className={cn(
                  "h-8 shrink-0 rounded-lg text-sm tabular-nums transition-colors outline-none",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                  active &&
                    "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                )}
                key={option}
                onClick={() => onChange(option)}
                type="button"
              >
                {String(option).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function expectedScrollTop(index: number) {
  const itemStride = TIME_ITEM_HEIGHT_PX + 2;
  const top = index * itemStride + TIME_ITEM_HEIGHT_PX / 2 - TIME_LIST_HEIGHT_PX / 2;
  return Math.max(0, top);
}

function PeriodColumn({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l">
      <p className="shrink-0 border-b py-1.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        AM/PM
      </p>
      <div
        className="flex flex-col gap-1 p-1.5"
        style={{ height: TIME_LIST_HEIGHT_PX, maxHeight: TIME_LIST_HEIGHT_PX }}
      >
        {(["AM", "PM"] as const).map((period) => {
          const active = period === value;
          return (
            <button
              className={cn(
                "h-10 shrink-0 rounded-lg text-sm font-semibold transition-colors outline-none",
                "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                active &&
                  "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
              )}
              key={period}
              onClick={() => onChange(period)}
              type="button"
            >
              {period}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PresetChip({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "border-transparent bg-muted/60 text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function to24Hour(hour12: number, period: Period) {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}
