import type { LaunchReadiness } from "@ecs/contracts";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccessProvider } from "@/components/app/access-context";
import { ActivityDock } from "@/components/app/activity-dock";
import { ActivityRegistryProvider } from "@/components/app/activity-registry";
import { ActorProvider } from "@/components/app/actor-context";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BackgroundTaskCenter } from "@/components/app/background-task-center";
import { BreadcrumbLabelsProvider } from "@/components/app/breadcrumb-labels";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import { DashboardRouteBoundary } from "@/components/app/dashboard-route-boundary";
import { OnboardingWarningToast } from "@/components/app/onboarding-warning-toast";
import { SupportAccessBanner } from "@/components/app/support-access-banner";
import { CalendarPreferenceProvider } from "@/components/providers/calendar-preference-provider";
import { CatalogLabelLocaleProvider } from "@/components/providers/catalog-label-locale-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MediaUploadHost } from "@/features/media/media-upload-host";
import { LaunchAssistant } from "@/features/overview/launch-assistant";
import { getTranslations } from "@/i18n/server";
import { allows, merchantPolicies } from "@/lib/access-policy";
import { parseCatalogLabelLocaleCookie } from "@/lib/catalog-label-locale";
import {
  DASHBOARD_PATH_HEADER,
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
} from "@/lib/dashboard-auth";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getLaunchAssistantCookieName } from "@/lib/launch-assistant-preferences";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getPlatformLaunchReadiness } from "@/lib/platform-api/launch-readiness";
import { getStorefrontDraft } from "@/lib/platform-api/storefront/templates";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { getCentralDashboardUrl } from "@/lib/shop-host";
import { resolveShopDestination } from "@/lib/shop-selection";
import { getSidebarDefaultOpen, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-state";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const sidebarDefaultOpen = getSidebarDefaultOpen(cookieStore.get(SIDEBAR_COOKIE_NAME)?.value);
  const currentPath = requestHeaders.get(DASHBOARD_PATH_HEADER) ?? "/dashboard";
  const tenantId = new URL(currentPath, "http://dashboard.local").searchParams.get("tenantId");
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";

  if (isCentralDashboardHost(requestHost)) {
    const onboarding = await getPlatformOnboardingState({
      cookieHeader: requestHeaders.get("cookie"),
      platformApiBaseUrl,
    });

    if (!onboarding.ok) {
      if (onboarding.status === 401) {
        redirect(getDashboardAuthRedirectPath(currentPath));
      }

      return (
        <DashboardAccessState
          description={t("common.access.loadFailedDesc")}
          title={t("common.access.loadFailedTitle")}
        />
      );
    }

    const destination = resolveShopDestination({
      lastShopId: cookieStore.get("ecs_last_shop")?.value ?? null,
      protocol: requestHeaders.get("x-forwarded-proto") ?? "http",
      state: onboarding.state,
    });
    redirect(destination.href);
  }

  // Lean shell only — never load ops/metrics/billing for the chrome.
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
    if (access.kind === "unauthenticated") {
      redirect(getDashboardAuthRedirectPath(currentPath));
    }

    if (access.kind === "shop_not_found") {
      return (
        <DashboardAccessState
          actionHref={getCentralDashboardUrl("/sign-in")}
          actionLabel={t("auth.shopMissing.cta")}
          description={t("auth.shopMissing.description")}
          title={t("auth.shopMissing.title")}
        />
      );
    }

    if (access.kind === "forbidden") {
      return (
        <DashboardAccessState
          actionHref={getCentralDashboardUrl("/sign-in")}
          actionLabel={t("common.access.goToYourDashboard")}
          description={t("common.access.deniedDesc")}
          title={t("common.access.deniedTitle")}
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

  let initialReadiness: LaunchReadiness | null = null;
  const canCompleteSetup = allows(access.access.permissions ?? [], merchantPolicies.launchSetup);
  const initialHidden =
    cookieStore.get(getLaunchAssistantCookieName(access.access.tenant.id))?.value === "true";

  if (canCompleteSetup && !initialHidden) {
    initialReadiness = await getPlatformLaunchReadiness({
      cookieHeader: requestHeaders.get("cookie"),
      platformApiBaseUrl,
      requestHost,
      tenantId: access.access.tenant.id,
    });
  }

  const storefrontDraft = await getStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    tenantId: access.access.tenant.id,
  });
  const amharicEnabled =
    !storefrontDraft.ok || storefrontDraft.draft.languageSettings.enabledLocales.includes("am");
  const catalogLabelLocale = parseCatalogLabelLocaleCookie(
    cookieStore.get("ecs_catalog_label_locale")?.value,
  );

  return (
    <CalendarPreferenceProvider
      initialPreference={access.access.actor.calendarPreference ?? "follow-language"}
    >
      <TooltipProvider>
        <SidebarProvider defaultOpen={sidebarDefaultOpen}>
          <ActorProvider actor={access.access.actor}>
            <AccessProvider access={access.access}>
              <AppSidebar
                access={access.access}
                centralDashboardUrl={getCentralDashboardUrl("").replace(/\/$/, "")}
              />
              <SidebarInset>
                {access.access.actor.supportAccess ? (
                  <SupportAccessBanner expiresAt={access.access.actor.supportAccess.expiresAt} />
                ) : null}
                <CatalogLabelLocaleProvider
                  amharicEnabled={amharicEnabled}
                  initialMode={catalogLabelLocale}
                >
                  <BreadcrumbLabelsProvider>
                    <AppHeader />
                    <OnboardingWarningToast />
                    <DashboardRouteBoundary>{children}</DashboardRouteBoundary>
                    <LaunchAssistant
                      access={access.access}
                      initialHidden={initialHidden}
                      initialReadiness={initialReadiness}
                    />
                    <ActivityRegistryProvider>
                      <BackgroundTaskCenter />
                      <MediaUploadHost />
                      <ActivityDock />
                    </ActivityRegistryProvider>
                  </BreadcrumbLabelsProvider>
                </CatalogLabelLocaleProvider>
              </SidebarInset>
            </AccessProvider>
          </ActorProvider>
        </SidebarProvider>
      </TooltipProvider>
    </CalendarPreferenceProvider>
  );
}
