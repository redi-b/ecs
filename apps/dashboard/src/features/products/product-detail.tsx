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
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type ProductDetailProps = {
  action: string;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  product: MerchantProduct;
  tenantId?: string | undefined;
};

export function ProductDetail({
  action,
  categories,
  collections,
  product,
  tenantId,
}: ProductDetailProps) {
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
          ? `${product.title} · image ${index + 1}`
          : `Product image ${index + 1}`,
        id: image.id || image.url,
        publicUrl: image.url,
        subtitle:
          product.thumbnail && product.thumbnail === image.url ? "Cover image" : image.url,
      })),
    [images, product.thumbnail, product.title],
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
                <CardTitle>{product.title ?? "Untitled product"}</CardTitle>
                <ProductStatusBadge status={product.status} />
                <ProductDetailsEditButton action={action} product={product} />
              </div>
              <CardDescription className="break-all">
                {product.handle ? `/${product.handle}` : product.id}
              </CardDescription>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-72">
            <DetailMetric label="Variants" value={`${product.variants?.length ?? 0}`} />
            <DetailMetric label="First price" value={formatFirstPrice(product)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <SectionHeader
            action={<ProductDetailsEditButton action={action} product={product} />}
            title="Description"
          />
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {product.description ?? "No description provided."}
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
            title="Organization"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField
              label="Collection"
              value={
                <CollectionValue collection={collection} product={product} tenantId={tenantId} />
              }
            />
            <DetailField
              label="Categories"
              value={<CategoryValue categories={productCategories} tenantId={tenantId} />}
            />
            <DetailField label="Created" value={formatDateTime(product.createdAt)} />
            <DetailField label="Updated" value={formatDateTime(product.updatedAt)} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            action={<ProductMediaEditButton action={action} product={product} />}
            meta={`${images.length} images`}
            title="Images"
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
                      aria-label={`Open image ${index + 1} preview`}
                      className="relative block w-full cursor-zoom-in bg-muted text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setLightboxIndex(index)}
                      type="button"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={product.title ?? "Product image"}
                        className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                        src={image.url}
                      />
                      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      {isCover ? (
                        <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                          Cover
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
              No product images have been added.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Product options</h2>
            <span className="text-sm text-muted-foreground">
              {product.variants?.length ?? 0} variants
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
  const variants = product.variants ?? [];
  const options = getProductOptionGroups(product);

  if (!variants.length) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        This product does not have sellable variants yet.
      </p>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <div className="font-medium">Simple product</div>
        <div className="mt-1 text-muted-foreground">
          One sellable product row is managed in the stock section.
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
  if (!src) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted text-xs font-medium text-muted-foreground">
        No image
      </div>
    );
  }

  if (!onOpen) {
    return (
      <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={title ?? "Product thumbnail"} className="size-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <button
      aria-label="Open cover image preview"
      className={cn(
        "group relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted",
        "cursor-zoom-in outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onOpen}
      type="button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={title ?? "Product thumbnail"}
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
  const normalized = status?.toLowerCase() ?? "unknown";
  const variant =
    normalized === "published" ? "default" : normalized === "draft" ? "secondary" : "outline";

  return (
    <Badge className="capitalize" variant={variant}>
      {normalized.replaceAll("_", " ")}
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
  if (!product.collectionId) {
    return <span className="text-muted-foreground">No collection</span>;
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
    return <span className="text-muted-foreground">No categories</span>;
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

function formatFirstPrice(product: MerchantProduct) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode);

  if (!price || typeof price.amount !== "number" || !price.currencyCode) {
    return "No price";
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function getDeletionErrorMessage(error: unknown, resourceName: string) {
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

export function ProductDeleteButton({
  productId,
  productTitle,
  tenantId,
}: {
  productId: string;
  productTitle: string;
  tenantId?: string | undefined;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const url = getTenantScopedPath(dashboardRoutes.productDeleteAction(productId), tenantId);
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product.");
      }
      return productId;
    },
    onSuccess: () => {
      toast.success("Product deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowConfirm(false);
      router.push(getTenantScopedPath(dashboardRoutes.products, tenantId));
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product"));
    },
  });

  return (
    <>
      <Button variant="destructive" onClick={() => setShowConfirm(true)} type="button">
        Delete product
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{productTitle}&rdquo;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
