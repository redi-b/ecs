/**
 * Catalog vs private response caching helpers.
 *
 * Catalog pages: public HTML cache (tenant-tagged) — no cart personalization in HTML.
 * Private pages: Cache-Control private, no-store.
 */

export const CATALOG_CACHE_TTL = {
  home: { maxAge: 60, swr: 120 },
  productList: { maxAge: 30, swr: 60 },
  productDetail: { maxAge: 60, swr: 120 },
} as const;

export function tenantCacheTags(input: {
  tenantId: string;
  publishedRevisionId: string;
  templateKey?: string;
}) {
  const tags = [
    `tenant:${input.tenantId}`,
    `revision:${input.publishedRevisionId}`,
  ];
  if (input.templateKey) {
    tags.push(`template:${input.templateKey}`);
  }
  return tags;
}

type CacheApi = {
  enabled?: boolean;
  set: (options: false | { maxAge?: number; swr?: number; tags?: string[] }) => void;
};

/** Opt catalog HTML into Redis/CDN-style caching. Call only on successful public pages. */
export function applyCatalogCache(
  cache: CacheApi | undefined | null,
  input: {
    tenantId: string;
    publishedRevisionId: string;
    templateKey?: string;
    maxAge: number;
    swr?: number;
  },
) {
  if (!cache) return;
  cache.set({
    maxAge: input.maxAge,
    swr: input.swr ?? input.maxAge,
    tags: tenantCacheTags(input),
  });
}

/** Cart, checkout, order, actions — never public cache. */
export function applyPrivateNoStore(
  cache: CacheApi | undefined | null,
  response?: { headers: Headers },
) {
  if (cache) {
    cache.set(false);
  }
  response?.headers.set("Cache-Control", "private, no-store");
}
