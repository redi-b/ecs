"use client";

import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * Shared list-toolbar density.
 * One height + pill radius for search, filters, toggles, and actions so
 * list pages feel intentional rather than mixed shadcn defaults.
 */
export const listToolbarHeightClass = "h-9";
export const listToolbarRadiusClass = "rounded-full";
export const listToolbarControlClassName = cn(
  listToolbarHeightClass,
  listToolbarRadiusClass,
  "text-sm font-medium",
);

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
    <InputGroup
      className={cn(
        listToolbarHeightClass,
        listToolbarRadiusClass,
        "w-full bg-background/70 px-1 sm:max-w-sm",
      )}
    >
      <InputGroupAddon>
        <AppIcons.search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        className="text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {value.trim() ? (
        <InputGroupAddon align="inline-end">
          <Button
            aria-label={clearLabel}
            className={listToolbarRadiusClass}
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

/**
 * Segmented view switcher for media, taxonomy, and other lists.
 * Icon + visible label (no hover-only tooltips) for mobile clarity.
 * Outer track matches listToolbarHeightClass so it lines up with actions.
 */
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
    <div
      className={cn(
        "inline-flex shrink-0 items-center border bg-background/70 p-0.5",
        listToolbarHeightClass,
        listToolbarRadiusClass,
      )}
      role="group"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <Button
            aria-label={option.label}
            aria-pressed={active}
            className={cn(
              "h-full min-h-0 gap-1.5 rounded-full px-2.5 text-sm font-medium shadow-none",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
