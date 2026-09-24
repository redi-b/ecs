"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useQuery } from "@tanstack/react-query";

import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { loadProductTaxonomy } from "./product-taxonomy-loader";

export type ProductTaxonomyResult = {
  categoriesPending: boolean;
  categoriesError: boolean;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  errorLabels: string[];
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
  retry: () => void;
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

  const categoriesQuery = useQuery({
    enabled,
    queryKey: ["product-taxonomy", tenantId ?? "host", "categories"],
    queryFn: ({ signal }) =>
      loadProductTaxonomy(
        new URL(
          getTenantScopedPath(dashboardRoutes.productCategoriesListAction, tenantId),
          window.location.origin,
        ),
        "categories",
        signal,
      ),
    staleTime: 60_000,
  });
  const collectionsQuery = useQuery({
    enabled,
    queryKey: ["product-taxonomy", tenantId ?? "host", "collections"],
    queryFn: ({ signal }) =>
      loadProductTaxonomy(
        new URL(
          getTenantScopedPath(dashboardRoutes.productCollectionsListAction, tenantId),
          window.location.origin,
        ),
        "collections",
        signal,
      ),
    staleTime: 60_000,
  });

  return {
    categoriesPending: categoriesQuery.isPending,
    categoriesError: categoriesQuery.isError,
    categories: categoriesQuery.data ?? [],
    collections: collectionsQuery.data ?? [],
    errorLabels: [
      ...(categoriesQuery.isError ? ["categories"] : []),
      ...(collectionsQuery.isError ? ["collections"] : []),
    ],
    isError: categoriesQuery.isError || collectionsQuery.isError,
    isLoading: categoriesQuery.isLoading || collectionsQuery.isLoading,
    isPending: categoriesQuery.isPending || collectionsQuery.isPending,
    retry: () => {
      void categoriesQuery.refetch();
      void collectionsQuery.refetch();
    },
  };
}
