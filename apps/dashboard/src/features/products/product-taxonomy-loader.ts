import {
  type MerchantProductCategory,
  type MerchantProductCollection,
  merchantProductCategoriesSchema,
  merchantProductCollectionsSchema,
} from "@ecs/contracts";

type TaxonomyKind = "categories" | "collections";
type TaxonomyItem<K extends TaxonomyKind> = K extends "categories"
  ? MerchantProductCategory
  : MerchantProductCollection;

/** Complete small reference lists, never silently return a truncated selector. */
export async function loadProductTaxonomy<K extends TaxonomyKind>(
  baseUrl: URL,
  kind: K,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<TaxonomyItem<K>[]> {
  const items = new Map<string, TaxonomyItem<K>>();
  const maximum = 10_000;
  let offset = 0;
  while (offset < maximum) {
    signal.throwIfAborted();
    const url = new URL(baseUrl);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const response = await fetcher(url, { signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Unable to load ${kind}`);
    const body: unknown = await response.json();
    const parsed =
      kind === "categories"
        ? merchantProductCategoriesSchema.parse(body)
        : merchantProductCollectionsSchema.parse(body);
    const page = (
      "categories" in parsed ? parsed.categories : parsed.collections
    ) as TaxonomyItem<K>[];
    if (parsed.offset !== offset || parsed.count > maximum || parsed.limit < 1) {
      throw new Error(`Incomplete ${kind} response`);
    }
    for (const item of page) {
      if (items.has(item.id)) throw new Error(`${kind} changed while loading`);
      items.set(item.id, item);
    }
    offset += page.length;
    if (offset >= parsed.count) return [...items.values()];
    if (page.length === 0) throw new Error(`Incomplete ${kind} response`);
  }
  throw new Error(`Too many ${kind} to load`);
}
