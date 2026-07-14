import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ActorProvider } from "@/components/app/actor-context";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BreadcrumbLabelsProvider } from "@/components/app/breadcrumb-labels";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DASHBOARD_PATH_HEADER,
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
} from "@/lib/dashboard-auth";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { getSidebarDefaultOpen, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-state";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const sidebarDefaultOpen = getSidebarDefaultOpen(cookieStore.get(SIDEBAR_COOKIE_NAME)?.value);
  const currentPath = requestHeaders.get(DASHBOARD_PATH_HEADER) ?? "/admin";
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
          description="We could not load your account workspace. Try again in a moment."
          title="Dashboard could not be loaded"
        />
      );
    }

    if (!onboarding.state.primaryTenant) {
      redirect("/admin/onboarding");
    }

    redirect(onboarding.state.primaryTenant.dashboardUrl);
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

    if (access.kind === "forbidden") {
      return (
        <DashboardAccessState
          actionHref="/admin/sign-in"
          actionLabel="Use another account"
          description="This account does not have access to this shop."
          title="Dashboard access denied"
        />
      );
    }

    return (
      <DashboardAccessState
        description="We could not load this dashboard. Try again in a moment."
        title="Dashboard temporarily unavailable"
      />
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <ActorProvider actor={access.access.actor}>
          <AppSidebar actor={access.access.actor} />
          <SidebarInset>
            <BreadcrumbLabelsProvider>
              <AppHeader />
              {children}
            </BreadcrumbLabelsProvider>
          </SidebarInset>
        </ActorProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
