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

/** Visible rows in each time wheel (odd so selection can sit centered). */
const TIME_VISIBLE_ROWS = 7;
const TIME_ITEM_HEIGHT_PX = 36;
const TIME_LIST_HEIGHT_PX = TIME_ITEM_HEIGHT_PX * TIME_VISIBLE_ROWS;
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

/**
 * Reusable date + time picker (forms, sheets, pages).
 * Horizontal: calendar left, compact time wheels + AM/PM toggle right.
 */
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
        avoidCollisions
        className={cn(
          "w-auto max-w-[min(36rem,calc(100vw-1.25rem))] gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/10",
          "duration-200 ease-out",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
        collisionPadding={12}
        data-datetime-picker=""
        onOpenAutoFocus={(event) => event.preventDefault()}
        onTouchMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        side="bottom"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {draftDate ? format(draftDate, "PPP") : "Select date & time"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{displayTime}</p>
          </div>
          <SegmentedControl
            ariaLabel="Time format"
            className="w-[5.5rem] shrink-0"
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

        {/* Body: calendar | time */}
        <div className="flex">
          <div className="w-[17.5rem] shrink-0 p-3">
            <Calendar
              month={month}
              onMonthChange={setMonth}
              onSelect={pickDate}
              selected={draftDate}
            />
          </div>

          <div className="flex w-[10.5rem] shrink-0 flex-col border-l bg-muted/15">
            <div className="grid flex-1 grid-cols-2 gap-0 px-2 pt-2">
              {timeFormat === "24h" ? (
                <TimeWheel
                  label="Hour"
                  onChange={(next) => pickTime(next, minute)}
                  options={HOURS_24}
                  value={hour}
                />
              ) : (
                <TimeWheel
                  label="Hour"
                  onChange={(next) => pickTime(to24Hour(next, period), minute)}
                  options={HOURS_12}
                  value={hour12}
                />
              )}
              <TimeWheel
                label="Min"
                onChange={(next) => pickTime(hour, next)}
                options={MINUTES}
                value={minute}
              />
            </div>

            {timeFormat === "12h" ? (
              <div className="px-2.5 pt-2 pb-2.5">
                <SegmentedControl
                  ariaLabel="AM or PM"
                  fullWidth
                  onChange={(next) => pickTime(to24Hour(hour12, next), minute)}
                  options={[
                    { id: "AM", label: "AM" },
                    { id: "PM", label: "PM" },
                  ]}
                  size="sm"
                  value={period}
                />
              </div>
            ) : (
              <div className="h-2" />
            )}
          </div>
        </div>

        {/* Footer */}
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

function TimeWheel({
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
    <div className="flex min-w-0 flex-col">
      <p className="pb-1.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="relative">
        {/* Selection rail — sits behind items, doesn't stretch buttons. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-9 -translate-y-1/2 rounded-lg bg-primary/10 ring-1 ring-primary/15"
        />
        <div
          className={cn(
            "relative z-10 overflow-y-auto overscroll-contain px-1",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "mask-[linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]",
          )}
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          ref={listRef}
          style={{ height: TIME_LIST_HEIGHT_PX }}
        >
          {/* Spacers so first/last values can center on the rail */}
          <div style={{ height: TIME_ITEM_HEIGHT_PX * Math.floor(TIME_VISIBLE_ROWS / 2) }} />
          <div className="flex flex-col">
            {options.map((option) => {
              const active = option === value;
              return (
                <button
                  className={cn(
                    "flex h-9 shrink-0 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none",
                    "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "font-semibold text-foreground"
                      : "font-normal text-muted-foreground/80",
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
          <div style={{ height: TIME_ITEM_HEIGHT_PX * Math.floor(TIME_VISIBLE_ROWS / 2) }} />
        </div>
      </div>
    </div>
  );
}

function expectedScrollTop(index: number) {
  // With equal padding spacers, selected row centers at index * itemHeight.
  return Math.max(0, index * TIME_ITEM_HEIGHT_PX);
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
