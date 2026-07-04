import type { MerchantProduct } from "@ecs/contracts";

export type ProductStatusFilter = "all" | "published" | "draft" | "unknown";

export type ProductTableFilterInput = {
  query: string;
  status: ProductStatusFilter;
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
    const matchesQuery = !query || getProductSearchText(product).includes(query);

    return matchesStatus && matchesQuery;
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
  const normalized = status?.toLowerCase();

  if (normalized === "published" || normalized === "draft") {
    return normalized;
  }

  return "unknown";
}

export function getProductPriceSortValue(product: MerchantProduct) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number");

  return typeof price?.amount === "number" ? price.amount : null;
}

export function getProductMediaCount(product: MerchantProduct) {
  const imageCount = product.images?.length ?? 0;

  return product.thumbnail ? Math.max(1, imageCount) : imageCount;
}

export function getProductThumbnail(product: MerchantProduct): ProductThumbnail {
  if (product.thumbnail) {
    return {
      kind: "image",
      url: product.thumbnail,
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
  filteredCount: number;
  pageCount: number;
  totalCount: number;
}) {
  return {
    ...input,
    hasActiveFilter: input.filteredCount !== input.pageCount,
  };
}
