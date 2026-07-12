import { cookies, headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillingWorkspace } from "@/features/billing/billing-workspace";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import {
  billingReturnPaidFlag,
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getMerchantBillingStatus } from "@/lib/merchant-billing";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

type BillingPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedTenantId = getSelectedTenantId(resolvedSearchParams);
  const returnedFromPayment = billingReturnPaidFlag(resolvedSearchParams);
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const requestHeaders = await headers();
  const cookieHeader = (await cookies()).toString();
  const requestHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const platformApiBaseUrl = getPlatformApiBaseUrl(
    process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
  );

  // Lean shell for tenant id + storefront hostname (no ops/metrics).
  // Dedicated billing status for plans/invoices (no Medusa order sampling).
  const accessPromise = getMerchantDashboardAccessShell({
    cookieHeader,
    platformApiBaseUrl,
    requestHost,
    tenantId: selectedTenantId,
  });

  // When tenantId is already known (e.g. Chapa return), confirm + access in parallel.
  const confirmPromise =
    returnedFromPayment && selectedTenantId
      ? fetch(
          new URL(
            `platform/tenants/${encodeURIComponent(selectedTenantId)}/billing/confirm`,
            platformApiBaseUrl,
          ),
          {
            method: "POST",
            headers: {
              accept: "application/json",
              cookie: cookieHeader,
            },
            cache: "no-store",
          },
        ).catch(() => null)
      : Promise.resolve(null);

  const [access] = await Promise.all([accessPromise, confirmPromise]);

  if (!access.ok) {
    return (
      <PageShell description={t("billing.description")} title={t("billing.title")}>
        <Alert variant="destructive">
          <AlertTitle>{t("billing.error.loadTitle")}</AlertTitle>
          <AlertDescription>{mapPlatformErrorMessage(access.message)}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const tenantId = selectedTenantId ?? access.access.tenant.id;

  // Host-only visits still need confirm after access resolves tenant id.
  if (returnedFromPayment && !selectedTenantId && tenantId) {
    try {
      await fetch(
        new URL(
          `platform/tenants/${encodeURIComponent(tenantId)}/billing/confirm`,
          platformApiBaseUrl,
        ),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            cookie: cookieHeader,
          },
          cache: "no-store",
        },
      );
    } catch {
      // Non-blocking.
    }
  }

  const result = await getMerchantBillingStatus({
    cookieHeader,
    platformApiBaseUrl,
    tenantId,
  });

  return (
    <PageShell description={t("billing.description")} title={t("billing.title")}>
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("billing.error.loadTitle")}</AlertTitle>
          <AlertDescription>{mapPlatformErrorMessage(result.message)}</AlertDescription>
        </Alert>
      ) : (
        <BillingWorkspace
          billing={result.billing}
          billingPath={getTenantScopedPath("/admin/billing", tenantId)}
          returnedFromPayment={returnedFromPayment}
          storefrontHostname={access.access.domain.hostname}
          tenantId={tenantId}
        />
      )}
    </PageShell>
  );
}
