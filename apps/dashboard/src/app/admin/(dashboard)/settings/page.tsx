import { headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SettingsWorkspace } from "@/features/settings/settings-workspace";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { getMerchantDeliverySettings } from "@/lib/merchant-settings";
import { getStorefrontTemplates } from "@/lib/storefront-templates";

type SettingsPageProps = {
  searchParams?: Promise<
    DashboardSearchParams & { settingsStatus?: string; tab?: string; templateStatus?: string }
  >;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedTenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const result = await getMerchantDashboardSummary({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId: selectedTenantId,
  });
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const [delivery, templates] =
    result.ok && result.summary.tenant.id
      ? await Promise.all([
          getMerchantDeliverySettings({
            cookieHeader: requestHeaders.get("cookie"),
            platformApiBaseUrl,
            tenantId: result.summary.tenant.id,
          }),
          getStorefrontTemplates({
            platformApiBaseUrl,
          }),
        ])
      : [null, null];

  return (
    <PageShell
      description="Manage shop address, checkout fulfillment, storefront status, and account details."
      title="Settings"
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Settings could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : (
        <SettingsWorkspace
          delivery={delivery?.ok ? delivery.delivery : null}
          initialTab={resolvedSearchParams.tab}
          settingsStatus={resolvedSearchParams.settingsStatus}
          storefrontTemplates={templates?.ok ? templates.templates : []}
          templateStatus={resolvedSearchParams.templateStatus}
          summary={result.summary}
        />
      )}
    </PageShell>
  );
}
