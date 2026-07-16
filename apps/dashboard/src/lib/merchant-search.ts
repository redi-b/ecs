import {
  type MerchantSearchHit,
  type MerchantSearchHitType,
  merchantSearchResponseSchema,
  platformErrorSchema,
} from "@ecs/contracts";

import { platformFetch, type PlatformRequestContext } from "@/lib/platform-api/client";
import { dashboardRoutes } from "@/lib/routes";

export type MerchantSearchResult =
  | { ok: true; results: MerchantSearchHit[]; query: string }
  | { ok: false; message: string; status: number };

export async function getMerchantSearch(
  context: PlatformRequestContext & {
    fetcher?: typeof fetch;
    limit?: number;
    q: string;
    types?: MerchantSearchHitType[] | undefined;
  },
): Promise<MerchantSearchResult> {
  const q = context.q.trim();
  if (q.length < 2) {
    return { ok: true, results: [], query: q };
  }

  const searchParams: Record<string, string | number> = {
    q,
    limit: context.limit ?? 6,
  };
  if (context.types?.length) {
    searchParams.types = context.types.join(",");
  }

  const response = await platformFetch("/platform/merchant/search", {
    ...(context.cookieHeader !== undefined ? { cookieHeader: context.cookieHeader } : {}),
    ...(context.fetcher !== undefined ? { fetcher: context.fetcher } : {}),
    ...(context.platformApiBaseUrl !== undefined
      ? { platformApiBaseUrl: context.platformApiBaseUrl }
      : {}),
    ...(context.requestHost !== undefined ? { requestHost: context.requestHost } : {}),
    searchParams,
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : "search_failed",
    };
  }

  const parsed = merchantSearchResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, status: 502, message: "invalid_search_response" };
  }

  return {
    ok: true,
    results: parsed.data.results,
    query: parsed.data.query,
  };
}

/** Map platform search hit → dashboard href (UI owns routes). */
export function hrefForSearchHit(hit: MerchantSearchHit): string {
  switch (hit.type) {
    case "product":
      return dashboardRoutes.productDetail(hit.id);
    case "order":
      return dashboardRoutes.orderDetail(hit.id);
    case "customer":
      return dashboardRoutes.customerDetail(hit.id);
    case "media":
      return dashboardRoutes.media;
    case "category":
      return dashboardRoutes.productCategories;
    case "collection":
      return dashboardRoutes.productCollections;
    case "promotion":
      return dashboardRoutes.promotions;
    default:
      return dashboardRoutes.overview;
  }
}

export function groupLabelForSearchType(
  type: MerchantSearchHitType,
  t?: (key: "nav.products" | "nav.orders" | "nav.customers" | "nav.media" | "nav.productCategories" | "nav.productCollections" | "nav.promotions" | "commandCenter.results") => string,
): string {
  switch (type) {
    case "product":
      return t ? t("nav.products") : "Products";
    case "order":
      return t ? t("nav.orders") : "Orders";
    case "customer":
      return t ? t("nav.customers") : "Customers";
    case "media":
      return t ? t("nav.media") : "Media";
    case "category":
      return t ? t("nav.productCategories") : "Categories";
    case "collection":
      return t ? t("nav.productCollections") : "Collections";
    case "promotion":
      return t ? t("nav.promotions") : "Promotions";
    default:
      return t ? t("commandCenter.results") : "Results";
  }
}
