"use client";

import { useEffect, useMemo, useState } from "react";

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

const TIME_FORMAT_KEY = "ecs.datetime-picker.time-format";

const QUICK_TIMES = [
  { h: 9, m: 0 },
  { h: 12, m: 0 },
  { h: 17, m: 0 },
  { h: 21, m: 0 },
] as const;

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
 * Date + time picker — single stacked column (sheet / mobile / desktop safe).
 * Time: editable steppers + optional AM/PM segmented control.
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

  const hourDisplay = timeFormat === "24h" ? hour : hour12;
  const hourMax = timeFormat === "24h" ? 23 : 12;
  const hourMin = timeFormat === "24h" ? 0 : 1;

  function stepHour(delta: number) {
    if (timeFormat === "24h") {
      pickTime((hour + delta + 24) % 24, minute);
      return;
    }
    const nextFace = ((((hour12 - 1 + delta) % 12) + 12) % 12) + 1;
    pickTime(to24Hour(nextFace, period), minute);
  }

  function stepMinute(delta: number) {
    pickTime(hour, (minute + delta + 60) % 60);
  }

  function setHourFace(next: number) {
    if (timeFormat === "24h") {
      pickTime(clamp(next, 0, 23), minute);
      return;
    }
    pickTime(to24Hour(clamp(next, 1, 12), period), minute);
  }

  function setMinuteFace(next: number) {
    pickTime(hour, clamp(next, 0, 59));
  }

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
        align="center"
        avoidCollisions
        className={cn(
          "flex w-[min(19.5rem,var(--radix-popover-content-available-width,calc(100vw-1.5rem)))] max-h-[min(85dvh,36rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/10",
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
        sticky="partial"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight">
              {draftDate ? format(draftDate, "PPP") : "Select date & time"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{displayTime}</p>
          </div>
          <SegmentedControl
            ariaLabel="Time format"
            className="w-[5.25rem] shrink-0"
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

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="px-2.5 pt-2.5 pb-1">
            <Calendar
              month={month}
              onMonthChange={setMonth}
              onSelect={pickDate}
              selected={draftDate}
            />
          </div>

          {/* Time */}
          <div className="border-t bg-muted/15 px-3.5 py-3">
            <p className="mb-2.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Time
            </p>

            {/* Labels share the same column widths as steppers so “:” can sit true-center */}
            <div className="mx-auto flex w-fit flex-col gap-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="w-12 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Hour
                </span>
                <span className="w-3" aria-hidden />
                <span className="w-12 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Min
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <TimeStep
                  ariaLabel="Hour"
                  max={hourMax}
                  min={hourMin}
                  onChange={setHourFace}
                  onDecrement={() => stepHour(-1)}
                  onIncrement={() => stepHour(1)}
                  value={hourDisplay}
                />
                <span
                  aria-hidden
                  className="w-3 text-center text-base font-semibold leading-none text-muted-foreground/80"
                >
                  :
                </span>
                <TimeStep
                  ariaLabel="Minute"
                  max={59}
                  min={0}
                  onChange={setMinuteFace}
                  onDecrement={() => stepMinute(-1)}
                  onIncrement={() => stepMinute(1)}
                  value={minute}
                />
              </div>

              {timeFormat === "12h" ? (
                <div className="mx-auto w-[7.5rem] pt-1">
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
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {QUICK_TIMES.map((slot) => {
                const active = hour === slot.h && minute === slot.m;
                return (
                  <PresetChip
                    active={active}
                    key={`${slot.h}-${slot.m}`}
                    label={
                      timeFormat === "12h"
                        ? formatQuick12(slot.h, slot.m)
                        : `${String(slot.h).padStart(2, "0")}:${String(slot.m).padStart(2, "0")}`
                    }
                    onClick={() => pickTime(slot.h, slot.m)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
          <div className="flex flex-wrap gap-1">
            <PresetChip
              active={Boolean(draftDate && isToday(draftDate))}
              label="Today"
              onClick={() => pickDate(new Date())}
            />
            <PresetChip label="Tomorrow" onClick={() => pickDate(addDays(new Date(), 1))} />
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

/**
 * Vertical stepper with a directly editable center value.
 * Type digits, ↑/↓ keys, blur/Enter commit + clamp, focus selects all.
 */
function TimeStep({
  value,
  min,
  max,
  onChange,
  onIncrement,
  onDecrement,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  ariaLabel: string;
}) {
  const padded = String(value).padStart(2, "0");
  const [draft, setDraft] = useState(padded);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(padded);
  }, [padded, focused]);

  function commitDraft() {
    const parsed = Number.parseInt(draft.replace(/\D/g, ""), 10);
    if (Number.isNaN(parsed)) {
      setDraft(padded);
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(String(next).padStart(2, "0"));
  }

  return (
    <div className="flex w-12 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
      <button
        aria-label={`Increase ${ariaLabel}`}
        className="grid h-7 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none"
        onClick={onIncrement}
        tabIndex={-1}
        type="button"
      >
        <AppIcons.arrowUp className="size-3.5" />
      </button>
      <input
        aria-label={ariaLabel}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={cn(
          "h-9 w-full border-y border-border/60 bg-transparent text-center text-sm font-semibold tabular-nums outline-none",
          "selection:bg-primary/20",
          "focus-visible:bg-primary/5 focus-visible:ring-0",
        )}
        inputMode="numeric"
        onBlur={() => {
          commitDraft();
          setFocused(false);
        }}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
          setDraft(digits);
        }}
        onFocus={(event) => {
          setFocused(true);
          event.target.select();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onIncrement();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onDecrement();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(padded);
            event.currentTarget.blur();
          }
        }}
        // Keep type=text so leading zeros and partial drafts work on mobile.
        pattern="[0-9]*"
        role="spinbutton"
        type="text"
        value={focused ? draft : padded}
      />
      <button
        aria-label={`Decrease ${ariaLabel}`}
        className="grid h-7 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none"
        onClick={onDecrement}
        tabIndex={-1}
        type="button"
      >
        <AppIcons.arrowDown className="size-3.5" />
      </button>
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
        "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors outline-none",
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

function formatQuick12(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const face = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${face} ${period}` : `${face}:${String(m).padStart(2, "0")} ${period}`;
}
