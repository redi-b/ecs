"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { RiTranslate2 } from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { CatalogTranslatedName } from "@/components/app/catalog-translated-name";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { type ResourceRowActions, RowActionsMenu } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatProductDate,
  formatProductPriceRange,
  ProductIdentityCell,
  ProductMediaSignal,
  ProductStatusBadge,
} from "@/features/products/product-table-cells";
import {
  getProductMediaCount,
  getProductPriceSortValue,
  normalizeProductStatus,
  type ProductStatusFilter,
} from "@/features/products/product-table-state";
import type { MessageKey } from "@/i18n/messages";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export function getProductStatusFilterOptions(t: Translate): Array<{
  label: string;
  value: ProductStatusFilter;
}> {
  return [
    { label: t("products.filter.status.all"), value: "all" },
    { label: t("products.filter.status.published"), value: "published" },
    { label: t("products.filter.status.draft"), value: "draft" },
    { label: t("products.filter.status.unknown"), value: "unknown" },
  ];
}

/** @deprecated Use getProductStatusFilterOptions(t) — kept for any external imports. */
export const productStatusFilterOptions: Array<{
  label: string;
  value: ProductStatusFilter;
}> = [
  { label: "All statuses", value: "all" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Unknown", value: "unknown" },
];

export type ProductStatusValue = "draft" | "published";

export function getProductRowActions(
  product: MerchantProduct,
  tenantId: string | null | undefined,
  onDelete: ((productId: string) => void) | undefined,
  onStatusChange: (productIds: string[], status: ProductStatusValue) => void,
  t: Translate,
  onSetInventory?: (product: MerchantProduct) => void,
  onTranslate?: (product: MerchantProduct) => void,
  onEditMedia?: (product: MerchantProduct) => void,
): ResourceRowActions {
  const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);
  const normalizedStatus = normalizeProductStatus(product.status);
  const nextStatus = normalizedStatus === "published" ? "draft" : "published";

  return {
    actions: [
      { href, icon: AppIcons.eye, label: t("products.table.viewDetails"), type: "link" },
      ...(onTranslate
        ? [
            {
              icon: RiTranslate2,
              label: t("products.translation.action"),
              onSelect: () => onTranslate(product),
              type: "button" as const,
            },
          ]
        : []),
      ...(onEditMedia
        ? [
            {
              icon: AppIcons.image,
              label: t("products.edit.mediaTrigger"),
              onSelect: () => onEditMedia(product),
              type: "button" as const,
            },
          ]
        : []),
      ...(onSetInventory
        ? [
            {
              icon: AppIcons.products,
              label: t("products.stock.bulkAction"),
              type: "button" as const,
              onSelect: () => onSetInventory(product),
            },
          ]
        : []),
      {
        icon: nextStatus === "published" ? AppIcons.check : AppIcons.eyeOff,
        label:
          nextStatus === "published"
            ? t("products.table.publishProduct")
            : t("products.table.moveToDraft"),
        onSelect: () => onStatusChange([product.id], nextStatus),
        type: "button",
      },
      { id: "identity", type: "separator" },
      {
        icon: AppIcons.copy,
        label: t("products.table.copyProductId"),
        onSelect: () => void copyToClipboard(product.id, t("products.table.productId"), t),
        type: "button",
      },
      {
        disabled: !product.handle,
        icon: AppIcons.copy,
        label: t("products.table.copyHandle"),
        onSelect: () => void copyToClipboard(product.handle ?? "", t("products.table.handle"), t),
        type: "button",
      },
      {
        disabled: !product.handle,
        icon: AppIcons.externalLink,
        label: t("products.table.copyPath"),
        onSelect: () =>
          void copyToClipboard(
            product.handle ? `/products/${product.handle}` : "",
            t("products.table.productPath"),
            t,
          ),
        type: "button",
      },
      ...(onDelete
        ? [
            { id: "danger", type: "separator" as const },
            {
              icon: AppIcons.trash,
              label: t("products.table.deleteProduct"),
              onSelect: () => onDelete(product.id),
              type: "button" as const,
              variant: "destructive" as const,
            },
          ]
        : []),
    ],
    label: t("products.table.actionsFor", {
      name: product.title || t("products.table.unnamed"),
    }),
  };
}

async function copyToClipboard(value: string, label: string, t: Translate) {
  try {
    const copied = await copyTextToClipboard(value);

    if (!copied) {
      toast.error(t("table.actions.copyEmpty"));
      return;
    }

    toast.success(t("table.actions.copySuccess", { label }));
  } catch {
    toast.error(t("table.actions.copyFailed"));
  }
}

export function setUrlFilter(url: URL, key: string, value: string, defaultValue: string) {
  if (value !== defaultValue) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
}

export function getProductColumns(
  tenantId: string | null | undefined,
  categories: MerchantProductCategory[],
  collections: MerchantProductCollection[],
  onDelete: ((productId: string) => void) | undefined,
  onStatusChange: (productIds: string[], status: ProductStatusValue) => void,
  t: Translate,
  productDetailHref?: (product: MerchantProduct) => string,
  onSetInventory?: (product: MerchantProduct) => void,
  isLoading?: boolean,
  onTranslate?: (product: MerchantProduct) => void,
  onEditMedia?: (product: MerchantProduct) => void,
): ColumnDef<MerchantProduct>[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label={t("products.table.selectAllAria")}
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={t("table.actions.selectRow", {
            name: row.original.title ?? row.original.id,
          })}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("products.table.product")} />
      ),
      cell: ({ row }) => (
        <ProductIdentityCell
          {...(productDetailHref ? { href: productDetailHref(row.original) } : {})}
          product={row.original}
          tenantId={tenantId ?? undefined}
        />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("products.filter.status.label")} />
      ),
      cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
    },
    {
      id: "price",
      accessorFn: (product) => getProductPriceSortValue(product),
      header: ({ column }) => <DataTableHeader column={column} title={t("products.table.price")} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatProductPriceRange(row.original, t("products.detail.noPrice"))}
        </span>
      ),
    },
    {
      id: "variants",
      accessorFn: (product) => product.variants?.length ?? 0,
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("products.detail.variants")} />
      ),
      cell: ({ row }) => {
        const variantCount = row.original.variants?.length ?? 0;

        return (
          <span className="text-muted-foreground tabular-nums">
            {variantCount === 1
              ? t("products.table.variantCountOne")
              : t("products.table.variantCount", { count: variantCount })}
          </span>
        );
      },
    },
    {
      id: "stock",
      accessorFn: (product) => getProductStockSortValue(product),
      header: ({ column }) => <DataTableHeader column={column} title={t("products.stock.title")} />,
      cell: ({ row }) => <ProductStockSummary product={row.original} t={t} />,
    },
    {
      id: "organization",
      accessorFn: (product) =>
        [
          product.collectionId
            ? (collectionById.get(product.collectionId)?.title ?? product.collectionId)
            : "",
          ...(product.categoryIds ?? []).map((id) => categoryById.get(id)?.name ?? id),
        ].join(" "),
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("products.table.organization")} />
      ),
      cell: ({ row }) => (
        <ProductOrganizationSummary
          categoryById={categoryById}
          collectionById={collectionById}
          isLoading={isLoading}
          product={row.original}
          t={t}
        />
      ),
    },
    {
      id: "media",
      accessorFn: (product) => getProductMediaCount(product),
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("products.filter.media.label")} />
      ),
      cell: ({ row }) => <ProductMediaSignal product={row.original} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("taxonomy.table.updated")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatProductDate(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const rowActions = getProductRowActions(
          row.original,
          tenantId,
          onDelete,
          onStatusChange,
          t,
          onSetInventory,
          onTranslate,
          onEditMedia,
        );

        return <RowActionsMenu {...rowActions} />;
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function ProductStockSummary({ product, t }: { product: MerchantProduct; t?: Translate }) {
  const variants = product.variants ?? [];
  const stocks = variants.map((variant) => variant.stock).filter(isProductStock);

  if (!stocks.length) {
    return <Badge variant="outline">{t ? t("products.table.notTracked") : "Not tracked"}</Badge>;
  }

  const available = stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );

  return (
    <Badge className="tabular-nums" variant={available > 0 ? "success" : "warning"}>
      {available > 0
        ? t
          ? t("products.table.availableCount", { count: available })
          : `${available} available`
        : t
          ? t("products.table.outOfStock")
          : "Out of stock"}
    </Badge>
  );
}

export function ProductOrganizationSummary({
  categoryById,
  collectionById,
  product,
  t,
  isLoading = false,
}: {
  categoryById: Map<string, MerchantProductCategory>;
  collectionById: Map<string, MerchantProductCollection>;
  product: MerchantProduct;
  t: Translate;
  isLoading?: boolean | undefined;
}) {
  const collection = product.collectionId ? collectionById.get(product.collectionId) : undefined;
  const categoryIds = product.categoryIds ?? [];
  const categoryCount = categoryIds.length;
  const firstCategory = categoryIds[0] ? categoryById.get(categoryIds[0]) : undefined;

  if (isLoading && (product.collectionId || categoryCount > 0)) {
    return (
      <div className="flex min-w-36 flex-col gap-2">
        {product.collectionId ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <AppIcons.folder className="size-4 opacity-40" />
            <Skeleton className="h-3.5 w-20 rounded" />
          </span>
        ) : null}
        {categoryCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <AppIcons.tag className="size-4 opacity-40" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </span>
        ) : null}
      </div>
    );
  }

  if (!product.collectionId && !categoryCount) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <AppIcons.folder className="size-4" />
            <AppIcons.tag className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("products.table.noCollectionOrCategories")}</TooltipContent>
      </Tooltip>
    );
  }

  const firstCategoryUntitled =
    firstCategory?.name ?? firstCategory?.handle ?? t("products.table.unknownCategory");

  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <OrganizationSignal
        icon={<AppIcons.folder className="size-4" />}
        tooltip={t("products.table.collection")}
        value={
          collection ? (
            <CatalogTranslatedName
              preview="name"
              source={collection.title}
              translation={collection.translation}
              untitled={
                collection.title ?? collection.handle ?? t("products.table.unknownCollection")
              }
            />
          ) : product.collectionId ? (
            t("products.table.unknownCollection")
          ) : (
            t("products.table.noCollection")
          )
        }
      />
      <OrganizationSignal
        icon={<AppIcons.tag className="size-4" />}
        tooltip={t("products.table.categories")}
        value={
          firstCategory ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <CatalogTranslatedName
                preview="name"
                source={firstCategory.name}
                translation={firstCategory.translation}
                untitled={firstCategoryUntitled}
              />
              {categoryCount > 1 ? (
                <span className="shrink-0 text-muted-foreground">+{categoryCount - 1}</span>
              ) : null}
            </span>
          ) : (
            t("products.table.noCategories")
          )
        }
      />
    </div>
  );
}

export function OrganizationSignal({
  icon,
  tooltip,
  value,
}: {
  icon: ReactNode;
  tooltip: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 text-muted-foreground">{icon}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

export function getProductStockSortValue(product: MerchantProduct) {
  const stocks = (product.variants ?? []).map((variant) => variant.stock).filter(isProductStock);

  if (!stocks.length) {
    return -1;
  }

  return stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );
}

export function isProductStock(
  stock: NonNullable<MerchantProduct["variants"]>[number]["stock"] | null | undefined,
): stock is NonNullable<NonNullable<MerchantProduct["variants"]>[number]["stock"]> {
  return Boolean(stock);
}

export function getDeletionErrorMessage(error: unknown, resourceName: string) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "commerce_backend_unavailable") {
    return "Catalog changes are temporarily unavailable. Try again.";
  }
  if (code === "commerce_credentials_missing" || code === "commerce_credentials_invalid") {
    return "Catalog changes are temporarily unavailable. Contact support.";
  }
  if (
    code === "product_not_found" ||
    code === "category_not_found" ||
    code === "collection_not_found"
  ) {
    return `${resourceName} not found.`;
  }
  return `Failed to delete ${resourceName.toLowerCase()}. Try again.`;
}

export function getStatusLoadingMessage(count: number, status: ProductStatusValue, t?: Translate) {
  if (t) {
    return status === "published"
      ? t("products.table.publishing", { count })
      : t("products.table.movingToDraft", { count });
  }
  const productLabel = count === 1 ? "product" : "products";
  return status === "published"
    ? `Publishing ${count} ${productLabel}...`
    : `Moving ${count} ${productLabel} to draft...`;
}

export function getStatusSuccessMessage(count: number, status: ProductStatusValue, t?: Translate) {
  if (t) {
    return status === "published"
      ? t("products.table.published", { count })
      : t("products.table.movedToDraft", { count });
  }
  const productLabel = count === 1 ? "product" : "products";
  return status === "published"
    ? `${count} ${productLabel} published.`
    : `${count} ${productLabel} moved to draft.`;
}
