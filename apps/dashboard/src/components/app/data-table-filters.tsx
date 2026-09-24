"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { listToolbarControlClassName } from "@/components/app/list-toolbar";
import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type DataTableFilterOption = {
  label: string;
  value: string;
};

export type DataTableFilterDefinition = {
  kind?: "select";
  defaultValue: string;
  id: string;
  label: string;
  options: DataTableFilterOption[];
  value: string;
  onChange: (value: string) => void;
};

export type DataTableDateFilterValue =
  | { kind: "preset"; preset: string }
  | { kind: "range"; start: string; end: string }
  | null;

export type DataTableDateFilterDefinition = {
  kind: "date";
  id: string;
  label: string;
  options: DataTableFilterOption[];
  value: DataTableDateFilterValue;
  onChange: (value: DataTableDateFilterValue) => void;
};

export type DataTableFilter = DataTableFilterDefinition | DataTableDateFilterDefinition;

function isActive(filter: DataTableFilter) {
  return filter.kind === "date" ? filter.value !== null : filter.value !== filter.defaultValue;
}

type DataTableFiltersProps = {
  actions?: ReactNode;
  children?: ReactNode;
  filters: DataTableFilter[];
  onClearAll: () => void;
};

export function DataTableFilters({
  actions,
  children,
  filters,
  onClearAll,
}: DataTableFiltersProps) {
  const { t } = useI18n();
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [pendingFilterId, setPendingFilterId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const addFilterTrigger = useRef<HTMLButtonElement>(null);
  const availableFilters = filters.filter((filter) => !isActive(filter));
  const activeFilters = filters.filter(isActive);
  const pendingFilter =
    filters.find(
      (filter): filter is DataTableFilterDefinition =>
        filter.kind !== "date" && filter.id === pendingFilterId,
    ) ?? null;

  function setPendingFilter(nextFilterId: string | null) {
    setFilterSearch("");
    setPendingFilterId(nextFilterId);
  }

  const addFilterTriggerControl =
    availableFilters.length > 0 ? (
      <Popover
        onOpenChange={(open) => {
          setAddFilterOpen(open);
          if (!open) setPendingFilter(null);
        }}
        open={addFilterOpen}
      >
        <PopoverTrigger asChild>
          <Button
            ref={addFilterTrigger}
            className={cn(listToolbarControlClassName, "shrink-0")}
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.filter data-icon="inline-start" />
            {t("filters.add")}
          </Button>
        </PopoverTrigger>
          <PopoverContent
            onCloseAutoFocus={(event) => {
              if (editingDateId) event.preventDefault();
            }}
            align="start"
            className="w-72 overflow-hidden rounded-xl p-0 shadow-md ring-1 ring-foreground/10"
            onOpenAutoFocus={(event) => event.preventDefault()}
            sideOffset={8}
          >
            <div
              className={cn(
                "transition-[opacity,transform] duration-200 ease-out",
                pendingFilter
                  ? "animate-in fade-in-0 slide-in-from-right-2"
                  : "animate-in fade-in-0 slide-in-from-left-1",
              )}
              key={pendingFilter ? `values-${pendingFilter.id}` : "filters"}
            >
              <Command className="rounded-none bg-transparent p-0" shouldFilter>
                {pendingFilter ? (
                  <div className="relative flex h-8 items-center border-b border-border/60 px-1">
                    <button
                      aria-label={t("filters.title")}
                      className="absolute left-1 z-10 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => setPendingFilter(null)}
                      type="button"
                    >
                      <AppIcons.arrowLeft className="size-3.5" />
                    </button>
                    <p className="w-full truncate px-9 text-center text-xs font-medium">
                      {pendingFilter.label}
                    </p>
                  </div>
                ) : null}
                <CommandInput
                  key={pendingFilter ? `search-${pendingFilter.id}` : "search-filters"}
                  onValueChange={setFilterSearch}
                  placeholder={
                    pendingFilter
                      ? t("filters.searchLabel", { label: pendingFilter.label.toLowerCase() })
                      : t("filters.searchAll")
                  }
                  size="panel"
                  value={filterSearch}
                />
                <CommandList className="max-h-64 px-1.5 pb-1.5 pt-0">
                  {pendingFilter ? (
                    <>
                      <CommandEmpty>{t("filters.noValues")}</CommandEmpty>
                      <CommandGroup className="p-0">
                        {getSelectableFilterOptions(pendingFilter).map((option) => (
                          <CommandItem
                            data-checked={pendingFilter.value === option.value ? true : undefined}
                            key={option.value}
                            onSelect={() => {
                              pendingFilter.onChange(option.value);
                              setPendingFilter(null);
                              setAddFilterOpen(false);
                            }}
                            value={option.label}
                          >
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  ) : (
                    <>
                      <CommandEmpty>{t("filters.noFilters")}</CommandEmpty>
                      <CommandGroup className="p-0">
                        {availableFilters.map((filter) => (
                          <CommandItem
                            key={filter.id}
                            onSelect={() => {
                              if (filter.kind === "date") {
                                setEditingDateId(filter.id);
                                setAddFilterOpen(false);
                              } else setPendingFilter(filter.id);
                            }}
                            value={filter.label}
                          >
                            {filter.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </div>
          </PopoverContent>
        </Popover>
      ) : null;

  const activeChips = (
    <>
      {filters.map((filter) =>
        filter.kind === "date" ? (
          isActive(filter) || editingDateId === filter.id ? (
            <DataTableDateFilterControl
              key={filter.id}
              filter={filter}
              open={editingDateId === filter.id}
              onOpenChange={(open) => setEditingDateId(open ? filter.id : null)}
              onCloseAutoFocus={(event) => {
                if (!isActive(filter)) {
                  event.preventDefault();
                  addFilterTrigger.current?.focus();
                }
              }}
            />
          ) : null
        ) : isActive(filter) ? (
          <DataTableAppliedFilterChip filter={filter} key={filter.id} />
        ) : null,
      )}

      {activeFilters.length ? (
        <Button
          className={cn(listToolbarControlClassName, "text-muted-foreground")}
          onClick={onClearAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.close data-icon="inline-start" />
          {t("filters.clearAll")}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      {/* Find → refine (search, Filters, chips) */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto sm:shrink-0 sm:gap-2">
          {children ? (
            <div className="min-w-0 flex-1 sm:w-auto sm:max-w-none sm:shrink-0">{children}</div>
          ) : null}
          {addFilterTriggerControl}
        </div>
        {activeChips}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function DataTableDateFilterControl({
  filter,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  filter: DataTableDateFilterDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useI18n();
  const value: DateRangeValue =
    filter.value?.kind === "range"
      ? { start: filter.value.start, end: filter.value.end }
      : { start: "", end: "" };
  const preset = filter.value?.kind === "preset" ? filter.value.preset : "";
  const presetLabel = filter.options.find((option) => option.value === preset)?.label;
  return (
    <DateRangePicker
      className={cn(listToolbarControlClassName, "max-w-full sm:max-w-80")}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      value={value}
      placeholder={presetLabel ? `${filter.label}: ${presetLabel}` : filter.label}
      onChange={(range) => filter.onChange({ kind: "range", ...range })}
      onClear={() => filter.onChange(null)}
      presets={{
        label: filter.label,
        value: preset,
        options: filter.options,
        onChange: (next) => filter.onChange({ kind: "preset", preset: next }),
      }}
      labels={{
        apply: t("overview.trading.datePicker.apply"),
        available: t("overview.trading.datePicker.available"),
        cancel: t("overview.trading.datePicker.cancel"),
        chooseEnd: t("overview.trading.datePicker.chooseEnd"),
        chooseStart: t("overview.trading.datePicker.chooseStart"),
        clear: t("overview.trading.datePicker.clear"),
        end: t("overview.trading.datePicker.end"),
        start: t("overview.trading.datePicker.start"),
      }}
    />
  );
}

function DataTableAppliedFilterChip({ filter }: { filter: DataTableFilterDefinition }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      getSelectableFilterOptions(filter).map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [filter],
  );

  return (
    <div
      className={cn(
        "flex h-8 items-center overflow-hidden rounded-full border border-border/80 bg-background text-sm",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
    >
      <SearchableCombobox
        contentClassName="min-w-72"
        emptyLabel={t("filters.noValues")}
        onChange={(next) => {
          filter.onChange(next);
          setOpen(false);
        }}
        onOpenChange={setOpen}
        open={open}
        options={options}
        placeholder={getFilterValueLabel(filter)}
        renderValue={() => (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{filter.label}</span>
            <span className="text-[11px] text-muted-foreground opacity-60">{t("filters.is")}</span>
            <span className="truncate font-medium text-foreground">
              {getFilterValueLabel(filter)}
            </span>
          </span>
        )}
        searchPlaceholder={t("filters.searchLabel", { label: filter.label.toLowerCase() })}
        trigger={
          <button
            className="flex h-8 max-w-[16rem] items-center gap-1.5 px-2.5 text-left text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            type="button"
          />
        }
        value={filter.value}
      />
      <Button
        aria-label={t("filters.clearFilterAria", { label: filter.label })}
        className="h-full rounded-none border-l border-border/70 px-1.5"
        onClick={() => filter.onChange(filter.defaultValue)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <AppIcons.close data-icon="inline-start" />
      </Button>
    </div>
  );
}

function getSelectableFilterOptions(filter: DataTableFilterDefinition) {
  return filter.options.filter((option) => option.value !== filter.defaultValue);
}

function getFilterValueLabel(filter: DataTableFilterDefinition) {
  return filter.options.find((option) => option.value === filter.value)?.label ?? filter.value;
}
