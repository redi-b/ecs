"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type DataTableFilterOption = {
  label: string;
  value: string;
};

export type DataTableFilterDefinition = {
  defaultValue: string;
  id: string;
  label: string;
  options: DataTableFilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type DataTableFiltersProps = {
  actions?: ReactNode;
  children?: ReactNode;
  filters: DataTableFilterDefinition[];
  onClearAll: () => void;
};

/** Search + Filters + chips left; view/trailing actions right. */
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
  const availableFilters = filters.filter((filter) => filter.value === filter.defaultValue);
  const activeFilters = filters.filter((filter) => filter.value !== filter.defaultValue);
  const pendingFilter = filters.find((filter) => filter.id === pendingFilterId) ?? null;

  function setPendingFilter(nextFilterId: string | null) {
    setFilterSearch("");
    setPendingFilterId(nextFilterId);
  }

  const filterControls = (
    <>
      {availableFilters.length > 0 ? (
        <Popover
          onOpenChange={(open) => {
            setAddFilterOpen(open);
            if (!open) setPendingFilter(null);
          }}
          open={addFilterOpen}
        >
          <PopoverTrigger asChild>
            <Button
              className={listToolbarControlClassName}
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.filter data-icon="inline-start" />
              {t("filters.add")}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 overflow-hidden rounded-xl p-0 shadow-md ring-1 ring-foreground/10"
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
                  autoFocus
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
                            data-checked={
                              pendingFilter.value === option.value ? true : undefined
                            }
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
                            onSelect={() => setPendingFilter(filter.id)}
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
      ) : null}

      {activeFilters.map((filter) => (
        <DataTableAppliedFilterChip filter={filter} key={filter.id} />
      ))}

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
        {children ? (
          <div className="w-full min-w-0 sm:w-auto sm:max-w-none sm:shrink-0">{children}</div>
        ) : null}
        {filterControls}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0">
          {actions}
        </div>
      ) : null}
    </div>
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
