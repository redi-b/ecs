"use client";

import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ListToolbarSearch({
  clearLabel,
  label,
  onChange,
  placeholder,
  value,
}: {
  clearLabel: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
      <InputGroupAddon>
        <AppIcons.search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {value.trim() ? (
        <InputGroupAddon align="inline-end">
          <Button
            aria-label={clearLabel}
            className="rounded-full"
            onClick={() => onChange("")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <AppIcons.close />
          </Button>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export function ListViewToggle<T extends string>({
  options,
  onChange,
  value,
}: {
  options: Array<{ icon: AppIcon; label: string; value: T }>;
  onChange: (value: T) => void;
  value: T;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-full border bg-background/70 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                aria-label={option.label}
                className={cn("rounded-full", value === option.value && "bg-muted text-foreground")}
                onClick={() => onChange(option.value)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
