"use client";

import { useEffect, useMemo, useState } from "react";

import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
} from "@/features/products/product-catalog-picker-dialog";

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

  const comboboxOptions = useMemo(
    () => [
      {
        value: "__none__",
        label: "None",
        keywords: "none clear empty",
      },
      ...options.map((option) => ({
        value: option.id,
        label: option.title,
        keywords: `${option.handle ?? ""} ${option.id}`,
        ...(option.handle ? { description: `/${option.handle}` } : {}),
      })),
    ],
    [options],
  );

  return (
    <SearchableCombobox
      className="h-9"
      disabled={loading}
      emptyLabel="No collections found."
      noneLabel="None"
      onChange={(next) => onChange(next === "__none__" ? "" : next)}
      options={comboboxOptions}
      placeholder={loading ? "Loading collections…" : "Select a collection"}
      renderItem={(item) =>
        item.description ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.description}</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        )
      }
      searchPlaceholder="Search collections…"
      value={value || "__none__"}
    />
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
