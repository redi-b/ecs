import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductDetailProps = {
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  product: MerchantProduct;
  tenantId?: string | undefined;
};

export function ProductDetail({
  categories,
  collections,
  product,
  tenantId,
}: ProductDetailProps) {
  const images = product.images?.filter((image) => image.url) ?? [];
  const collection = collections.find((item) => item.id === product.collectionId);
  const productCategories = (product.categoryIds ?? []).map((categoryId) => ({
    category: categories.find((item) => item.id === categoryId),
    id: categoryId,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <ProductThumbnail src={product.thumbnail} title={product.title} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{product.title ?? "Untitled product"}</CardTitle>
                <ProductStatusBadge status={product.status} />
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
          <h2 className="text-sm font-medium">Description</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {product.description ?? "No description provided."}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <DetailField
            label="Collection"
            value={
              <CollectionValue
                collection={collection}
                product={product}
                tenantId={tenantId}
              />
            }
          />
          <DetailField
            label="Categories"
            value={<CategoryValue categories={productCategories} tenantId={tenantId} />}
          />
          <DetailField label="Created" value={formatDateTime(product.createdAt)} />
          <DetailField label="Updated" value={formatDateTime(product.updatedAt)} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Images</h2>
            <span className="text-sm text-muted-foreground">{images.length} images</span>
          </div>
          {images.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((image) => (
                <figure key={image.id} className="overflow-hidden rounded-lg border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={product.title ?? "Product image"}
                    className="aspect-square w-full object-cover"
                    src={image.url ?? ""}
                  />
                  <figcaption className="truncate px-3 py-2 text-xs text-muted-foreground">
                    {image.url}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No product images have been added.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function ProductThumbnail({ src, title }: { src: string | null; title: string | null }) {
  if (!src) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted text-xs font-medium text-muted-foreground">
        No image
      </div>
    );
  }

  return (
    <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={title ?? "Product thumbnail"} className="size-full object-cover" src={src} />
    </div>
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
