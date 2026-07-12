"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { listToolbarControlClassName } from "@/components/app/list-toolbar";
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

export function DataTableFilters({
  actions,
  children,
  filters,
  onClearAll,
}: DataTableFiltersProps) {
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {children}
          {activeFilters.map((filter) => (
            <DataTableAppliedFilterChip filter={filter} key={filter.id} />
          ))}
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
                  Add filter
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 overflow-hidden rounded-2xl p-1.5 shadow-lg"
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
                  {pendingFilter ? (
                    <div className="px-1 pb-1">
                      <Button
                        className="h-8 rounded-full px-2 text-muted-foreground"
                        onClick={() => setPendingFilter(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <AppIcons.arrowLeft data-icon="inline-start" />
                        Filters
                      </Button>
                    </div>
                  ) : null}
                  <Command shouldFilter>
                    <CommandInput
                      onValueChange={setFilterSearch}
                      placeholder={
                        pendingFilter
                          ? `Search ${pendingFilter.label.toLowerCase()}…`
                          : "Search filters…"
                      }
                      value={filterSearch}
                    />
                    <CommandList className="max-h-64">
                      {pendingFilter ? (
                        <>
                          <CommandEmpty>No values found.</CommandEmpty>
                          <CommandGroup heading={pendingFilter.label}>
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
                          <CommandEmpty>No filters found.</CommandEmpty>
                          <CommandGroup>
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
          {activeFilters.length ? (
            <Button
              className={cn(listToolbarControlClassName, "text-muted-foreground")}
              onClick={onClearAll}
              size="sm"
              type="button"
              variant="ghost"
            >
              <AppIcons.close data-icon="inline-start" />
              Clear all
            </Button>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

function DataTableAppliedFilterChip({ filter }: { filter: DataTableFilterDefinition }) {
  const [open, setOpen] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setOptionSearch("");
      }}
      open={open}
    >
      <div
        className={cn(
          "flex h-8 items-center overflow-hidden rounded-full border bg-background/90 text-sm",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
      >
        <PopoverTrigger asChild>
          <button
            className="flex h-full items-center gap-1.5 px-2.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            type="button"
          >
            <span className="text-xs">{filter.label}</span>
            <span className="text-[11px] opacity-60">is</span>
            <span className="font-medium text-foreground">{getFilterValueLabel(filter)}</span>
          </button>
        </PopoverTrigger>
        <Button
          aria-label={`Clear ${filter.label} filter`}
          className="h-full rounded-none border-l px-1.5"
          onClick={() => filter.onChange(filter.defaultValue)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.close data-icon="inline-start" />
        </Button>
      </div>
      <PopoverContent
        align="start"
        className="w-72 overflow-hidden rounded-2xl p-1.5 shadow-lg"
        sideOffset={8}
      >
        <Command>
          <CommandInput
            onValueChange={setOptionSearch}
            placeholder={`Search ${filter.label.toLowerCase()}…`}
            value={optionSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No values found.</CommandEmpty>
            <CommandGroup heading={filter.label}>
              {getSelectableFilterOptions(filter).map((option) => (
                <CommandItem
                  data-checked={filter.value === option.value ? true : undefined}
                  key={option.value}
                  onSelect={() => {
                    filter.onChange(option.value);
                    setOpen(false);
                  }}
                  value={option.label}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getFilterValueLabel(filter: DataTableFilterDefinition) {
  return filter.options.find((option) => option.value === filter.value)?.label ?? filter.value;
}

function getSelectableFilterOptions(filter: DataTableFilterDefinition) {
  return filter.options.filter((option) => option.value !== filter.defaultValue);
}
