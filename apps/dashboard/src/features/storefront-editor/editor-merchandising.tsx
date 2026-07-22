"use client";

import { useEffect, useMemo, useState } from "react";
import { RiCheckLine, RiEditLine } from "@remixicon/react";

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
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
} from "@/features/products/product-catalog-picker-dialog";
import { cn } from "@/lib/utils";

import { POPOVER_MOTION_CLASSNAME } from "./editor-config";

type CatalogOption = {
  handle?: string | null;
  id: string;
  thumbnailUrl?: string | null;
  title: string;
};

export function StorefrontCollectionPicker({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CatalogOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/admin/products/collections/actions/list?limit=100", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const collections = payload?.data?.collections ?? payload?.collections ?? [];
        if (!Array.isArray(collections)) {
          setOptions([]);
          return;
        }
        setOptions(
          collections
            .map((row: { handle?: string | null; id?: string; title?: string | null }) =>
              row?.id
                ? {
                    id: String(row.id),
                    title: String(row.title ?? row.id),
                    handle: row.handle ?? null,
                  }
                : null,
            )
            .filter(Boolean) as CatalogOption[],
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = options.find((option) => option.id === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full min-w-0 justify-between px-3 font-normal shadow-none"
          disabled={loading}
          type="button"
          variant="outline"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading
              ? "Loading collections…"
              : selected
                ? selected.title
                : "Select a collection"}
          </span>
          <RiEditLine className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(POPOVER_MOTION_CLASSNAME, "w-[min(22rem,calc(100vw-2rem))] p-0")}
        collisionPadding={16}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search collections…" />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No collections found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                value="none clear"
              >
                None
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  value={`${option.title} ${option.handle ?? ""} ${option.id}`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.title}</span>
                  {option.handle ? (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      /{option.handle}
                    </span>
                  ) : null}
                  {option.id === value ? (
                    <RiCheckLine className="ml-2 size-4 shrink-0" aria-hidden />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StorefrontProductsPicker({
  onChange,
  value,
}: {
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CatalogOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/admin/products/actions/list?limit=100", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const products = payload?.data?.products ?? payload?.data ?? payload?.products ?? [];
        if (!Array.isArray(products)) {
          setOptions([]);
          return;
        }
        setOptions(
          products
            .map(
              (row: {
                handle?: string | null;
                id?: string;
                thumbnail?: string | null;
                thumbnailUrl?: string | null;
                title?: string | null;
              }) =>
                row?.id
                  ? {
                      id: String(row.id),
                      title: String(row.title ?? row.handle ?? row.id),
                      handle: row.handle ?? null,
                      thumbnailUrl: row.thumbnailUrl ?? row.thumbnail ?? null,
                    }
                  : null,
            )
            .filter(Boolean) as CatalogOption[],
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      options.map((product) => ({
        id: product.id,
        title: product.title,
        subtitle: product.handle ? `/${product.handle}` : null,
        thumbnailUrl: product.thumbnailUrl ?? null,
        searchText: [product.title, product.handle, product.id].filter(Boolean).join(" "),
      })),
    [options],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ProductCatalogPickerTrigger
            loading={loading}
            onClick={() => setOpen(true)}
            selectedCount={value.length}
          />
        </div>
        {value.length > 0 ? (
          <Button
            className="h-9 shrink-0 px-3"
            onClick={() => onChange([])}
            type="button"
            variant="outline"
          >
            Clear
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {value.length === 0
          ? "Empty selection shows newest products on the storefront."
          : "Only these products appear in this section."}
      </p>
      <ProductCatalogPickerDialog
        allowEmptySelection
        confirmLabel="Save selection"
        description="Pick products for this section, or clear selection to show newest products on the storefront."
        items={items}
        loading={loading}
        onConfirm={onChange}
        onOpenChange={setOpen}
        open={open}
        selectedIds={value}
        selectionMode="multiple"
        selectionTarget="product"
        title="Featured products"
      />
    </div>
  );
}
