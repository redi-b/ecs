"use client";

import { useEffect, useRef, useState } from "react";

import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * Shared list-toolbar density for catalog/media/order tables.
 *
 * Uses h-8 (32px) to match default Button + InputGroup height so toolbars
 * sit at the same optical weight as table chrome, not auth/form fields.
 * Pill radius keeps the premium feel without oversized padding.
 */
export const listToolbarHeightClass = "h-8";
export const listToolbarRadiusClass = "rounded-full";
export const listToolbarControlClassName = cn(
  listToolbarHeightClass,
  listToolbarRadiusClass,
  "gap-1.5 px-2.5 text-sm font-medium",
);

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

export function ListToolbarSearch({
  clearLabel,
  debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  label,
  onChange,
  placeholder,
  value,
}: {
  clearLabel: string;
  /** Delay before calling onChange while typing. Clear always commits immediately. */
  debounceMs?: number;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync when the committed value changes from outside (URL nav, clear, filters reset).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }
    if (draft === value) return;

    const timeout = window.setTimeout(() => {
      onChangeRef.current(draft);
    }, Math.max(0, debounceMs));

    return () => window.clearTimeout(timeout);
  }, [debounceMs, draft, value]);

  function commitImmediate(next: string) {
    skipDebounceRef.current = true;
    setDraft(next);
    onChange(next);
  }

  return (
    <InputGroup
      className={cn(
        listToolbarHeightClass,
        listToolbarRadiusClass,
        "w-full min-w-0 bg-background/70 px-0.5 sm:max-w-sm",
      )}
    >
      <InputGroupAddon>
        <AppIcons.search className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        className="text-sm"
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        value={draft}
      />
      {draft.trim() ? (
        <InputGroupAddon align="inline-end">
          <Button
            aria-label={clearLabel}
            className={listToolbarRadiusClass}
            onClick={() => commitImmediate("")}
            size="icon-xs"
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
        "inline-flex shrink-0 items-stretch border bg-background/70 p-px",
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
              "h-auto min-h-0 gap-1.5 rounded-full px-2.5 text-sm font-medium shadow-none",
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
