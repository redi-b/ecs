import { headers } from "next/headers";
import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductCategoriesTable } from "@/features/catalog-taxonomy/product-categories-table";
import { TaxonomyCreateDialog } from "@/features/catalog-taxonomy/taxonomy-create-dialog";
import { getTaxonomyListErrorState } from "@/features/catalog-taxonomy/taxonomy-list-error-state";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
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
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const createCategoryAction = getTenantScopedPath(
    dashboardRoutes.productCategoryCreateAction,
    tenantId,
  );
  const categoryNotice = getCategoryNotice(resolvedSearchParams.categoryStatus, t);
  const result = await getMerchantProductCategories({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
    ...(listParams.q ? { q: listParams.q } : {}),
  });
  const errorState = result.ok ? null : getTaxonomyListErrorState("categories", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <TaxonomyCreateDialog
            action={createCategoryAction}
            entityLabel="category"
            nameKey="name"
            nameLabel="Name"
            namePlaceholder="Coffee"
            parentOptions={result.ok ? result.categories : []}
            queryKey="product-categories"
            triggerLabel="New category"
          />
        </>
      }
      description={t("categories.description")}
      title={t("categories.title")}
    >
      {categoryNotice ? (
        <Alert variant={categoryNotice.variant}>
          <AlertTitle>{categoryNotice.title}</AlertTitle>
          <AlertDescription>{categoryNotice.description}</AlertDescription>
        </Alert>
      ) : null}
      {result.ok ? (
        <>
          <ListSummary count={result.count} label={t("nav.productCategories").toLowerCase()} />
          <ProductCategoriesTable
            categories={result.categories}
            footer={
              <PaginationControls
                basePath={dashboardRoutes.productCategories}
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
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? t("categories.error.loadTitle")}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function getCategoryNotice(
  categoryStatus: string | string[] | undefined,
  t: (key: MessageKey) => string,
) {
  const status = Array.isArray(categoryStatus) ? categoryStatus[0] : categoryStatus;

  if (!status) {
    return null;
  }

  if (status === "category_created") {
    return {
      variant: "default" as const,
      title: t("categories.notice.created.title"),
      description: t("categories.notice.created.description"),
    };
  }

  if (status === "missing_name") {
    return {
      variant: "destructive" as const,
      title: t("categories.notice.missingName.title"),
      description: t("categories.notice.missingName.description"),
    };
  }

  const mutationError = getTaxonomyListErrorState("categories", status);

  if (mutationError.kind === "setup" || mutationError.kind === "service") {
    return null;
  }

  return {
    variant: "destructive" as const,
    title: t("categories.notice.error.title"),
    description: mutationError.description,
  };
}
