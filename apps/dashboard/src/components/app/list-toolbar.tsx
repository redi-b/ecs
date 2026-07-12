"use client";

import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
    <InputGroup className="h-10 w-full rounded-full bg-background/70 px-1 sm:max-w-sm">
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

/**
 * Segmented view switcher used by media, taxonomy, and other lists.
 * Labels stay visible (no hover-only tooltips) so mobile remains clear.
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
      className="flex shrink-0 items-center rounded-full border bg-background/70 p-0.5"
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
              "h-8 gap-1.5 rounded-full px-2.5 text-xs font-medium",
              active && "bg-muted text-foreground shadow-none",
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
