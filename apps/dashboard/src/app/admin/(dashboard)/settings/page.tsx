import { headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SettingsWorkspace } from "@/features/settings/settings-workspace";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
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
  const t = await getTranslations();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  // Settings only needs tenant/domain/actor/storefront — not ops/metrics/billing.
  const result = await getMerchantDashboardAccessShell({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId: selectedTenantId,
  });
  const [delivery, templates] =
    result.ok && result.access.tenant.id
      ? await Promise.all([
          getMerchantDeliverySettings({
            cookieHeader: requestHeaders.get("cookie"),
            platformApiBaseUrl,
            tenantId: result.access.tenant.id,
          }),
          getStorefrontTemplates({
            platformApiBaseUrl,
          }),
        ])
      : [null, null];

  return (
    <PageShell
      description={t("settings.description")}
      title={t("settings.title")}
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("settings.error.loadTitle")}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : (
        <SettingsWorkspace
          delivery={delivery?.ok ? delivery.delivery : null}
          initialTab={resolvedSearchParams.tab}
          settingsStatus={resolvedSearchParams.settingsStatus}
          storefrontTemplates={templates?.ok ? templates.templates : []}
          templateStatus={resolvedSearchParams.templateStatus}
          summary={result.access}
        />
      )}
    </PageShell>
  );
}
