import type { MerchantProduct } from "@ecs/contracts";

export type ProductStatusFilter = "all" | "published" | "draft" | "unknown";
export type ProductStockFilter = "all" | "in_stock" | "out_of_stock" | "not_tracked";
export type ProductMediaFilter = "all" | "with_media" | "without_media";
export type ProductVariantCountFilter = "all" | "no_variants" | "single_variant" | "multi_variant";

export type ProductTableFilterInput = {
  categoryId?: string | undefined;
  collectionId?: string | undefined;
  media?: ProductMediaFilter | undefined;
  query: string;
  status: ProductStatusFilter;
  stock?: ProductStockFilter | undefined;
  variantCount?: ProductVariantCountFilter | undefined;
};

export type ProductThumbnail =
  | {
      kind: "image";
      url: string;
    }
  | {
      initials: string;
      kind: "fallback";
    };

export function filterProductsForTable(
  products: MerchantProduct[],
  input: ProductTableFilterInput,
) {
  const query = input.query.trim().toLowerCase();

  return products.filter((product) => {
    const status = normalizeProductStatus(product.status);
    const matchesStatus = input.status === "all" || status === input.status;
    const matchesStock = productMatchesStock(product, input.stock ?? "all");
    const matchesMedia = productMatchesMedia(product, input.media ?? "all");
    const matchesVariantCount = productMatchesVariantCount(product, input.variantCount ?? "all");
    const matchesCollection =
      !input.collectionId ||
      input.collectionId === "all" ||
      (input.collectionId === "none" ? !product.collectionId : product.collectionId === input.collectionId);
    const matchesCategory =
      !input.categoryId ||
      input.categoryId === "all" ||
      (input.categoryId === "none"
        ? !(product.categoryIds ?? []).length
        : (product.categoryIds ?? []).includes(input.categoryId));
    const matchesQuery = !query || getProductSearchText(product).includes(query);

    return (
      matchesStatus &&
      matchesStock &&
      matchesMedia &&
      matchesVariantCount &&
      matchesCollection &&
      matchesCategory &&
      matchesQuery
    );
  });
}

export function getProductSearchText(product: MerchantProduct) {
  return [
    product.id,
    product.title,
    product.handle,
    product.status,
    product.description,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function normalizeProductStatus(status: string | null): ProductStatusFilter {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "published" || normalized === "draft") {
    return normalized;
  }

  return "unknown";
}

export function parseProductStatusFilter(value: string | string[] | null | undefined) {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (normalized === "published" || normalized === "draft" || normalized === "unknown") {
    return normalized;
  }

  return "all";
}

export function parseProductStockFilter(value: string | string[] | null | undefined): ProductStockFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (normalized === "in_stock" || normalized === "out_of_stock" || normalized === "not_tracked") {
    return normalized;
  }

  return "all";
}

export function parseProductMediaFilter(value: string | string[] | null | undefined): ProductMediaFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (normalized === "with_media" || normalized === "without_media") {
    return normalized;
  }

  return "all";
}

export function parseProductVariantCountFilter(
  value: string | string[] | null | undefined,
): ProductVariantCountFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (
    normalized === "no_variants" ||
    normalized === "single_variant" ||
    normalized === "multi_variant"
  ) {
    return normalized;
  }

  return "all";
}

export function getProductPriceSortValue(product: MerchantProduct) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number");

  return typeof price?.amount === "number" ? price.amount : null;
}

export function getProductMediaCount(product: MerchantProduct) {
  const mediaUrls = new Set<string>();

  const thumbnailUrl = product.thumbnail?.trim();

  if (thumbnailUrl) {
    mediaUrls.add(thumbnailUrl);
  }

  for (const image of product.images ?? []) {
    const imageUrl = image.url?.trim();

    if (imageUrl) {
      mediaUrls.add(imageUrl);
    }
  }

  return mediaUrls.size;
}

export function getProductThumbnail(product: MerchantProduct): ProductThumbnail {
  const thumbnailUrl = product.thumbnail?.trim();

  if (thumbnailUrl) {
    return {
      kind: "image",
      url: thumbnailUrl,
    };
  }

  const label = product.title ?? product.handle ?? product.id;
  const initials = label
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return {
    initials: initials || "PR",
    kind: "fallback",
  };
}

export function getProductTableCounts(input: {
  filters: ProductTableFilterInput;
  filteredCount: number;
  pageCount: number;
  totalCount: number;
}) {
  const { filters, ...counts } = input;

  return {
    ...counts,
    hasActiveFilter:
      filters.query.trim().length > 0 ||
      filters.status !== "all" ||
      (filters.stock ?? "all") !== "all" ||
      (filters.media ?? "all") !== "all" ||
      (filters.variantCount ?? "all") !== "all" ||
      Boolean(filters.collectionId && filters.collectionId !== "all") ||
      Boolean(filters.categoryId && filters.categoryId !== "all"),
  };
}

function productMatchesStock(product: MerchantProduct, stockFilter: ProductStockFilter) {
  if (stockFilter === "all") {
    return true;
  }

  const stocks = (product.variants ?? []).map((variant) => variant.stock).filter(Boolean);

  if (stockFilter === "not_tracked") {
    return stocks.length === 0;
  }

  if (stocks.length === 0) {
    return false;
  }

  const availableQuantity = stocks.reduce(
    (total, stock) => total + (stock?.availableQuantity ?? stock?.stockedQuantity ?? 0),
    0,
  );

  return stockFilter === "in_stock" ? availableQuantity > 0 : availableQuantity <= 0;
}

function productMatchesMedia(product: MerchantProduct, mediaFilter: ProductMediaFilter) {
  if (mediaFilter === "all") {
    return true;
  }

  const hasMedia = getProductMediaCount(product) > 0;

  return mediaFilter === "with_media" ? hasMedia : !hasMedia;
}

function productMatchesVariantCount(
  product: MerchantProduct,
  variantCountFilter: ProductVariantCountFilter,
) {
  if (variantCountFilter === "all") {
    return true;
  }

  const variantCount = product.variants?.length ?? 0;

  if (variantCountFilter === "no_variants") {
    return variantCount === 0;
  }

  if (variantCountFilter === "single_variant") {
    return variantCount === 1;
  }

  return variantCount > 1;
}
