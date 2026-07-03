import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DASHBOARD_PATH_HEADER,
  getDashboardAuthRedirectPath,
  getMerchantDashboardAccess,
} from "@/lib/dashboard-auth";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { getSidebarDefaultOpen, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-state";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const sidebarDefaultOpen = getSidebarDefaultOpen(cookieStore.get(SIDEBAR_COOKIE_NAME)?.value);
  const currentPath = requestHeaders.get(DASHBOARD_PATH_HEADER) ?? "/admin";
  const tenantId = new URL(currentPath, "http://dashboard.local").searchParams.get("tenantId");
  const access = await getMerchantDashboardAccess({
    getSummary: () =>
      getMerchantDashboardSummary({
        cookieHeader: requestHeaders.get("cookie"),
        platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
        requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
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
          description="This account is signed in, but it does not have access to this merchant dashboard."
          title="Dashboard access denied"
        />
      );
    }

    return (
      <DashboardAccessState
        description="The dashboard could not reach the Platform API. Start the local Platform API or try again when the service is available."
        title="Dashboard temporarily unavailable"
      />
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar actor={access.summary.actor} />
        <SidebarInset>
          <AppHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
