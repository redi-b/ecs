import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductCategoriesTable } from "@/features/catalog-taxonomy/product-categories-table";
import { getTaxonomyListErrorState } from "@/features/catalog-taxonomy/taxonomy-list-error-state";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantProductCategories } from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantProductCategoriesPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductCategoriesPage({
  searchParams,
}: MerchantProductCategoriesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const result = await getMerchantProductCategories({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const errorState = result.ok ? null : getTaxonomyListErrorState("categories", result.message);

  return (
    <PageShell
      actions={<RefreshButton />}
      description="Review merchant-scoped product categories from the catalog taxonomy."
      title="Product categories"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.count} label="product categories" />
          <ProductCategoriesTable
            categories={result.categories}
            pageSize={result.limit}
            totalCount={result.count}
          />
          <PaginationControls
            basePath={dashboardRoutes.productCategories}
            count={result.count}
            page={listParams.page}
            pageSize={result.limit}
            searchParams={resolvedSearchParams}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? "Product categories could not be loaded"}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
