"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "@/components/app/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPreviewLightbox } from "@/features/media/media-lightbox";
import {
  ProductDetailsEditButton,
  ProductMediaEditButton,
  ProductOrganizationEditButton,
} from "@/features/products/product-edit-dialog";
import { useProductTaxonomy } from "@/features/products/use-product-taxonomy";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ProductDetailProps = {
  action: string;
  product: MerchantProduct;
  tenantId?: string | undefined;
};

export function ProductDetail({ action, product, tenantId }: ProductDetailProps) {
  const { t } = useI18n();
  const taxonomy = useProductTaxonomy({ tenantId });
  const categories = taxonomy.categories;
  const collections = taxonomy.collections;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = useMemo(
    () => (product.images ?? []).filter((image): image is typeof image & { url: string } => Boolean(image.url)),
    [product.images],
  );

  const lightboxItems = useMemo(
    () =>
      images.map((image, index) => ({
        altText: product.title,
        displayName: product.title
          ? `${product.title} · ${t("products.detail.productImage")} ${index + 1}`
          : `${t("products.detail.productImage")} ${index + 1}`,
        id: image.id || image.url,
        publicUrl: image.url,
        subtitle:
          product.thumbnail && product.thumbnail === image.url ? t("products.detail.coverImage") : image.url,
      })),
    [images, product.thumbnail, product.title, t],
  );

  const collection = collections.find((item) => item.id === product.collectionId);
  const productCategories = (product.categoryIds ?? []).map((categoryId) => ({
    category: categories.find((item) => item.id === categoryId),
    id: categoryId,
  }));

  function openLightboxForUrl(url: string | null | undefined) {
    if (!url || !lightboxItems.length) return;
    const index = lightboxItems.findIndex((item) => item.publicUrl === url);
    setLightboxIndex(index >= 0 ? index : 0);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <ProductThumbnail
              onOpen={() => openLightboxForUrl(product.thumbnail ?? images[0]?.url)}
              src={product.thumbnail}
              title={product.title}
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{product.title ?? t("products.detail.untitled")}</CardTitle>
                <ProductStatusBadge status={product.status} />
                <ProductDetailsEditButton action={action} product={product} />
              </div>
              <CardDescription className="break-all">
                {product.handle ? `/${product.handle}` : product.id}
              </CardDescription>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-72">
            <DetailMetric label={t("products.detail.variants")} value={`${product.variants?.length ?? 0}`} />
            <DetailMetric label={t("products.detail.firstPrice")} value={formatFirstPrice(product, t)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <SectionHeader
            action={<ProductDetailsEditButton action={action} product={product} />}
            title={t("products.detail.description")}
          />
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {product.description ?? t("products.detail.noDescription")}
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeader
            action={
              <ProductOrganizationEditButton
                action={action}
                categories={categories}
                collections={collections}
                product={product}
              />
            }
            title={t("products.detail.organization")}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField
              label={t("products.detail.collection")}
              value={
                <CollectionValue collection={collection} product={product} tenantId={tenantId} />
              }
            />
            <DetailField
              label={t("products.detail.categories")}
              value={<CategoryValue categories={productCategories} tenantId={tenantId} />}
            />
            <DetailField label={t("products.detail.created")} value={formatDateTime(product.createdAt, t)} />
            <DetailField label={t("products.detail.updated")} value={formatDateTime(product.updatedAt, t)} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            action={<ProductMediaEditButton action={action} product={product} />}
            meta={t("products.detail.imagesCount", { count: images.length })}
            title={t("products.detail.images")}
          />
          {images.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((image, index) => {
                const isCover = Boolean(product.thumbnail && product.thumbnail === image.url);
                return (
                  <figure
                    className="group overflow-hidden rounded-lg border bg-muted/30"
                    key={image.id || image.url}
                  >
                    <button
                      aria-label={t("products.detail.openImagePreview", { n: index + 1 })}
                      className="relative block w-full cursor-zoom-in bg-muted text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setLightboxIndex(index)}
                      type="button"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={product.title ?? t("products.detail.productImage")}
                        className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                        src={image.url}
                      />
                      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      {isCover ? (
                        <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                          {t("products.detail.cover")}
                        </span>
                      ) : null}
                      <span className="absolute right-2 bottom-2 rounded-full border border-white/20 bg-black/45 p-1.5 text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                        <AppIcons.expand className="size-3.5" />
                      </span>
                    </button>
                    <figcaption className="truncate px-3 py-2 text-xs text-muted-foreground">
                      {image.url}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              {t("products.detail.noImagesYet")}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">{t("products.detail.optionsTitle")}</h2>
            <span className="text-sm text-muted-foreground">
              {t("products.detail.variantsCount", { count: product.variants?.length ?? 0 })}
            </span>
          </div>
          <ProductOptionsSummary product={product} />
        </section>
      </CardContent>

      <MediaPreviewLightbox
        index={lightboxIndex}
        items={lightboxItems}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </Card>
  );
}

function ProductOptionsSummary({ product }: { product: MerchantProduct }) {
  const { t } = useI18n();
  const variants = product.variants ?? [];
  const options = getProductOptionGroups(product);

  if (!variants.length) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        {t("products.detail.noVariantsYet")}
      </p>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <div className="font-medium">{t("products.detail.simpleProduct")}</div>
        <div className="mt-1 text-muted-foreground">
          {t("products.detail.simpleProductHelp")}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => (
        <div className="rounded-lg border bg-muted/20 px-4 py-3" key={option.title}>
          <div className="text-sm font-medium">{option.title}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {option.values.map((value) => (
              <Badge className="rounded-md" key={value} variant="secondary">
                {value}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  action,
  meta,
  title,
}: {
  action?: ReactNode;
  meta?: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

function getProductOptionGroups(product: MerchantProduct) {
  const optionGroups = new Map<string, Set<string>>();

  for (const variant of product.variants ?? []) {
    for (const option of variant.optionValues ?? []) {
      if (!option.optionTitle || !option.value || option.optionTitle === "Default") {
        continue;
      }

      const values = optionGroups.get(option.optionTitle) ?? new Set<string>();
      values.add(option.value);
      optionGroups.set(option.optionTitle, values);
    }
  }

  return Array.from(optionGroups, ([title, values]) => ({
    title,
    values: Array.from(values),
  }));
}

function ProductThumbnail({
  onOpen,
  src,
  title,
}: {
  onOpen?: () => void;
  src: string | null;
  title: string | null;
}) {
  const { t } = useI18n();
  if (!src) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted text-xs font-medium text-muted-foreground">
        {t("products.detail.noImage")}
      </div>
    );
  }

  if (!onOpen) {
    return (
      <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={title ?? t("products.detail.productImage")} className="size-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <button
      aria-label={t("products.detail.openCoverPreview")}
      className={cn(
        "group relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted",
        "cursor-zoom-in outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onOpen}
      type="button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={title ?? t("products.detail.productImage")}
        className="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
        src={src}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all duration-200 group-hover:bg-black/25 group-hover:opacity-100">
        <AppIcons.expand className="size-4 drop-shadow" />
      </span>
    </button>
  );
}

function ProductStatusBadge({ status }: { status: string | null }) {
  const { t } = useI18n();
  const normalized = status?.toLowerCase() ?? "unknown";
  const variant =
    normalized === "published" ? "default" : normalized === "draft" ? "secondary" : "outline";
  const label =
    normalized === "published"
      ? t("products.detail.statusPublished")
      : normalized === "draft"
        ? t("products.detail.statusDraft")
        : t("products.detail.statusUnknown");

  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{value}</div>
    </div>
  );
}

function CollectionValue({
  collection,
  product,
  tenantId,
}: {
  collection: MerchantProductCollection | undefined;
  product: MerchantProduct;
  tenantId?: string | undefined;
}) {
  const { t } = useI18n();
  if (!product.collectionId) {
    return <span className="text-muted-foreground">{t("products.filter.collection.none")}</span>;
  }

  return (
    <TaxonomyLink href={getTenantScopedPath(dashboardRoutes.productCollections, tenantId)}>
      {collection ? getCollectionLabel(collection) : product.collectionId}
    </TaxonomyLink>
  );
}

function CategoryValue({
  categories,
  tenantId,
}: {
  categories: Array<{ category: MerchantProductCategory | undefined; id: string }>;
  tenantId?: string | undefined;
}) {
  if (!categories.length) {
    const { t } = useI18n();
    return <span className="text-muted-foreground">{t("products.filter.category.none")}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(({ category, id }) => (
        <TaxonomyLink
          href={getTenantScopedPath(dashboardRoutes.productCategories, tenantId)}
          key={id}
        >
          {category ? getCategoryLabel(category) : id}
        </TaxonomyLink>
      ))}
    </div>
  );
}

function TaxonomyLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      href={href}
    >
      {children}
    </Link>
  );
}

function getCollectionLabel(collection: MerchantProductCollection) {
  return collection.title ?? collection.handle ?? collection.id;
}

function getCategoryLabel(category: MerchantProductCategory) {
  return category.name ?? category.handle ?? category.id;
}

function formatFirstPrice(product: MerchantProduct, t: (key: any) => string) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode);

  if (!price || typeof price.amount !== "number" || !price.currencyCode) {
    return t("products.detail.noPrice");
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}

function formatDateTime(value: string | null, t: (key: any) => string) {
  if (!value) {
    return t("products.detail.never");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("products.detail.unknown");
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function getDeletionErrorMessage(
  error: unknown,
  t: (key: import("@/i18n/messages").MessageKey) => string,
) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "commerce_backend_unavailable") {
    return t("products.detail.catalogUnavailable");
  }
  if (code === "commerce_credentials_missing" || code === "commerce_credentials_invalid") {
    return t("products.detail.catalogContactSupport");
  }
  if (
    code === "product_not_found" ||
    code === "category_not_found" ||
    code === "collection_not_found"
  ) {
    return t("products.detail.notFound");
  }
  return t("products.detail.deleteFailed");
}

export function ProductDeleteButton({
  productId,
  productTitle,
  tenantId,
}: {
  productId: string;
  productTitle: string;
  tenantId?: string | undefined;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const url = getTenantScopedPath(dashboardRoutes.productDeleteAction(productId), tenantId);
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "delete_failed");
      }
      return productId;
    },
    onSuccess: () => {
      toast.success(t("products.detail.toastDeleted"));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowConfirm(false);
      router.push(getTenantScopedPath(dashboardRoutes.products, tenantId));
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, t));
    },
  });

  return (
    <>
      <Button variant="destructive" onClick={() => setShowConfirm(true)} type="button">
        {t("products.table.deleteProduct")}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.table.deleteProduct")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.detail.deleteDesc", { title: productTitle })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? t("common.deleting") : t("products.detail.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
