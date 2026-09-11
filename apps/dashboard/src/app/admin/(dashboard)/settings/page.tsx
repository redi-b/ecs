import { headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SettingsWorkspace } from "@/features/settings/settings-workspace";
import { getTranslations } from "@/i18n/server";
import { allows, merchantPolicies } from "@/lib/access-policy";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getMerchantDeliverySettings } from "@/lib/merchant-settings";
import { getMerchantDomains } from "@/lib/platform-api/domains";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { getMerchantPaymentsStatus } from "@/lib/platform-api/payments/client";
import { getStorefrontSeoSettings } from "@/lib/platform-api/storefront/seo";
import { getMerchantTeam } from "@/lib/platform-api/team";
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
  const supportUrl = process.env.MERCHANT_SUPPORT_URL?.trim();
  const supportEmail = process.env.MERCHANT_SUPPORT_EMAIL?.trim();
  const paymentsSupportHref = supportUrl || (supportEmail ? `mailto:${supportEmail}` : null);
  // Settings uses the access shell plus focused settings endpoints.
  const result = await getMerchantDashboardAccessShell({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId: selectedTenantId,
  });
  const [delivery, templates, payments, storefrontSeo, domains, team] =
    result.ok && result.access.tenant.id
      ? await Promise.all([
          allows(result.access.permissions ?? [], merchantPolicies.shopSettings)
            ? getMerchantDeliverySettings({
                cookieHeader: requestHeaders.get("cookie"),
                platformApiBaseUrl,
                tenantId: result.access.tenant.id,
              })
            : null,
          getStorefrontTemplates({
            platformApiBaseUrl,
          }),
          allows(result.access.permissions ?? [], merchantPolicies.paymentsManage)
            ? getMerchantPaymentsStatus({
                cookieHeader: requestHeaders.get("cookie"),
                platformApiBaseUrl,
                requestHost: requestHeaders.get("host"),
              })
            : null,
          allows(result.access.permissions ?? [], merchantPolicies.storefront)
            ? getStorefrontSeoSettings({
                cookieHeader: requestHeaders.get("cookie"),
                platformApiBaseUrl,
                tenantId: result.access.tenant.id,
              })
            : null,
          allows(result.access.permissions ?? [], merchantPolicies.domainsManage)
            ? getMerchantDomains({
                cookieHeader: requestHeaders.get("cookie"),
                platformApiBaseUrl,
                tenantId: result.access.tenant.id,
              })
            : null,
          allows(result.access.permissions ?? [], merchantPolicies.team)
            ? getMerchantTeam({
                cookieHeader: requestHeaders.get("cookie"),
                platformApiBaseUrl,
                requestHost: requestHeaders.get("host"),
              })
            : null,
        ])
      : [null, null, null, null, null, null];

  return (
    <PageShell
      // overflow-x-hidden on PageShell breaks position:sticky for the section nav.
      className="overflow-x-visible"
      title={t("settings.title")}
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("settings.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(result.message, { resource: "Settings" })}
          </AlertDescription>
        </Alert>
      ) : (
        <SettingsWorkspace
          delivery={delivery?.ok ? delivery.delivery : null}
          domains={domains?.ok ? domains.domains : []}
          initialTab={resolvedSearchParams.tab}
          payments={payments?.ok ? payments.payment : null}
          paymentsSupportHref={paymentsSupportHref}
          settingsStatus={resolvedSearchParams.settingsStatus}
          storefrontTemplates={templates?.ok ? templates.templates : []}
          storefrontSeo={
            storefrontSeo?.ok
              ? storefrontSeo.seo
              : { title: null, description: null, socialImageUrl: null }
          }
          templateStatus={resolvedSearchParams.templateStatus}
          team={team?.ok ? team.value : null}
          summary={result.access}
        />
      )}
    </PageShell>
  );
}
