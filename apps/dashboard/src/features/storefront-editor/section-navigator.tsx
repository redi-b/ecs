"use client";

import { RiArrowDownSLine, RiExpandUpDownLine } from "@remixicon/react";
import { useState } from "react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SectionNavigator({
  activeId,
  allExpanded,
  className,
  collapseAllLabel,
  emptyLabel,
  expandAllLabel,
  jumpLabel,
  onSelect,
  onToggleAll,
  searchLabel,
  sections,
}: {
  activeId?: string | undefined;
  allExpanded: boolean;
  className?: string;
  collapseAllLabel: string;
  emptyLabel: string;
  expandAllLabel: string;
  jumpLabel: string;
  onSelect: (id: string) => void;
  onToggleAll: () => void;
  searchLabel: string;
  sections: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const active = sections.find((section) => section.id === activeId);
  const toggleLabel = allExpanded ? collapseAllLabel : expandAllLabel;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className="h-8 min-w-0 flex-1 justify-between px-3 font-normal"
            type="button"
            variant="outline"
          >
            <span className={cn("truncate", !active && "text-muted-foreground")}>
              {active?.label ?? jumpLabel}
            </span>
            <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
          sideOffset={6}
        >
          <Command shouldFilter>
            <CommandInput placeholder={searchLabel} size="panel" />
            <CommandList className="max-h-72 px-1.5 pb-1.5">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup className="p-0">
                {sections.map((section) => (
                  <CommandItem
                    data-checked={activeId === section.id ? true : undefined}
                    key={section.id}
                    onSelect={() => {
                      onSelect(section.id);
                      setOpen(false);
                    }}
                    value={`${section.label} ${section.id}`}
                  >
                    {section.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={toggleLabel}
            className="size-8 shrink-0"
            onClick={onToggleAll}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <RiExpandUpDownLine aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{toggleLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
