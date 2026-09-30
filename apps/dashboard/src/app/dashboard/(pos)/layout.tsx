import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccessProvider } from "@/components/app/access-context";
import { ActorProvider } from "@/components/app/actor-context";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import { DashboardRouteBoundary } from "@/components/app/dashboard-route-boundary";
import { SupportAccessBanner } from "@/components/app/support-access-banner";
import { CalendarPreferenceProvider } from "@/components/providers/calendar-preference-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTranslations } from "@/i18n/server";
import {
  DASHBOARD_PATH_HEADER,
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
} from "@/lib/dashboard-auth";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { getCentralDashboardUrl } from "@/lib/shop-host";
import { resolveShopDestination } from "@/lib/shop-selection";

export default async function QuickSaleLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get(DASHBOARD_PATH_HEADER) ?? "/dashboard/pos";
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const tenantId = new URL(currentPath, "http://dashboard.local").searchParams.get("tenantId");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";

  if (isCentralDashboardHost(requestHost)) {
    const onboarding = await getPlatformOnboardingState({
      cookieHeader: requestHeaders.get("cookie"),
      platformApiBaseUrl,
    });

    if (!onboarding.ok) {
      if (onboarding.status === 401) redirect(getDashboardAuthRedirectPath(currentPath));
      return (
        <DashboardAccessState
          description={t("common.access.loadFailedDesc")}
          title={t("common.access.loadFailedTitle")}
        />
      );
    }

    redirect(
      resolveShopDestination({
        protocol: requestHeaders.get("x-forwarded-proto") ?? "http",
        state: onboarding.state,
      }).href,
    );
  }

  const access = await getMerchantDashboardAccess({
    getAccess: () =>
      getMerchantDashboardAccessShell({
        cookieHeader: requestHeaders.get("cookie"),
        platformApiBaseUrl,
        requestHost,
        tenantId: getSelectedTenantId({ tenantId: tenantId ?? undefined }),
      }),
  });

  if (!access.ok) {
    if (access.kind === "unauthenticated") redirect(getDashboardAuthRedirectPath(currentPath));
    if (access.kind === "shop_not_found" || access.kind === "forbidden") {
      return (
        <DashboardAccessState
          actionHref={getCentralDashboardUrl("/sign-in")}
          actionLabel={t(
            access.kind === "shop_not_found"
              ? "auth.shopMissing.cta"
              : "common.access.goToYourDashboard",
          )}
          description={t(
            access.kind === "shop_not_found"
              ? "auth.shopMissing.description"
              : "common.access.deniedDesc",
          )}
          title={t(
            access.kind === "shop_not_found"
              ? "auth.shopMissing.title"
              : "common.access.deniedTitle",
          )}
        />
      );
    }
    return (
      <DashboardAccessState
        description={t("common.access.unavailableDesc")}
        title={t("common.access.unavailableTitle")}
      />
    );
  }

  return (
    <CalendarPreferenceProvider
      initialPreference={access.access.actor.calendarPreference ?? "follow-language"}
    >
      <TooltipProvider>
        <ActorProvider actor={access.access.actor}>
          <AccessProvider access={access.access}>
            <div className="min-h-dvh bg-background text-foreground" data-pos-mode>
              {access.access.actor.supportAccess ? (
                <SupportAccessBanner expiresAt={access.access.actor.supportAccess.expiresAt} />
              ) : null}
              <DashboardRouteBoundary>{children}</DashboardRouteBoundary>
            </div>
          </AccessProvider>
        </ActorProvider>
      </TooltipProvider>
    </CalendarPreferenceProvider>
  );
}
