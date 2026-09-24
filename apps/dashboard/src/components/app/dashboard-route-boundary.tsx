"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAccess } from "@/components/app/access-context";
import { DashboardPageAccessState } from "@/components/app/dashboard-page-access-state";
import { useI18n } from "@/i18n/provider";
import {
  canAccessDashboardRoute,
  getDashboardRouteRequirement,
  getFirstPermittedDashboardHref,
} from "@/lib/dashboard-route-access";

export function DashboardRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions } = useAccess();
  const { t } = useI18n();
  const requirement = getDashboardRouteRequirement(pathname);

  // Unknown paths continue to Next's not-found handling. Known dashboard pages
  // share this live, client-aware authorization boundary.
  if (!requirement || canAccessDashboardRoute(pathname, permissions)) return children;

  return (
    <DashboardPageAccessState
      actionHref={getFirstPermittedDashboardHref([...permissions])}
      actionLabel={t("common.access.openAvailablePage")}
      description={t("common.access.pageDeniedDesc")}
      title={t("common.access.pageDeniedTitle")}
    />
  );
}
