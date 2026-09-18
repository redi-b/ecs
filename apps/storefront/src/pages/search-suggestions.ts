import type { APIRoute } from "astro";
import { listStoreProducts } from "../lib/commerce/products.js";
import { isStoreError } from "../lib/commerce/result.js";
import { toStoreSearchSuggestions } from "../lib/commerce/search-suggestions.js";
import { loadPageContext } from "../lib/page-context.js";
import { STOREFRONT_LOCALE_HEADER } from "../lib/storefront-locale.js";
import * as m from "../paraglide/messages.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  },
});

export const GET: APIRoute = async ({ request, url }) => {
  const locale = request.headers.get(STOREFRONT_LOCALE_HEADER) === "am" ? "am" : "en";
  const q = url.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return json({ suggestions: [] });
  if (q.length > 120) return json({ message: m.search_too_long({}, { locale }) }, 400);

  const ctx = await loadPageContext(request, { skipCart: true });
  if (!ctx.ok) return json({ suggestions: [] }, ctx.status);
  const result = await listStoreProducts({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    regionId: ctx.config.commerce.regionId,
    locale: ctx.commerceLocale,
    q,
    limit: 6,
    offset: 0,
  });
  if (isStoreError(result)) return json({ suggestions: [] }, result.status >= 500 ? 503 : result.status);

  return json({
    suggestions: toStoreSearchSuggestions(result.products, ctx.locale),
  });
};
