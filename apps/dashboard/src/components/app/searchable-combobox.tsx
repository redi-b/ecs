"use client";

import { useEffect, useRef } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  notifyNestedOverlayChange,
  releaseNestedOverlayIfOpen,
} from "@/lib/nested-overlay";
import { cn } from "@/lib/utils";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableComboboxProps = {
  disabled?: boolean;
  emptyLabel: string;
  /**
   * When set, shows a clear control so the selection can be emptied.
   * Cleared value calls `onChange("")`.
   */
  noneLabel?: string;
  onChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  /** Kept for call-site compatibility; the same input is display + filter. */
  searchPlaceholder?: string;
  value: string;
  className?: string;
  id?: string;
};

/**
 * Thin single-select over the official shadcn Combobox.
 * Maps string ids ↔ `{ value, label }` options used across the dashboard.
 */
export function SearchableCombobox({
  disabled,
  emptyLabel,
  noneLabel,
  onChange,
  options,
  placeholder,
  value,
  className,
  id,
}: SearchableComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null;
  // Clear only when the call site allows empty selection *and* something is selected.
  const canClear = Boolean(noneLabel) && Boolean(selected);
  const layerIdRef = useRef<symbol | null>(null);
  const openRef = useRef(false);

  useEffect(() => {
    return () => {
      releaseNestedOverlayIfOpen(openRef.current, layerIdRef.current);
      layerIdRef.current = null;
      openRef.current = false;
    };
  }, []);

  return (
    <Combobox
      disabled={disabled}
      filter={(item, query) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q) ||
          (item.keywords?.toLowerCase().includes(q) ?? false)
        );
      }}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      items={options}
      onOpenChange={(open) => {
        if (open) {
          layerIdRef.current = notifyNestedOverlayChange(true);
          openRef.current = true;
        } else {
          notifyNestedOverlayChange(false, layerIdRef.current ?? undefined);
          layerIdRef.current = null;
          openRef.current = false;
        }
      }}
      onValueChange={(item) => {
        onChange(item?.value ?? "");
      }}
      value={selected}
    >
      <ComboboxInput
        className={cn("w-full", className)}
        disabled={disabled}
        id={id}
        placeholder={placeholder}
        showClear={canClear}
      />
      <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
