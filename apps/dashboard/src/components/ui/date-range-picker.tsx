"use client";

import { useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, fromDateValue, toDateValue } from "@/components/ui/date-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateRangeValue = { start: string; end: string };

type DateRangePickerLabels = {
  apply: string;
  available: string;
  cancel: string;
  chooseEnd: string;
  chooseStart: string;
  clear: string;
  end: string;
  start: string;
};

const defaultLabels: DateRangePickerLabels = {
  apply: "Apply range",
  available: "Available data",
  cancel: "Cancel",
  chooseEnd: "Choose the end date",
  chooseStart: "Choose the start date",
  clear: "Clear",
  end: "End",
  start: "Start",
};

export function DateRangePicker({
  className,
  id,
  labels = defaultLabels,
  max,
  min,
  onChange,
  placeholder = "Select dates",
  value,
}: {
  className?: string;
  id?: string;
  labels?: DateRangePickerLabels;
  max?: string;
  min?: string;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  value: DateRangeValue;
}) {
  const minDate = useMemo(() => fromDateValue(min ?? ""), [min]);
  const maxDate = useMemo(() => fromDateValue(max ?? ""), [max]);
  const [open, setOpen] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<"start" | "end">("start");
  const [draft, setDraft] = useState<DateRangeValue>(value);
  const draftStart = useMemo(() => fromDateValue(draft.start), [draft.start]);
  const draftEnd = useMemo(() => fromDateValue(draft.end), [draft.end]);
  const selectedStart = useMemo(() => fromDateValue(value.start), [value.start]);
  const selectedEnd = useMemo(() => fromDateValue(value.end), [value.end]);
  const [month, setMonth] = useState<Date>(selectedStart ?? maxDate ?? new Date());

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setActiveEndpoint("start");
    setMonth(selectedStart ?? maxDate ?? new Date());
  }, [maxDate, open, selectedStart, value]);

  function pick(date: Date) {
    const picked = toDateValue(date);
    if (activeEndpoint === "start") {
      setDraft((current) => ({
        start: picked,
        end: current.end && current.end >= picked ? current.end : "",
      }));
      setActiveEndpoint("end");
      return;
    }
    setDraft((current) =>
      current.start && picked < current.start
        ? { start: picked, end: current.start }
        : { start: current.start || picked, end: picked },
    );
  }

  function chooseEndpoint(endpoint: "start" | "end") {
    setActiveEndpoint(endpoint);
    const date = endpoint === "start" ? draftStart : draftEnd;
    if (date) setMonth(date);
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between gap-2 border-input bg-background px-3 font-normal shadow-none",
            "hover:border-foreground/20 hover:bg-background",
            open && "border-ring ring-3 ring-ring/30",
            !selectedStart && "text-muted-foreground",
            className,
          )}
          id={id}
          type="button"
          variant="outline"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AppIcons.calendar className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedStart && selectedEnd
                ? `${format(selectedStart, "PP")} – ${format(selectedEnd, "PP")}`
                : placeholder}
            </span>
          </span>
          <AppIcons.arrowDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,var(--radix-popover-content-available-width,calc(100vw-1.5rem)))] overflow-hidden rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/5"
        collisionPadding={16}
        onOpenAutoFocus={(event) => event.preventDefault()}
        sideOffset={6}
      >
        <div className="border-b bg-muted/25 p-3">
          <div className="grid grid-cols-2 gap-2">
            <EndpointButton
              active={activeEndpoint === "start"}
              label={labels.start}
              onClick={() => chooseEndpoint("start")}
              value={draftStart ? format(draftStart, "PP") : "—"}
            />
            <EndpointButton
              active={activeEndpoint === "end"}
              label={labels.end}
              onClick={() => chooseEndpoint("end")}
              value={draftEnd ? format(draftEnd, "PP") : "—"}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
            <span>{activeEndpoint === "start" ? labels.chooseStart : labels.chooseEnd}</span>
            <span className="shrink-0">
              {labels.available}: {minDate ? format(minDate, "PP") : "—"} – {maxDate ? format(maxDate, "PP") : "—"}
            </span>
          </div>
        </div>
        <div className="p-3">
          <Calendar
            maxDate={maxDate}
            minDate={minDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={pick}
            selectedRange={draftStart ? { start: draftStart, end: draftEnd } : null}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/15 p-3">
          <Button
            onClick={() => setDraft({ start: "", end: "" })}
            size="sm"
            type="button"
            variant="ghost"
          >
            {labels.clear}
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)} size="sm" type="button" variant="outline">
              {labels.cancel}
            </Button>
            <Button
              disabled={!draft.start || !draft.end}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              size="sm"
              type="button"
            >
              {labels.apply}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EndpointButton({
  active,
  label,
  onClick,
  value,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors outline-none",
        "hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "border-primary bg-background ring-2 ring-primary/15" : "border-border bg-background/70",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-sm font-medium text-foreground">{value}</span>
    </button>
  );
}
