"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldDescription } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  selectedCollection,
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

  const resolvedSelected =
    selectedCollection ??
    allCollections.find((collection) => collection.id === value) ??
    undefined;

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
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between" type="button" variant="outline">
            <span className="truncate">
              {resolvedSelected
                ? getCollectionLabel(resolvedSelected, t("products.formPicker.untitledCollection"))
                : t("products.formPicker.noCollection")}
            </span>
            <AppIcons.arrowDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden p-0"
          collisionPadding={16}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command className="h-auto max-h-72 w-full min-h-0">
            <CommandInput placeholder={t("products.formPicker.searchCollections")} />
            <CommandList
              className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
            >
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                  <span className="text-sm text-muted-foreground">
                    {t("products.formPicker.noCollectionsFound")}
                  </span>
                  <button
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={openCreate}
                    type="button"
                  >
                    {t("products.formPicker.createCollection")}
                  </button>
                </div>
              </CommandEmpty>
              <CommandGroup className="overflow-visible">
                <CommandItem
                  data-checked={value === NO_COLLECTION_VALUE}
                  onSelect={() => {
                    onChange(NO_COLLECTION_VALUE);
                    setOpen(false);
                  }}
                  value={t("products.formPicker.noCollection")}
                >
                  {t("products.formPicker.noCollection")}
                </CommandItem>
                {allCollections.map((collection) => (
                  <CommandItem
                    data-checked={value === collection.id}
                    key={collection.id}
                    onSelect={() => {
                      onChange(collection.id);
                      setOpen(false);
                    }}
                    value={`${collection.title ?? ""} ${collection.handle ?? ""}`}
                  >
                    <span className="truncate">
                      {getCollectionLabel(collection, t("products.formPicker.untitledCollection"))}
                    </span>
                    {collection.handle ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {collection.handle}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t px-3 py-2">
            <button
              className="text-sm font-medium text-primary hover:underline"
              onClick={openCreate}
              type="button"
            >
              {t("products.formPicker.createCollection")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

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
  selectedCategories,
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

  const resolvedSelected = useMemo(() => {
    if (selectedCategories.length) return selectedCategories;
    return value
      .map((id) => allCategories.find((category) => category.id === id))
      .filter((category): category is MerchantProductCategory => Boolean(category));
  }, [allCategories, selectedCategories, value]);

  const createAction = getTenantScopedPath(
    dashboardRoutes.productCategoryCreateAction,
    tenantId ?? getClientTenantId(),
  );

  function toggleCategory(categoryId: string) {
    onChange(
      value.includes(categoryId)
        ? value.filter((selectedId) => selectedId !== categoryId)
        : [...value, categoryId],
    );
  }

  function openCreate() {
    setOpen(false);
    setCreateOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between" type="button" variant="outline">
            <span className="truncate">
              {resolvedSelected.length
                ? t("products.formPicker.selectedCount", { count: resolvedSelected.length })
                : t("products.formPicker.selectCategories")}
            </span>
            <AppIcons.arrowDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(30rem,calc(100vw-2rem))] overflow-hidden p-0"
          collisionPadding={16}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command className="h-auto max-h-72 w-full min-h-0">
            <CommandInput placeholder={t("products.formPicker.searchCategories")} />
            <CommandList
              className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
            >
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                  <span className="text-sm text-muted-foreground">
                    {t("products.formPicker.noCategoriesFound")}
                  </span>
                  <button
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={openCreate}
                    type="button"
                  >
                    {t("products.formPicker.createCategory")}
                  </button>
                </div>
              </CommandEmpty>
              <CommandGroup className="overflow-visible">
                {treeRows.map((node) => {
                  const category = node.category;
                  const label = getCategoryLabel(
                    category,
                    t("products.formPicker.untitledCategory"),
                  );
                  return (
                    <CommandItem
                      data-checked={value.includes(category.id) ? true : undefined}
                      key={category.id}
                      onSelect={() => toggleCategory(category.id)}
                      value={`${category.name ?? ""} ${category.handle ?? ""} ${label}`}
                    >
                      <Checkbox checked={value.includes(category.id)} tabIndex={-1} />
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ paddingLeft: `${node.depth * 0.85}rem` }}
                      >
                        {node.depth > 0 ? (
                          <span className="mr-1.5 text-muted-foreground/50">└</span>
                        ) : null}
                        {label}
                      </span>
                      {category.handle ? (
                        <span className="ml-auto max-w-[35%] truncate text-xs text-muted-foreground">
                          {category.handle}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t px-3 py-2">
            <button
              className="text-sm font-medium text-primary hover:underline"
              onClick={openCreate}
              type="button"
            >
              {t("products.formPicker.createCategory")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {resolvedSelected.length ? (
        <div className="flex flex-wrap gap-2">
          {resolvedSelected.map((category) => (
            <Badge key={category.id} variant="secondary">
              {getCategoryLabel(category, t("products.formPicker.untitledCategory"))}
            </Badge>
          ))}
        </div>
      ) : (
        <FieldDescription>{t("products.formPicker.noCategoriesSelected")}</FieldDescription>
      )}

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
