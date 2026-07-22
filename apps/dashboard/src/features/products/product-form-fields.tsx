"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import {
  MultiSearchableCombobox,
  SearchableCombobox,
  type SearchableComboboxOption,
} from "@/components/app/searchable-combobox";
import { FieldDescription } from "@/components/ui/field";
import { TaxonomyCreateDialog } from "@/features/catalog-taxonomy/taxonomy-create-dialog";
import {
  buildCategoryTree,
  flattenCategoryTree,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const NO_COLLECTION_VALUE = "__none";

export function ComposerSection({ description, title }: { description: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function StepDot({ status }: { status: "active" | "complete" | "idle" }) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-colors",
        status === "active" || status === "complete"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
      )}
    >
      {status === "active" || status === "complete" ? (
        <AppIcons.check data-icon="inline-start" />
      ) : null}
    </span>
  );
}

export function CollectionPicker({
  collections,
  onChange,
  selectedCollection: _selectedCollection,
  tenantId,
  value,
}: {
  collections: MerchantProductCollection[];
  onChange: (value: string) => void;
  selectedCollection: MerchantProductCollection | undefined;
  tenantId?: string | undefined;
  value: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCollections, setCreatedCollections] = useState<MerchantProductCollection[]>([]);

  const allCollections = useMemo(() => {
    const byId = new Map<string, MerchantProductCollection>();
    for (const collection of collections) byId.set(collection.id, collection);
    for (const collection of createdCollections) byId.set(collection.id, collection);
    return [...byId.values()];
  }, [collections, createdCollections]);

  const options = useMemo<SearchableComboboxOption[]>(() => {
    const untitled = t("products.formPicker.untitledCollection");
    return [
      {
        value: NO_COLLECTION_VALUE,
        label: t("products.formPicker.noCollection"),
        keywords: "none clear empty",
      },
      ...allCollections.map((collection) => {
        const label = getCollectionLabel(collection, untitled);
        return {
          value: collection.id,
          label,
          keywords: `${collection.handle ?? ""} ${collection.id}`,
          ...(collection.handle ? { description: `/${collection.handle}` } : {}),
        };
      }),
    ];
  }, [allCollections, t]);

  const createAction = getTenantScopedPath(
    dashboardRoutes.productCollectionCreateAction,
    tenantId ?? getClientTenantId(),
  );

  function openCreate() {
    setOpen(false);
    setCreateOpen(true);
  }

  return (
    <>
      <SearchableCombobox
        emptyLabel={t("products.formPicker.noCollectionsFound")}
        onChange={onChange}
        onOpenChange={setOpen}
        open={open}
        options={options}
        panelFooter={
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={openCreate}
            type="button"
          >
            {t("products.formPicker.createCollection")}
          </button>
        }
        placeholder={t("products.formPicker.noCollection")}
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
        searchPlaceholder={t("products.formPicker.searchCollections")}
        value={value || NO_COLLECTION_VALUE}
      />

      <TaxonomyCreateDialog
        action={createAction}
        entityLabel="collection"
        nameKey="title"
        nameLabel={t("taxonomy.create.titleLabel")}
        namePlaceholder={t("taxonomy.create.titlePlaceholder")}
        onCreated={(payload) => {
          if (!payload.collection) return;
          setCreatedCollections((current) => mergeById(current, payload.collection!));
          onChange(payload.collection.id);
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        queryKey="product-collections"
        showTrigger={false}
      />
    </>
  );
}

export function CategoryPicker({
  categories,
  onChange,
  selectedCategories: _selectedCategories,
  tenantId,
  value,
}: {
  categories: MerchantProductCategory[];
  onChange: (value: string[]) => void;
  selectedCategories: MerchantProductCategory[];
  tenantId?: string | undefined;
  value: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCategories, setCreatedCategories] = useState<MerchantProductCategory[]>([]);

  const allCategories = useMemo(() => {
    const byId = new Map<string, MerchantProductCategory>();
    for (const category of categories) byId.set(category.id, category);
    for (const category of createdCategories) byId.set(category.id, category);
    return [...byId.values()];
  }, [categories, createdCategories]);

  const treeRows = useMemo(
    () => flattenCategoryTree(buildCategoryTree(allCategories)),
    [allCategories],
  );

  const options = useMemo<SearchableComboboxOption[]>(() => {
    const untitled = t("products.formPicker.untitledCategory");
    return treeRows.map((node) => {
      const category = node.category;
      const label = getCategoryLabel(category, untitled);
      return {
        value: category.id,
        label,
        keywords: `${category.name ?? ""} ${category.handle ?? ""} ${category.id}`,
        ...(category.handle ? { description: `/${category.handle}` } : {}),
      };
    });
  }, [t, treeRows]);

  const depthById = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of treeRows) map.set(node.category.id, node.depth);
    return map;
  }, [treeRows]);

  const createAction = getTenantScopedPath(
    dashboardRoutes.productCategoryCreateAction,
    tenantId ?? getClientTenantId(),
  );

  function openCreate() {
    setOpen(false);
    setCreateOpen(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <MultiSearchableCombobox
        emptyLabel={t("products.formPicker.noCategoriesFound")}
        onChange={onChange}
        onOpenChange={setOpen}
        open={open}
        options={options}
        panelFooter={
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={openCreate}
            type="button"
          >
            {t("products.formPicker.createCategory")}
          </button>
        }
        placeholder={t("products.formPicker.selectCategories")}
        removeLabel={(label) => t("products.formPicker.removeCategory", { value: label })}
        renderItem={(item) => {
          const depth = depthById.get(item.value) ?? 0;
          return (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="min-w-0 flex-1 truncate"
                style={{ paddingLeft: `${depth * 0.85}rem` }}
              >
                {depth > 0 ? (
                  <span className="mr-1.5 text-muted-foreground/50">└</span>
                ) : null}
                {item.label}
              </span>
              {item.description ? (
                <span className="max-w-[35%] shrink-0 truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
          );
        }}
        searchPlaceholder={t("products.formPicker.searchCategories")}
        selectedCountLabel={(count) => t("products.formPicker.selectedCount", { count })}
        values={value}
      />

      {value.length === 0 ? (
        <FieldDescription>{t("products.formPicker.noCategoriesSelected")}</FieldDescription>
      ) : null}

      <TaxonomyCreateDialog
        action={createAction}
        entityLabel="category"
        nameKey="name"
        nameLabel={t("taxonomy.create.nameLabel")}
        namePlaceholder={t("taxonomy.create.namePlaceholder")}
        onCreated={(payload) => {
          if (!payload.category) return;
          setCreatedCategories((current) => mergeById(current, payload.category!));
          if (!value.includes(payload.category.id)) {
            onChange([...value, payload.category.id]);
          }
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        parentOptions={allCategories}
        queryKey="product-categories"
        showTrigger={false}
      />
    </div>
  );
}

export function FieldError({ errors, touched }: { errors: unknown[]; touched: boolean }) {
  const message = errors.find((error): error is string => typeof error === "string");

  if (!message || !touched) {
    return null;
  }

  return <FieldDescription className="text-destructive">{message}</FieldDescription>;
}

export function hasFieldError(field: {
  state: { meta: { errors: unknown[]; isTouched: boolean } };
}) {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function getCollectionLabel(
  collection: MerchantProductCollection,
  untitledFallback: string,
) {
  return collection.title ?? collection.handle ?? untitledFallback;
}

function getCategoryLabel(category: MerchantProductCategory, untitledFallback: string) {
  return category.name ?? category.handle ?? untitledFallback;
}

function mergeById<T extends { id: string }>(items: T[], next: T) {
  if (items.some((item) => item.id === next.id)) {
    return items.map((item) => (item.id === next.id ? next : item));
  }
  return [...items, next];
}

function getClientTenantId() {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("tenantId") ?? undefined;
}
