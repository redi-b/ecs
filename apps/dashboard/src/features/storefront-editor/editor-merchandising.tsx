"use client";

import { useEffect, useMemo, useState } from "react";

import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
} from "@/features/products/product-catalog-picker-dialog";
import { useI18n } from "@/i18n/provider";

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
  const { t } = useI18n();
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
        label: t("editor.merchandising.none"),
        keywords: t("editor.merchandising.noneKeywords"),
      },
      ...options.map((option) => ({
        value: option.id,
        label: option.title,
        keywords: `${option.handle ?? ""} ${option.id}`,
        ...(option.handle ? { description: `/${option.handle}` } : {}),
      })),
    ],
    [options, t],
  );

  return (
    <SearchableCombobox
      className="h-9"
      disabled={loading}
      emptyLabel={t("editor.merchandising.noCollections")}
      noneLabel={t("editor.merchandising.none")}
      onChange={(next) => onChange(next === "__none__" ? "" : next)}
      options={comboboxOptions}
      placeholder={
        loading
          ? t("editor.merchandising.loadingCollections")
          : t("editor.merchandising.selectCollection")
      }
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
      searchPlaceholder={t("editor.merchandising.searchCollections")}
      triggerIcon="edit"
      value={value || "__none__"}
    />
  );
}

export function StorefrontProductsPicker({
  maxSelection,
  onChange,
  value,
}: {
  maxSelection?: number | undefined;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const { t } = useI18n();
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
            {t("editor.merchandising.clear")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {value.length === 0
          ? t("editor.merchandising.emptySelectionHint")
          : t("editor.merchandising.manualSelectionHint")}
      </p>
      <ProductCatalogPickerDialog
        allowEmptySelection
        confirmLabel={t("editor.merchandising.saveSelection")}
        description={t("editor.merchandising.featuredProductsDescription")}
        items={items}
        loading={loading}
        {...(maxSelection === undefined ? {} : { maxSelection })}
        onConfirm={onChange}
        onOpenChange={setOpen}
        open={open}
        selectedIds={value}
        selectionMode="multiple"
        selectionTarget="product"
        title={t("editor.merchandising.featuredProductsTitle")}
      />
    </div>
  );
}

export function StorefrontCollectionsPicker({
  maxSelection,
  onChange,
  value,
}: {
  maxSelection?: number | undefined;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CatalogOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/admin/products/collections/actions/list?limit=100", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const collections = payload?.data?.collections ?? payload?.collections ?? [];
        setOptions(
          Array.isArray(collections)
            ? collections
                .map((row: { handle?: string | null; id?: string; mediaUrl?: string | null; title?: string | null }) =>
                  row?.id
                    ? {
                        id: String(row.id),
                        title: String(row.title ?? row.id),
                        handle: row.handle ?? null,
                        thumbnailUrl: row.mediaUrl ?? null,
                      }
                    : null,
                )
                .filter(Boolean) as CatalogOption[]
            : [],
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
      options.map((collection) => ({
        id: collection.id,
        title: collection.title,
        subtitle: collection.handle ? `/${collection.handle}` : null,
        thumbnailUrl: collection.thumbnailUrl ?? null,
        searchText: [collection.title, collection.handle, collection.id].filter(Boolean).join(" "),
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
          <Button className="h-9 shrink-0 px-3" onClick={() => onChange([])} type="button" variant="outline">
            {t("editor.merchandising.clear")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {value.length === 0
          ? "Catalog collections are shown until you choose specific ones."
          : `${value.length} collection${value.length === 1 ? "" : "s"} selected.`}
      </p>
      <ProductCatalogPickerDialog
        allowEmptySelection
        confirmLabel="Save collections"
        description="Choose the collections customers can open from this section."
        emptyDescription="Create a collection first, then return here to feature it."
        emptyTitle="No collections found"
        items={items}
        loading={loading}
        {...(maxSelection === undefined ? {} : { maxSelection })}
        onConfirm={onChange}
        onOpenChange={setOpen}
        open={open}
        searchPlaceholder="Search collections"
        selectedIds={value}
        selectionMode="multiple"
        showCreateProductLink={false}
        title="Choose collections"
      />
    </div>
  );
}
