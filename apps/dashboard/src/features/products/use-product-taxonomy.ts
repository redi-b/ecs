"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useQuery } from "@tanstack/react-query";

import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

export type ProductTaxonomyResult = {
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  errorLabels: string[];
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
};

/**
 * Shared categories + collections for product list filters, create, and detail org labels.
 * Fetches after paint so product document TTFB is not blocked on taxonomy.
 */
export function useProductTaxonomy(options: {
  enabled?: boolean | undefined;
  tenantId?: string | undefined;
}): ProductTaxonomyResult {
  const enabled = options.enabled ?? true;
  const tenantId = options.tenantId;

  const query = useQuery({
    enabled,
    queryKey: ["product-taxonomy", tenantId ?? "host"],
    queryFn: async () => {
      const [categoriesResponse, collectionsResponse] = await Promise.all([
        fetchTaxonomyList(dashboardRoutes.productCategoriesListAction, tenantId),
        fetchTaxonomyList(dashboardRoutes.productCollectionsListAction, tenantId),
      ]);

      const errorLabels: string[] = [];
      let categories: MerchantProductCategory[] = [];
      let collections: MerchantProductCollection[] = [];

      if (categoriesResponse.ok) {
        categories = categoriesResponse.categories;
      } else {
        errorLabels.push("categories");
      }

      if (collectionsResponse.ok) {
        collections = collectionsResponse.collections;
      } else {
        errorLabels.push("collections");
      }

      return { categories, collections, errorLabels };
    },
    staleTime: 60_000,
  });

  return {
    categories: query.data?.categories ?? [],
    collections: query.data?.collections ?? [],
    errorLabels: query.data?.errorLabels ?? [],
    isError: Boolean(query.data?.errorLabels.length) || query.isError,
    isLoading: query.isLoading,
    isPending: query.isPending,
  };
}

async function fetchTaxonomyList(
  path: string,
  tenantId: string | undefined,
): Promise<
  | { ok: true; categories: MerchantProductCategory[]; collections: MerchantProductCollection[] }
  | { ok: false }
> {
  const url = new URL(getTenantScopedPath(path, tenantId), window.location.origin);
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", "0");

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false };
  }

  const body = (await response.json().catch(() => null)) as {
    categories?: MerchantProductCategory[];
    collections?: MerchantProductCollection[];
  } | null;

  if (!body || typeof body !== "object") {
    return { ok: false };
  }

  return {
    ok: true,
    categories: Array.isArray(body.categories) ? body.categories : [],
    collections: Array.isArray(body.collections) ? body.collections : [],
  };
}
