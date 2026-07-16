import { cookies, headers } from "next/headers";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { AppIcons } from "@/components/app/icons";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { OrderDetail } from "@/features/orders/order-detail";
import { formatOrderReference } from "@/features/orders/order-domain";
import { getTranslations } from "@/i18n/server";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
import { getMerchantOrder } from "@/lib/merchant-orders";
import { dashboardRoutes } from "@/lib/routes";

type MerchantOrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantOrderDetailPage({
  params,
  searchParams,
}: MerchantOrderDetailPageProps) {
  const t = await getTranslations();
  const [{ orderId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tenantId = getSelectedTenantId(resolvedSearchParams ?? {});
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await getMerchantOrder({
    cookieHeader: cookieStore.toString(),
    orderId,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const errorState = result.ok ? null : getListErrorState("orders", result.message);
  const setupError =
    errorState?.kind === "setup" || errorState?.kind === "service" ? errorState : null;
  const breadcrumbLabel = result.ok ? formatOrderReference(result.order) : null;

  return (
    <PageShell
      actions={<RefreshButton />}
      description={t("orders.detail.shellDescription")}
      title={
        result.ok
          ? `${t("table.headers.order")} ${formatOrderReference(result.order)}`
          : t("orders.detail.shellTitle")
      }
    >
      <DashboardBreadcrumbLabel label={breadcrumbLabel} labelKey="order-details" />
      {setupError ? (
        <ListSetupState state={setupError} />
      ) : result.ok ? (
        <OrderDetail
          action={getTenantScopedPath(dashboardRoutes.orderAction(result.order.id), tenantId)}
          order={result.order}
          tenantId={tenantId}
        />
      ) : result.message === "order_not_found" || result.status === 404 ? (
        <OrderNotFoundState />
      ) : (
        <OrderLoadAlert />
      )}
    </PageShell>
  );
}

async function OrderNotFoundState() {
  const t = await getTranslations();
  return (
    <Empty className="min-h-[22rem] border bg-card/60">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AppIcons.orders />
        </EmptyMedia>
        <EmptyTitle>{t("orders.detail.notFoundTitle")}</EmptyTitle>
        <EmptyDescription>{t("orders.detail.notFoundDesc")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

async function OrderLoadAlert() {
  const t = await getTranslations();
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("orders.detail.loadErrorTitle")}</AlertTitle>
      <AlertDescription>{t("orders.detail.loadErrorDesc")}</AlertDescription>
    </Alert>
  );
}
