import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CustomerDetail, CustomerDetailPageActions } from "@/features/customers/customer-detail";
import { getTranslations } from "@/i18n/server";
import { getListErrorState } from "@/lib/list-error-state";
import { getMerchantCustomer } from "@/lib/merchant-customers";
import { getMerchantOrders } from "@/lib/merchant-orders";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const t = await getTranslations();
  const { customerId } = await params;
  const h = await headers();
  const requestContext = {
    cookieHeader: h.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: h.get("host"),
  };
  const result = await getMerchantCustomer(requestContext, customerId);
  if (!result.ok) {
    if (result.message === "customer_not_found" || result.status === 404) {
      notFound();
    }
    const errorState = getListErrorState("customers", result.message);
    return (
      <PageShell actions={<RefreshButton />} title={t("customers.title")}>
        {errorState.kind === "setup" || errorState.kind === "service" ? (
          <ListSetupState state={errorState} />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>{errorState.title}</AlertTitle>
            <AlertDescription>{errorState.description}</AlertDescription>
          </Alert>
        )}
      </PageShell>
    );
  }

  const customer = result.customer;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  const ordersResult = await getMerchantOrders({
    ...requestContext,
    customerId: customer.id,
    limit: 8,
    offset: 0,
  });
  const customerOrders = ordersResult.ok ? ordersResult.orders.orders : [];
  const customerOrdersCount = ordersResult.ok ? ordersResult.orders.count : 0;

  return (
    <PageShell actions={<CustomerDetailPageActions customer={customer} />} title={name}>
      <DashboardBreadcrumbLabel label={name} labelKey="customer-details" />
      <CustomerDetail
        customer={customer}
        loadOrdersFailed={!ordersResult.ok}
        orders={customerOrders}
        ordersTotalCount={customerOrdersCount}
      />
    </PageShell>
  );
}
