"use client";

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
import { cn } from "@/lib/utils";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableComboboxProps = {
  disabled?: boolean;
  emptyLabel: string;
  /** Optional “clear / none” row. When set, selecting it calls onChange(""). */
  noneLabel?: string;
  onChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  value: string;
  className?: string;
  id?: string;
};

/**
 * Searchable single-select used in filters, mark-paid, and settings.
 * Same Command + Popover pattern as parent-category / customer pickers.
 */
export function SearchableCombobox({
  disabled,
  emptyLabel,
  noneLabel,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
  className,
  id,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between px-3 font-normal shadow-none",
            !selected && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        collisionPadding={16}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command className="h-auto max-h-72 w-full min-h-0">
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList
            className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>
              <span className="px-2 text-sm text-muted-foreground">{emptyLabel}</span>
            </CommandEmpty>
            <CommandGroup className="overflow-visible">
              {noneLabel ? (
                <CommandItem
                  data-checked={!value ? true : undefined}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  value="none clear"
                >
                  <span className="truncate text-muted-foreground">{noneLabel}</span>
                </CommandItem>
              ) : null}
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
