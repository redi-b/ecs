import { headers } from "next/headers";
import { PermissionGate } from "@/components/app/access-context";
import { HelpTip } from "@/components/app/help-tip";
import { ListSetupState } from "@/components/app/list-error-state";
import { CatalogLabelLocaleControl } from "@/components/app/catalog-label-locale-control";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductCollectionsTable } from "@/features/catalog-taxonomy/product-collections-table";
import { TaxonomyCreateDialog } from "@/features/catalog-taxonomy/taxonomy-create-dialog";
import { getTaxonomyListErrorState } from "@/features/catalog-taxonomy/taxonomy-list-error-state";
import type { MessageKey } from "@/i18n/messages";
import { getTranslations } from "@/i18n/server";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getMerchantProductCollections } from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";
import { getAllStorefrontTranslationReadiness } from "@/lib/storefront-translation-readiness";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantProductCollectionsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductCollectionsPage({
  searchParams,
}: MerchantProductCollectionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const visibility =
    resolvedSearchParams.visibility === "hidden"
      ? "hidden"
      : resolvedSearchParams.visibility === "public"
        ? "public"
        : "all";
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const t = await getTranslations();
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const createCollectionAction = getTenantScopedPath(
    dashboardRoutes.productCollectionCreateAction,
    tenantId,
  );
  const collectionNotice = getCollectionNotice(resolvedSearchParams.collectionStatus, t);
  const result = await getMerchantProductCollections({
    visibility,
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
    ...(listParams.q ? { q: listParams.q } : {}),
  });
  const translationQueue =
    resolvedSearchParams.translationFrom === "workspace"
      ? await getAllStorefrontTranslationReadiness({
          cookieHeader: requestHeaders.get("cookie"),
          platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
          requestHost: requestHeaders.get("host"),
          resourceType: "product_collection",
        })
      : null;
  const errorState = result.ok ? null : getTaxonomyListErrorState("collections", result.message, t);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <PermissionGate permission="products.create">
            <TaxonomyCreateDialog
              tenantId={tenantId}
              action={createCollectionAction}
              entityLabel="collection"
              nameKey="title"
              nameLabel={t("taxonomy.create.titleLabel")}
              namePlaceholder={t("taxonomy.create.titlePlaceholder")}
              queryKey="product-collections"
              triggerLabel={t("collections.actions.new")}
            />
          </PermissionGate>
        </>
      }
      titleAccessory={
        <HelpTip label={t("collections.helpLabel")} summary={t("collections.description")} />
      }
      title={t("collections.title")}
    >
      {collectionNotice ? (
        <Alert variant={collectionNotice.variant}>
          <AlertTitle>{collectionNotice.title}</AlertTitle>
          <AlertDescription>{collectionNotice.description}</AlertDescription>
        </Alert>
      ) : null}
      {result.ok ? (
        <>
          <ListSummary
            actions={<CatalogLabelLocaleControl />}
            count={result.count}
            filtered={Boolean(listParams.q) || visibility !== "all"}
            page={listParams.page}
            pageSize={result.limit}
          />
          <ProductCollectionsTable
            initialVisibility={visibility}
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
            initialQuery={listParams.q}
            pageSize={result.limit}
            totalCount={result.count}
            tenantId={tenantId}
            translationId={
              typeof resolvedSearchParams.translate === "string"
                ? resolvedSearchParams.translate
                : undefined
            }
            translationQueueNavigation={translationQueueNavigation(
              translationQueue?.ok ? translationQueue.queue.items : [],
              typeof resolvedSearchParams.translate === "string"
                ? resolvedSearchParams.translate
                : undefined,
              "/dashboard/products/collections",
            )}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? t("collections.error.loadTitle")}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function translationQueueNavigation(
  items: Array<{
    resourceId: string;
    status: "needs_review" | "ready" | "using_english";
    title: string;
  }>,
  resourceId: string | undefined,
  basePath: string,
) {
  const unfinished = items.filter((item) => item.status !== "ready");
  const index = unfinished.findIndex((item) => item.resourceId === resourceId);
  if (index < 0) return undefined;
  const href = (item: (typeof unfinished)[number]) =>
    `${basePath}?${new URLSearchParams({
      q: item.title,
      translate: item.resourceId,
      translationFrom: "workspace",
    })}`;
  const previousItem = unfinished[index - 1];
  const nextItem = unfinished[index + 1];
  const previous = previousItem ? href(previousItem) : undefined;
  const next = nextItem ? href(nextItem) : undefined;
  return previous || next ? { next, previous } : undefined;
}

function getCollectionNotice(
  collectionStatus: string | string[] | undefined,
  t: (key: MessageKey) => string,
) {
  const status = Array.isArray(collectionStatus) ? collectionStatus[0] : collectionStatus;

  if (!status) {
    return null;
  }

  if (status === "collection_created") {
    return {
      variant: "default" as const,
      title: t("collections.notice.created.title"),
      description: t("collections.notice.created.description"),
    };
  }

  if (status === "missing_title") {
    return {
      variant: "destructive" as const,
      title: t("collections.notice.missingTitle.title"),
      description: t("collections.notice.missingTitle.description"),
    };
  }

  const mutationError = getTaxonomyListErrorState("collections", status, t);

  if (mutationError.kind === "setup" || mutationError.kind === "service") {
    return null;
  }

  return {
    variant: "destructive" as const,
    title: t("collections.notice.error.title"),
    description: mutationError.description,
  };
}
