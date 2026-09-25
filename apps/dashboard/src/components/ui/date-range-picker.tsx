"use client";

import { type CalendarSystem, formatDualCalendarDate } from "@ecs/date-time";
import { useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { fromDateValue, toDateValue } from "@/components/ui/date-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type DateRangeValue = { start: string; end: string };

export type DateRangePickerLabels = {
  apply: string;
  available: string;
  cancel: string;
  chooseEnd: string;
  chooseStart: string;
  clear: string;
  end: string;
  start: string;
  notSet?: string;
  invalidRange?: string;
};

export function DateRangePicker({
  className,
  calendarSystem: calendarSystemProp,
  disabled = false,
  showBounds = true,
  maxDays,
  formatDate: formatDateProp,
  id,
  labels: labelsProp,
  max,
  min,
  onChange,
  onClear,
  open: controlledOpen,
  onOpenChange,
  onCloseAutoFocus,
  presets,
  placeholder = "Select dates",
  value,
}: {
  className?: string;
  calendarSystem?: CalendarSystem;
  disabled?: boolean;
  showBounds?: boolean;
  maxDays?: number;
  formatDate?: (date: Date) => string;
  id?: string;
  labels?: DateRangePickerLabels;
  max?: string;
  min?: string;
  onChange: (value: DateRangeValue) => void;
  onClear?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  presets?: {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void | false;
  };
  placeholder?: string;
  value: DateRangeValue;
}) {
  const {
    calendarSystem: preferredCalendarSystem,
    formatDate: formatPreferredDate,
    locale,
    t,
  } = useI18n();
  const labels: DateRangePickerLabels = labelsProp ?? {
    apply: t("common.datePicker.apply"),
    available: t("common.datePicker.available"),
    cancel: t("common.datePicker.cancel"),
    chooseEnd: t("common.datePicker.chooseEnd"),
    chooseStart: t("common.datePicker.chooseStart"),
    clear: t("common.datePicker.clear"),
    end: t("common.datePicker.end"),
    notSet: t("common.datePicker.notSet"),
    start: t("common.datePicker.start"),
  };
  const calendarSystem = calendarSystemProp ?? preferredCalendarSystem;
  const formatDate = formatDateProp ?? formatPreferredDate;
  const minDate = useMemo(() => fromDateValue(min ?? ""), [min]);
  const maxDate = useMemo(() => fromDateValue(max ?? ""), [max]);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [activeEndpoint, setActiveEndpoint] = useState<"start" | "end">("start");
  const [draft, setDraft] = useState<DateRangeValue>(value);
  const draftStart = useMemo(() => fromDateValue(draft.start), [draft.start]);
  const draftEnd = useMemo(() => fromDateValue(draft.end), [draft.end]);
  const selectedStart = useMemo(() => fromDateValue(value.start), [value.start]);
  const selectedEnd = useMemo(() => fromDateValue(value.end), [value.end]);
  const dualStart = draftStart
    ? formatDualCalendarDate(draftStart, { locale, primary: calendarSystem })
    : null;
  const dualEnd = draftEnd
    ? formatDualCalendarDate(draftEnd, { locale, primary: calendarSystem })
    : null;
  const [month, setMonth] = useState<Date>(selectedStart ?? maxDate ?? new Date());
  const validDraft =
    !!draftStart &&
    !!draftEnd &&
    draft.start <= draft.end &&
    (!min || draft.start >= min) &&
    (!max || draft.end <= max) &&
    (!maxDays || (Date.parse(draft.end) - Date.parse(draft.start)) / 86_400_000 < maxDays);

  useEffect(() => {
    if (!open) return;
    setDraft({ start: value.start, end: value.end });
    setActiveEndpoint("start");
    setMonth(selectedStart ?? maxDate ?? new Date());
  }, [maxDate, open, selectedStart, value.start, value.end]);

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
          disabled={disabled}
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
                ? `${formatDate(selectedStart)} – ${formatDate(selectedEnd)}`
                : placeholder}
            </span>
          </span>
          <AppIcons.arrowDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        onCloseAutoFocus={onCloseAutoFocus}
        align="end"
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,var(--radix-popover-content-available-width,calc(100vw-1.5rem)))] overflow-y-auto rounded-2xl border bg-popover p-0 shadow-lg ring-1 ring-foreground/5"
        collisionPadding={16}
        sideOffset={6}
      >
        {presets ? (
          <div className="border-b p-3">
            <Select
              value={presets.value}
              onValueChange={(next) => {
                if (presets.onChange(next) !== false) setOpen(false);
              }}
            >
              <SelectTrigger aria-label={presets.label} className="w-full">
                <SelectValue placeholder={presets.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {presets.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="border-b bg-muted/25 p-3">
          <div className="grid grid-cols-2 gap-2">
            <EndpointButton
              active={activeEndpoint === "start"}
              label={labels.start}
              onClick={() => chooseEndpoint("start")}
              secondaryValue={dualStart?.secondaryLabel}
              value={draftStart ? formatDate(draftStart) : (labels.notSet ?? "Not set")}
            />
            <EndpointButton
              active={activeEndpoint === "end"}
              label={labels.end}
              onClick={() => chooseEndpoint("end")}
              secondaryValue={dualEnd?.secondaryLabel}
              value={draftEnd ? formatDate(draftEnd) : (labels.notSet ?? "Not set")}
            />
          </div>
          <div className="mt-2 flex flex-col gap-1 px-1 text-xs text-muted-foreground">
            <span>{activeEndpoint === "start" ? labels.chooseStart : labels.chooseEnd}</span>
            {showBounds && (minDate || maxDate) ? (
              <span>
                {labels.available}: {minDate ? formatDate(minDate) : (labels.notSet ?? "Not set")} –{" "}
                {maxDate ? formatDate(maxDate) : (labels.notSet ?? "Not set")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-3">
          <Calendar
            calendarSystem={calendarSystem}
            maxDate={maxDate}
            minDate={minDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={pick}
            selectedRange={draftStart ? { start: draftStart, end: draftEnd } : null}
          />
        </div>
        {draftStart && draftEnd && !validDraft && labels.invalidRange ? (
          <p className="px-3 pb-3 text-sm text-destructive" role="alert">
            {labels.invalidRange}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t bg-muted/15 p-3">
          <Button
            onClick={() => {
              setDraft({ start: "", end: "" });
              if (onClear) {
                onClear();
                setOpen(false);
              }
            }}
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
              disabled={!validDraft}
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
  secondaryValue,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  value: string;
  secondaryValue?: string | undefined;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors outline-none",
        "hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary bg-background ring-2 ring-primary/15"
          : "border-border bg-background/70",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-sm font-medium text-foreground">{value}</span>
      {secondaryValue ? (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{secondaryValue}</span>
      ) : null}
    </button>
  );
}
