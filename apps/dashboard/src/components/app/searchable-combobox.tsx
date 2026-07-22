"use client";

import type * as React from "react";
import { useEffect, useMemo, useRef } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  notifyNestedOverlayChange,
  releaseNestedOverlayIfOpen,
} from "@/lib/nested-overlay";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  keywords?: string;
  description?: string;
};

type SearchableComboboxProps = {
  disabled?: boolean;
  emptyLabel: string;
  /**
   * When set, selection can be cleared (clear control in the search field).
   * Cleared value calls `onChange("")`.
   */
  noneLabel?: string;
  onChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
  className?: string;
  id?: string;
  /** Optional custom row for advanced lists (banks with meta, customers, etc.). */
  renderItem?: (item: SearchableComboboxOption) => React.ReactNode;
  /** Sticky footer inside the panel (e.g. “Create collection”). */
  panelFooter?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function useNestedOverlaySync() {
  const layerIdRef = useRef<symbol | null>(null);
  const openRef = useRef(false);

  useEffect(() => {
    return () => {
      releaseNestedOverlayIfOpen(openRef.current, layerIdRef.current);
      layerIdRef.current = null;
      openRef.current = false;
    };
  }, []);

  return {
    onOpenChange(open: boolean) {
      if (open) {
        layerIdRef.current = notifyNestedOverlayChange(true);
        openRef.current = true;
      } else {
        notifyNestedOverlayChange(false, layerIdRef.current ?? undefined);
        layerIdRef.current = null;
        openRef.current = false;
      }
    },
  };
}

function matchesOption(item: SearchableComboboxOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.label.toLowerCase().includes(q) ||
    item.value.toLowerCase().includes(q) ||
    (item.keywords?.toLowerCase().includes(q) ?? false) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

function OptionRow({
  item,
  renderItem,
}: {
  item: SearchableComboboxOption;
  renderItem?: (item: SearchableComboboxOption) => React.ReactNode;
}) {
  if (renderItem) return <>{renderItem(item)}</>;
  if (item.description) {
    return (
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{item.label}</span>
        <span className="truncate text-xs text-muted-foreground">{item.description}</span>
      </span>
    );
  }
  return <span className="min-w-0 flex-1 truncate">{item.label}</span>;
}

/**
 * Popup-variant single-select over the official shadcn Combobox:
 * outline button trigger + searchable list in the panel (docs "Combobox in Popup").
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
  renderItem,
  panelFooter,
  open,
  onOpenChange,
}: SearchableComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null;
  const canClear = Boolean(noneLabel) && Boolean(selected);
  const nested = useNestedOverlaySync();

  return (
    <Combobox
      disabled={disabled}
      filter={matchesOption}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      items={options}
      onOpenChange={(next) => {
        nested.onOpenChange(next);
        onOpenChange?.(next);
      }}
      onValueChange={(item) => {
        onChange(item?.value ?? "");
      }}
      value={selected}
      {...(open !== undefined ? { open } : {})}
    >
      <ComboboxTrigger
        disabled={disabled}
        id={id}
        render={
          <Button
            className={cn(
              "h-9 w-full justify-between px-3 font-normal shadow-none",
              !selected && "text-muted-foreground",
              className,
            )}
            disabled={disabled}
            type="button"
            variant="outline"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <ComboboxValue placeholder={placeholder} />
        </span>
      </ComboboxTrigger>

      <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
        <ComboboxInput
          className="w-auto"
          placeholder={searchPlaceholder ?? placeholder}
          showClear={canClear}
          showTrigger={false}
        />
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              <OptionRow
                item={item}
                {...(renderItem ? { renderItem } : {})}
              />
            </ComboboxItem>
          )}
        </ComboboxList>
        {panelFooter ? (
          <div className="border-t px-3 py-2">{panelFooter}</div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}

type MultiSearchableComboboxProps = {
  disabled?: boolean;
  emptyLabel: string;
  onChange: (values: string[]) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  values: string[];
  className?: string;
  id?: string;
  /** Trigger text when 2+ items are selected. Defaults to "{n} selected". */
  selectedCountLabel?: (count: number) => string;
  /** Aria-label for chip remove controls. */
  removeLabel?: (label: string) => string;
  renderItem?: (item: SearchableComboboxOption) => React.ReactNode;
  /**
   * Max height for the chips row under the trigger. Long selections scroll instead
   * of blowing up the form layout.
   */
  chipsMaxHeightClassName?: string;
  panelFooter?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, hide the chips row under the trigger (caller renders its own). */
  hideChips?: boolean;
};

/**
 * Popup-variant multi-select:
 * - Fixed-height outline trigger (summary text — never a growing chip input)
 * - Search + checklist inside the panel
 * - Selected values as fully rounded removable pills below the trigger
 *
 * Prefer this over ComboboxChips-as-field for dashboard multi-selects.
 */
export function MultiSearchableCombobox({
  disabled,
  emptyLabel,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  values,
  className,
  id,
  selectedCountLabel,
  removeLabel,
  renderItem,
  chipsMaxHeightClassName = "max-h-24",
  panelFooter,
  open,
  onOpenChange,
  hideChips = false,
}: MultiSearchableComboboxProps) {
  const nested = useNestedOverlaySync();

  const selectedOptions = useMemo(() => {
    const byValue = new Map(options.map((option) => [option.value, option]));
    return values
      .map((value) => byValue.get(value) ?? { value, label: value })
      .filter(Boolean);
  }, [options, values]);

  const triggerLabel =
    selectedOptions.length === 0
      ? null
      : selectedOptions.length === 1
        ? selectedOptions[0]!.label
        : (selectedCountLabel?.(selectedOptions.length) ??
          `${selectedOptions.length} selected`);

  function removeValue(value: string) {
    onChange(values.filter((current) => current !== value));
  }

  return (
    <div className="flex flex-col gap-2">
      <Combobox
        autoHighlight
        disabled={disabled}
        filter={matchesOption}
        isItemEqualToValue={(a, b) => a.value === b.value}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        items={options}
        multiple
        onOpenChange={(next) => {
          nested.onOpenChange(next);
          onOpenChange?.(next);
        }}
        onValueChange={(next) => {
          const list = Array.isArray(next) ? next : [];
          onChange(list.map((item) => item.value));
        }}
        value={selectedOptions}
        {...(open !== undefined ? { open } : {})}
      >
        <ComboboxTrigger
          disabled={disabled}
          id={id}
          render={
            <Button
              className={cn(
                "h-9 w-full justify-between px-3 font-normal shadow-none",
                selectedOptions.length === 0 && "text-muted-foreground",
                className,
              )}
              disabled={disabled}
              type="button"
              variant="outline"
            />
          }
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerLabel ?? placeholder}
          </span>
        </ComboboxTrigger>

        <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
          <ComboboxInput
            className="w-auto"
            placeholder={searchPlaceholder ?? placeholder}
            showTrigger={false}
          />
          <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item}>
                <OptionRow
                  item={item}
                  {...(renderItem ? { renderItem } : {})}
                />
              </ComboboxItem>
            )}
          </ComboboxList>
          {panelFooter ? (
            <div className="border-t px-3 py-2">{panelFooter}</div>
          ) : null}
        </ComboboxContent>
      </Combobox>

      {!hideChips && selectedOptions.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain pr-0.5",
            chipsMaxHeightClassName,
          )}
        >
          {selectedOptions.map((option) => (
            <Badge
              className="max-w-full gap-1 rounded-full py-0.5 pr-0.5 pl-2.5 font-normal"
              key={option.value}
              variant="secondary"
            >
              <span className="min-w-0 truncate">{option.label}</span>
              <button
                aria-label={removeLabel?.(option.label) ?? `Remove ${option.label}`}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-secondary-foreground/70 transition-colors hover:bg-background/70 hover:text-foreground"
                disabled={disabled}
                onClick={() => removeValue(option.value)}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
