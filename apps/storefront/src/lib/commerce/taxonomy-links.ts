import type { StoreCategory, StoreCollection } from "./types.js";

type TaxonomyItem = { id: string; handle: string | null };

export function taxonomyHandle(item: TaxonomyItem): string | null {
  return item.handle?.trim() || null;
}

export function collectionProductsHref(collection: StoreCollection): string {
  const handle = taxonomyHandle(collection);
  return handle ? `/products?collection=${encodeURIComponent(handle)}` : "/products";
}

export function categoryProductsHref(category: StoreCategory): string {
  const handle = taxonomyHandle(category);
  return handle ? `/products?category=${encodeURIComponent(handle)}` : "/products";
}

export function resolveTaxonomySelection<T extends TaxonomyItem>(items: T[], value: string) {
  if (!value) return { item: null, legacyId: false } as const;
  const byHandle = items.find((item) => taxonomyHandle(item) === value);
  if (byHandle) return { item: byHandle, legacyId: false } as const;
  const byId = items.find((item) => item.id === value);
  return { item: byId ?? null, legacyId: Boolean(byId) } as const;
}
