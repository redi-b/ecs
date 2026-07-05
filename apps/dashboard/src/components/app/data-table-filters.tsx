"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
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
  children?: ReactNode;
  filters: DataTableFilterDefinition[];
  onClearAll: () => void;
};

export function DataTableFilters({ children, filters, onClearAll }: DataTableFiltersProps) {
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [pendingFilterId, setPendingFilterId] = useState<string | null>(null);
  const availableFilters = filters.filter((filter) => filter.value === filter.defaultValue);
  const activeFilters = filters.filter((filter) => filter.value !== filter.defaultValue);
  const pendingFilter = filters.find((filter) => filter.id === pendingFilterId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {children}
          {activeFilters.map((filter) => (
            <DataTableAppliedFilterChip
              filter={filter}
              key={filter.id}
            />
          ))}
          <Popover
            onOpenChange={(open) => {
              setAddFilterOpen(open);

              if (!open) {
                setPendingFilterId(null);
              }
            }}
            open={addFilterOpen}
          >
            <PopoverTrigger asChild>
              <Button className="rounded-full" size="sm" type="button" variant="outline">
                <AppIcons.filter data-icon="inline-start" />
                Add filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 rounded-2xl p-1.5" sideOffset={8}>
              {pendingFilter ? (
                <div className="px-1 pb-1">
                  <Button
                    className="h-8 rounded-full px-2 text-muted-foreground"
                    onClick={() => setPendingFilterId(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <AppIcons.arrowLeft data-icon="inline-start" />
                    Filters
                  </Button>
                </div>
              ) : null}
              <Command>
                <CommandInput
                  placeholder={
                    pendingFilter
                      ? `Search ${pendingFilter.label.toLowerCase()}...`
                      : "Search filters..."
                  }
                />
                <CommandList>
                  {pendingFilter ? (
                    <>
                      <CommandEmpty>No values found.</CommandEmpty>
                      <CommandGroup heading={pendingFilter.label}>
                        {getSelectableFilterOptions(pendingFilter).map((option) => (
                          <CommandItem
                            key={option.value}
                            onSelect={() => {
                              pendingFilter.onChange(option.value);
                              setPendingFilterId(null);
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
                            onSelect={() => setPendingFilterId(filter.id)}
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
            </PopoverContent>
          </Popover>
          {activeFilters.length ? (
            <Button
              className="rounded-full px-2 text-muted-foreground"
              onClick={onClearAll}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DataTableAppliedFilterChip({
  filter,
}: {
  filter: DataTableFilterDefinition;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className="flex h-9 items-center overflow-hidden rounded-full border bg-background/80 text-sm shadow-sm shadow-primary/5">
        <PopoverTrigger asChild>
          <button
            className="flex h-full items-center gap-2 px-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            type="button"
          >
            <span>{filter.label}</span>
            <span className="text-xs">is</span>
            <span className="font-medium text-foreground">{getFilterValueLabel(filter)}</span>
          </button>
        </PopoverTrigger>
        <Button
          aria-label={`Clear ${filter.label} filter`}
          className="h-full rounded-none border-l px-2"
          onClick={() => filter.onChange(filter.defaultValue)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.close data-icon="inline-start" />
        </Button>
      </div>
      <PopoverContent align="start" className="w-72 rounded-2xl p-1.5" sideOffset={8}>
        <Command>
          <CommandInput placeholder={`Search ${filter.label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No values found.</CommandEmpty>
            <CommandGroup heading={filter.label}>
              {getSelectableFilterOptions(filter).map((option) => (
                <CommandItem
                  data-checked={filter.value === option.value}
                  key={option.value}
                  onSelect={() => {
                    filter.onChange(option.value);
                    setOpen(false);
                  }}
                  value={option.label}
                >
                  <span>{option.label}</span>
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
