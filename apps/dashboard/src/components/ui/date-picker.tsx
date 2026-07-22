"use client";

import { useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  addDays,
  format,
  fromDateValue,
  isToday,
  toDateValue,
} from "@/components/ui/date-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  className?: string;
  id?: string;
  onChange: (value: string) => void;
  /** `YYYY-MM-DD` */
  value: string;
  placeholder?: string;
  disabled?: boolean;
  /** Close popover after picking a day (default true). */
  closeOnSelect?: boolean;
};

export function DatePicker({
  className,
  id,
  onChange,
  value,
  placeholder = "Pick a date",
  disabled = false,
  closeOnSelect = true,
}: DatePickerProps) {
  const selected = useMemo(() => fromDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    setMonth(selected ?? new Date());
  }, [open, selected]);

  function pick(date: Date) {
    onChange(toDateValue(date));
    if (closeOnSelect) setOpen(false);
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
            <span className="truncate">
              {selected ? format(selected, "PP") : placeholder}
            </span>
          </span>
          {selected ? (
            <span
              aria-label="Clear date"
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
        align="start"
        avoidCollisions
        className={cn(
          "w-[min(20rem,var(--radix-popover-content-available-width,calc(100vw-1.5rem)))] gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/5",
          "duration-200 ease-out",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
        collisionPadding={16}
        data-datetime-picker=""
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="bottom"
        sideOffset={6}
        sticky="partial"
      >
        <div className="border-b bg-muted/25 px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Date
          </p>
          <p className="mt-0.5 text-base font-semibold tracking-tight">
            {selected ? format(selected, "PPP") : "Select a day"}
          </p>
        </div>

        <div className="p-3">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            onSelect={pick}
            selected={selected}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 border-t bg-muted/15 px-3 py-2.5">
          <PresetChip
            active={Boolean(selected && isToday(selected))}
            label="Today"
            onClick={() => pick(new Date())}
          />
          <PresetChip label="Tomorrow" onClick={() => pick(addDays(new Date(), 1))} />
          {value ? (
            <PresetChip
              label="Clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
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
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
