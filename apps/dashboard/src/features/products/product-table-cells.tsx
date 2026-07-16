"use client";

import type { MerchantProduct } from "@ecs/contracts";
import Link from "@/components/app/link";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import {
  getProductMediaCount,
  getProductThumbnail,
  normalizeProductStatus,
} from "@/features/products/product-table-state";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function ProductIdentityCell({
  product,
  tenantId,
}: {
  product: MerchantProduct;
  tenantId?: string | undefined;
}) {
  const { t } = useI18n();
  const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);

  return (
    <div className="flex w-64 max-w-64 items-center gap-3">
      <ProductMediaCell product={product} />
      <div className="flex min-w-0 flex-col gap-1">
        <Link className={cn(listEntityLinkClassName, "truncate")} href={href} prefetch={false}>
          {product.title ?? t("products.table.untitledProduct")}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {product.handle ? `/${product.handle}` : product.id}
        </span>
      </div>
    </div>
  );
}

export function ProductMediaCell({ product }: { product: MerchantProduct }) {
  const thumbnail = getProductThumbnail(product);

  if (thumbnail.kind === "image") {
    return (
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted/40">
        <img alt="" className="size-full object-cover" src={thumbnail.url} />
      </div>
    );
  }

  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-2xl border bg-muted/70 text-xs font-semibold text-muted-foreground ring-1 ring-border/60 dark:bg-muted/40">
      {thumbnail.initials || <AppIcons.image data-icon="inline-start" />}
    </div>
  );
}

export function ProductStatusBadge({ status }: { status: string | null }) {
  const { t } = useI18n();
  const normalized = normalizeProductStatus(status);
  const variant =
    normalized === "published" ? "default" : normalized === "draft" ? "secondary" : "outline";
  const label =
    normalized === "published"
      ? t("products.table.statusPublished")
      : normalized === "draft"
        ? t("products.table.statusDraft")
        : t("products.table.statusUnknown");

  return (
    <Badge className="rounded-full px-2.5" variant={variant}>
      {label}
    </Badge>
  );
}

export function ProductMediaSignal({ product }: { product: MerchantProduct }) {
  const { t } = useI18n();
  const count = getProductMediaCount(product);

  return (
    <span className="text-muted-foreground">
      {count
        ? count === 1
          ? t("products.table.assetOne")
          : t("products.table.assetCount", { count })
        : t("products.table.noMedia")}
    </span>
  );
}

export function formatProductDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatProductPriceRange(product: MerchantProduct) {
  const prices = product.variants
    ?.flatMap((variant) => variant.prices)
    .filter((variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode);

  if (!prices?.length) {
    return "No price";
  }

  const currencyCode = prices[0]?.currencyCode?.toUpperCase() ?? "";
  const amounts = prices
    .filter((price) => price.currencyCode?.toUpperCase() === currencyCode)
    .map((price) => price.amount)
    .filter((amount): amount is number => typeof amount === "number");
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return "No price";
  }

  return min === max ? `${currencyCode} ${min}` : `${currencyCode} ${min}-${max}`;
}
