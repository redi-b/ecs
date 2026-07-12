import { headers } from "next/headers";
import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductCollectionsTable } from "@/features/catalog-taxonomy/product-collections-table";
import { TaxonomyCreateDialog } from "@/features/catalog-taxonomy/taxonomy-create-dialog";
import { getTaxonomyListErrorState } from "@/features/catalog-taxonomy/taxonomy-list-error-state";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getMerchantProductCollections } from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantProductCollectionsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductCollectionsPage({
  searchParams,
}: MerchantProductCollectionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const createCollectionAction = getTenantScopedPath(
    dashboardRoutes.productCollectionCreateAction,
    tenantId,
  );
  const collectionNotice = getCollectionNotice(resolvedSearchParams.collectionStatus);
  const result = await getMerchantProductCollections({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const errorState = result.ok ? null : getTaxonomyListErrorState("collections", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <TaxonomyCreateDialog
            action={createCollectionAction}
            entityLabel="collection"
            nameKey="title"
            nameLabel="Title"
            namePlaceholder="Featured"
            queryKey="product-collections"
            triggerLabel="New collection"
          />
        </>
      }
      description="Review merchant-scoped product collections from the catalog taxonomy."
      title="Product collections"
    >
      {collectionNotice ? (
        <Alert variant={collectionNotice.variant}>
          <AlertTitle>{collectionNotice.title}</AlertTitle>
          <AlertDescription>{collectionNotice.description}</AlertDescription>
        </Alert>
      ) : null}
      {result.ok ? (
        <>
          <ListSummary count={result.count} label="product collections" />
          <ProductCollectionsTable
            collections={result.collections}
            footer={
              <PaginationControls
                basePath={dashboardRoutes.productCollections}
                count={result.count}
                page={listParams.page}
                pageSize={result.limit}
                searchParams={resolvedSearchParams}
              />
            }
            pageSize={result.limit}
            totalCount={result.count}
            tenantId={tenantId}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? "Product collections could not be loaded"}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function getCollectionNotice(collectionStatus: string | string[] | undefined) {
  const status = Array.isArray(collectionStatus) ? collectionStatus[0] : collectionStatus;

  if (!status) {
    return null;
  }

  if (status === "collection_created") {
    return {
      variant: "default" as const,
      title: "Collection created",
      description: "The product collection is now available for catalog organization.",
    };
  }

  if (status === "missing_title") {
    return {
      variant: "destructive" as const,
      title: "Collection could not be created",
      description: "Enter a collection title before continuing.",
    };
  }

  const mutationError = getTaxonomyListErrorState("collections", status);

  if (mutationError.kind === "setup" || mutationError.kind === "service") {
    return null;
  }

  return {
    variant: "destructive" as const,
    title: "Collection could not be created",
    description: mutationError.description,
  };
}
