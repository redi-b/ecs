import { cookies, headers } from "next/headers";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductForm } from "@/features/products/product-form";
import type { MessageKey } from "@/i18n/messages";
import { getTranslations } from "@/i18n/server";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import {
  getMerchantProductCached,
  getMerchantProductCategoriesCached,
  getMerchantProductCollectionsCached,
} from "@/lib/merchant-products-rsc";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type MerchantProductEditPageProps = {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

type ReferenceDataError = {
  label: string;
  state: ListErrorState;
};

export default async function MerchantProductEditPage({
  params,
  searchParams,
}: MerchantProductEditPageProps) {
  const t = await getTranslations();
  const [{ productId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tenantId = getSelectedTenantId(resolvedSearchParams ?? {});
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const cookieHeader = cookieStore.toString();
  const requestHost = requestHeaders.get("host");
  // Edit still needs taxonomy for the form; use request-memoized loaders.
  const [productResult, categoriesResult, collectionsResult] = await Promise.all([
    getMerchantProductCached(
      platformApiBaseUrl,
      cookieHeader,
      requestHost,
      tenantId,
      productId,
    ),
    getMerchantProductCategoriesCached(
      platformApiBaseUrl,
      cookieHeader,
      requestHost,
      tenantId,
      100,
      0,
    ),
    getMerchantProductCollectionsCached(
      platformApiBaseUrl,
      cookieHeader,
      requestHost,
      tenantId,
      100,
      0,
    ),
  ]);
  const productErrorState = productResult.ok
    ? null
    : getListErrorState("products", productResult.message);
  const referenceDataErrors = [
    getReferenceDataError(t("taxonomy.entity.category.plural"), categoriesResult),
    getReferenceDataError(t("taxonomy.entity.collection.plural"), collectionsResult),
  ].filter((error): error is ReferenceDataError => Boolean(error));
  const setupError =
    productErrorState?.kind === "setup" || productErrorState?.kind === "service"
      ? productErrorState
      : referenceDataErrors.find(
          (error) => error.state.kind === "setup" || error.state.kind === "service",
        )?.state;
  const optionErrors = referenceDataErrors.filter((error) => error.state.kind === "error");

  return (
    <PageShell
      actions={<RefreshButton />}
      description={t("products.detail.shellDescription")}
      title={t("products.composer.editTitle")}
    >
      {setupError ? (
        <ListSetupState state={setupError} />
      ) : productResult.ok ? (
        <>
          <DashboardBreadcrumbLabel
            label={productResult.product.title ?? productResult.product.handle ?? null}
            labelKey="product-details"
          />
          {optionErrors.length ? <ReferenceDataAlert errors={optionErrors} t={t} /> : null}
          {optionErrors.length ? null : (
            <ProductForm
              action={getTenantScopedPath(
                dashboardRoutes.productUpdateAction(productResult.product.id),
                tenantId,
              )}
              categories={categoriesResult.ok ? categoriesResult.categories : []}
              collections={collectionsResult.ok ? collectionsResult.collections : []}
              product={productResult.product}
              returnHref={getTenantScopedPath(
                dashboardRoutes.productDetail(productResult.product.id),
                tenantId,
              )}
              submitLabel={t("products.edit.saveChanges")}
            />
          )}
        </>
      ) : (
        <ProductLoadAlert state={productErrorState} t={t} />
      )}
    </PageShell>
  );
}

function getReferenceDataError(
  label: string,
  result:
    | Awaited<ReturnType<typeof getMerchantProductCategoriesCached>>
    | Awaited<ReturnType<typeof getMerchantProductCollectionsCached>>,
): ReferenceDataError | null {
  if (result.ok) {
    return null;
  }

  return {
    label,
    state: getListErrorState("products", result.message),
  };
}

function ReferenceDataAlert({
  errors,
  t,
}: {
  errors: ReferenceDataError[];
  t: Translate;
}) {
  const labels = errors.map((error) => error.label).join(` ${t("common.and")} `);

  return (
    <Alert variant="destructive">
      <AlertTitle>{t("products.detail.optionsLoadErrorTitle")}</AlertTitle>
      <AlertDescription>
        {t("products.detail.optionsLoadErrorDesc", { labels })}
      </AlertDescription>
    </Alert>
  );
}

function ProductLoadAlert({
  state,
  t,
}: {
  state: ListErrorState | null;
  t: Translate;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("products.detail.loadErrorTitle")}</AlertTitle>
      <AlertDescription>
        {state?.description ?? t("products.detail.loadErrorDesc")}
      </AlertDescription>
    </Alert>
  );
}
