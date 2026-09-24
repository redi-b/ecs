import { cookies, headers } from "next/headers";
import { PermissionGate } from "@/components/app/access-context";
import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductDeleteButton, ProductDetail } from "@/features/products/product-detail";
import { ProductStockPanel } from "@/features/products/product-stock-panel";
import { getTranslations } from "@/i18n/server";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getMerchantProduct, getMerchantProductStock } from "@/lib/merchant-products";
import { getStorefrontDraft } from "@/lib/platform-api/storefront/templates";
import { dashboardRoutes } from "@/lib/routes";
import { getAllStorefrontTranslationReadiness } from "@/lib/storefront-translation-readiness";

type MerchantProductDetailPageProps = {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductDetailPage({
  params,
  searchParams,
}: MerchantProductDetailPageProps) {
  const t = await getTranslations();
  const [{ productId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tenantId = getSelectedTenantId(resolvedSearchParams ?? {});
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const requestOptions = {
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId,
  };
  // Product + stock only. Categories/collections resolve client-side for org labels
  // and the organization edit dialog (shared react-query cache with list page).
  const [productResult, stockResult, access] = await Promise.all([
    getMerchantProduct({
      ...requestOptions,
      productId,
    }),
    getMerchantProductStock({
      ...requestOptions,
      productId,
    }),
    getMerchantDashboardAccessShell(requestOptions),
  ]);
  const storefrontDraft = access.ok
    ? await getStorefrontDraft({
        cookieHeader: requestOptions.cookieHeader,
        platformApiBaseUrl,
        tenantId: access.access.tenant.id,
      })
    : null;
  const translationQueue =
    resolvedSearchParams?.translationFrom === "workspace"
      ? await getAllStorefrontTranslationReadiness({
          ...requestOptions,
          resourceType: "product",
        })
      : null;
  const productErrorState = productResult.ok
    ? null
    : getListErrorState("products", productResult.message);
  const setupError =
    productErrorState?.kind === "setup" || productErrorState?.kind === "service"
      ? productErrorState
      : null;

  return (
    <PageShell
      actions={
        <div className="flex items-center gap-2">
          {productResult.ok ? (
            <PermissionGate permission="products.delete">
              <ProductDeleteButton
                productId={productResult.product.id}
                productTitle={productResult.product.title ?? t("products.detail.thisProduct")}
                tenantId={tenantId}
              />
            </PermissionGate>
          ) : null}
          <RefreshButton />
        </div>
      }
      title={
        productResult.ok
          ? (productResult.product.title ?? t("products.detail.shellTitle"))
          : t("products.detail.shellTitle")
      }
    >
      {setupError ? (
        <ListSetupState state={setupError} />
      ) : productResult.ok ? (
        <>
          <DashboardBreadcrumbLabel
            label={productResult.product.title ?? productResult.product.handle ?? null}
            labelKey="product-details"
          />
          <ProductDetail
            action={getTenantScopedPath(
              dashboardRoutes.productUpdateAction(productResult.product.id),
              tenantId,
            )}
            product={productResult.product}
            tenantId={tenantId}
            translationsEnabled={
              storefrontDraft?.ok === true &&
              storefrontDraft.draft.languageSettings.enabledLocales.includes("am")
            }
            translationOpen={resolvedSearchParams?.translate === "am"}
            translationQueueNavigation={translationQueueNavigation(
              translationQueue?.ok ? translationQueue.queue.items : [],
              productId,
            )}
          />
          <ProductStockPanel
            action={getTenantScopedPath(
              dashboardRoutes.productStockAction(productResult.product.id),
              tenantId,
            )}
            initialStock={stockResult.ok ? stockResult.stock : undefined}
            product={productResult.product}
            productId={productResult.product.id}
            stockError={stockResult.ok ? undefined : stockResult.message}
            tenantId={tenantId}
          />
        </>
      ) : (
        <ProductLoadAlert state={productErrorState} />
      )}
    </PageShell>
  );
}

function translationQueueNavigation(
  items: Array<{ resourceId: string; status: "needs_review" | "ready" | "using_english" }>,
  productId: string,
) {
  const unfinished = items.filter((item) => item.status !== "ready");
  const index = unfinished.findIndex((item) => item.resourceId === productId);
  if (index < 0) return undefined;
  const href = (id: string) =>
    `/dashboard/products/${encodeURIComponent(id)}?translate=am&translationFrom=workspace`;
  const previousItem = unfinished[index - 1];
  const nextItem = unfinished[index + 1];
  const previous = previousItem ? href(previousItem.resourceId) : undefined;
  const next = nextItem ? href(nextItem.resourceId) : undefined;
  return previous || next ? { next, previous } : undefined;
}

async function ProductLoadAlert({ state }: { state: ListErrorState | null }) {
  const t = await getTranslations();
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("products.detail.loadErrorTitle")}</AlertTitle>
      <AlertDescription>
        {state?.description ?? t("products.detail.loadErrorDesc")}
      </AlertDescription>
    </Alert>
  );
}
