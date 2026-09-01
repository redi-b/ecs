import type { APIRoute } from "astro";

import { listStoreCategories, listStoreCollections } from "../lib/commerce/catalog.js";
import { listStoreProducts } from "../lib/commerce/products.js";
import { isStoreError } from "../lib/commerce/result.js";
import { loadPageContext } from "../lib/page-context.js";
import { buildTenantSitemap, loadSitemapProductHandles } from "../lib/seo-routes.js";

export const GET: APIRoute = async ({ request }) => {
  const context = await loadPageContext(request, { skipCart: true });
  if (!context.ok) return unavailable(context.status);

  const storeRequest = {
    platformApiBaseUrl: context.platformApiBaseUrl,
    requestHost: context.requestHost,
  };
  const [result, collectionsResult, categoriesResult] = await Promise.all([
    loadSitemapProductHandles(({ limit, offset }) => listStoreProducts({
      limit,
      offset,
      platformApiBaseUrl: storeRequest.platformApiBaseUrl,
      regionId: context.config.commerce.regionId,
      requestHost: storeRequest.requestHost,
    })),
    listStoreCollections({ ...storeRequest, limit: 100 }),
    listStoreCategories({ ...storeRequest, limit: 100 }),
  ]);
  if (!result.ok) return unavailable(result.status >= 500 ? 503 : result.status);
  if (isStoreError(collectionsResult) || isStoreError(categoriesResult)) return unavailable(503);

  return new Response(buildTenantSitemap(context.publicOrigin, result.handles, {
    collectionHandles: collectionsResult.collections.flatMap((item) => item.handle?.trim() ? [item.handle.trim()] : []),
    categoryHandles: categoriesResult.categories.flatMap((item) => item.handle?.trim() ? [item.handle.trim()] : []),
  }), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      "Content-Type": "application/xml; charset=utf-8",
      Vary: "Host, X-Forwarded-Host",
    },
  });
};

function unavailable(status: number) {
  return new Response("Sitemap unavailable.\n", {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Vary: "Host, X-Forwarded-Host",
    },
  });
}
