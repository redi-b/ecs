"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
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
import { getCategoryDisplayName } from "@/features/catalog-taxonomy/taxonomy-table-state";
import { cn } from "@/lib/utils";

const ROOT_VALUE = "__root__";

export function ParentCategoryCombobox({
  disabled,
  onChange,
  options,
  rootLabel,
  searchPlaceholder,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: MerchantProductCategory[];
  rootLabel: string;
  searchPlaceholder: string;
  /** Category id, or `__root__` / empty for top-level. */
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const normalized = !value || value === ROOT_VALUE ? ROOT_VALUE : value;
  const selected =
    normalized === ROOT_VALUE
      ? null
      : (options.find((category) => category.id === normalized) ?? null);
  const label = selected ? getCategoryDisplayName(selected) : rootLabel;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between px-3 font-normal shadow-none",
            !selected && "text-muted-foreground",
          )}
          disabled={disabled}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
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
              <span className="px-2 text-sm text-muted-foreground">{rootLabel}</span>
            </CommandEmpty>
            <CommandGroup className="overflow-visible">
              <CommandItem
                data-checked={normalized === ROOT_VALUE ? true : undefined}
                onSelect={() => {
                  onChange(ROOT_VALUE);
                  setOpen(false);
                }}
                value={`${rootLabel} root`}
              >
                <span className="truncate font-medium">{rootLabel}</span>
              </CommandItem>
              {options.map((category) => {
                const name = getCategoryDisplayName(category);
                const isSelected = normalized === category.id;
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={category.id}
                    onSelect={() => {
                      onChange(category.id);
                      setOpen(false);
                    }}
                    value={`${name} ${category.handle ?? ""} ${category.id}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {category.handle ? (
                      <span className="ml-2 max-w-[40%] truncate text-xs text-muted-foreground">
                        /{category.handle}
                      </span>
                    ) : null}
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
