export type CatalogFilters = {
  q?: string;
  collectionId?: string;
  categoryId?: string;
  optionPairs: string[];
  priceMin?: number;
  priceMax?: number;
  order?: string;
};

const ORDERS = new Set(["created_at", "title", "-title", "price", "-price"]);

function price(value: string | null) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000_000
    ? parsed
    : undefined;
}

export function parseOptionPair(value: string) {
  try {
    const pair: unknown = JSON.parse(value);
    if (!Array.isArray(pair) || pair.length !== 2 ||
      typeof pair[0] !== "string" || typeof pair[1] !== "string") return null;
    const name = pair[0].trim();
    const optionValue = pair[1].trim();
    return name && optionValue ? { name, value: optionValue } : null;
  } catch {
    return null;
  }
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const q = params.get("q")?.trim().slice(0, 120) || undefined;
  const collectionId = params.get("collection")?.trim().slice(0, 255) || undefined;
  const categoryId = params.get("category")?.trim().slice(0, 255) || undefined;
  const optionPairs = [...new Set(params.getAll("option"))]
    .filter((value) => value.length <= 255 && parseOptionPair(value))
    .slice(0, 12);
  const priceMin = price(params.get("price_min"));
  const priceMax = price(params.get("price_max"));
  const orderValue = params.get("order")?.trim();
  const order = orderValue && ORDERS.has(orderValue) ? orderValue : undefined;
  return {
    ...(q ? { q } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(categoryId ? { categoryId } : {}),
    optionPairs,
    ...(priceMin !== undefined ? { priceMin } : {}),
    ...(priceMax !== undefined ? { priceMax } : {}),
    ...(order ? { order } : {}),
  };
}

export function catalogHref(filters: CatalogFilters, nextOffset = 0) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.collectionId) params.set("collection", filters.collectionId);
  if (filters.categoryId) params.set("category", filters.categoryId);
  for (const option of filters.optionPairs) params.append("option", option);
  if (filters.priceMin !== undefined) params.set("price_min", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("price_max", String(filters.priceMax));
  if (filters.order) params.set("order", filters.order);
  if (nextOffset > 0) params.set("offset", String(nextOffset));
  return params.size ? `/products?${params.toString()}` : "/products";
}
