import type { APIRoute } from "astro";

import { listStoreProducts } from "../lib/commerce/products.js";
import { loadPageContext } from "../lib/page-context.js";
import { buildTenantSitemap, loadSitemapProductHandles } from "../lib/seo-routes.js";

export const GET: APIRoute = async ({ request }) => {
  const context = await loadPageContext(request, { skipCart: true });
  if (!context.ok) return unavailable(context.status);

  const result = await loadSitemapProductHandles(({ limit, offset }) =>
    listStoreProducts({
      limit,
      offset,
      platformApiBaseUrl: context.platformApiBaseUrl,
      regionId: context.config.commerce.regionId,
      requestHost: context.requestHost,
    }),
  );
  if (!result.ok) return unavailable(result.status >= 500 ? 503 : result.status);

  return new Response(buildTenantSitemap(context.publicOrigin, result.handles), {
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
