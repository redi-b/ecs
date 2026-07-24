"use client";

import { useEffect, useRef, useState } from "react";

import { type AppIcon, AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

/** Shared list-toolbar density — aligns with default Button height. */
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
  className,
}: {
  clearLabel: string;
  debounceMs?: number;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        "w-full min-w-0 max-w-full border-border/80 bg-background px-0.5 shadow-none",
        "sm:w-[14.5rem] sm:max-w-[14.5rem] lg:w-[16rem] lg:max-w-[16rem]",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        className,
      )}
    >
      <InputGroupAddon>
        <AppIcons.search className="size-3.5 text-muted-foreground" />
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
    <SegmentedControl
      active="muted"
      ariaLabel="View"
      className="h-8 shrink-0 [&_button]:min-w-8 [&_button]:px-2 md:[&_button]:min-w-[4.75rem] md:[&_button]:px-2.5"
      fullWidth={false}
      onChange={onChange}
      options={options.map((option) => {
        const Icon = option.icon;
        return {
          id: option.value,
          ariaLabel: option.label,
          label: (
            <>
              <Icon className="size-3.5 shrink-0 opacity-80" />
              <span className="hidden text-sm font-medium md:inline">{option.label}</span>
            </>
          ),
        };
      })}
      size="sm"
      value={value}
    />
  );
}
