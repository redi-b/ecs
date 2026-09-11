import type { APIRoute } from "astro";
import { listStoreProducts } from "../lib/commerce/products.js";
import { isStoreError } from "../lib/commerce/result.js";
import { toStoreSearchSuggestions } from "../lib/commerce/search-suggestions.js";
import { loadPageContext } from "../lib/page-context.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  },
});

export const GET: APIRoute = async ({ request, url }) => {
  const q = url.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return json({ suggestions: [] });
  if (q.length > 120) return json({ message: "Search is too long." }, 400);

  const ctx = await loadPageContext(request, { skipCart: true });
  if (!ctx.ok) return json({ suggestions: [] }, ctx.status);
  const result = await listStoreProducts({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    regionId: ctx.config.commerce.regionId,
    q,
    limit: 6,
    offset: 0,
  });
  if (isStoreError(result)) return json({ suggestions: [] }, result.status >= 500 ? 503 : result.status);

  return json({
    suggestions: toStoreSearchSuggestions(result.products),
  });
};
