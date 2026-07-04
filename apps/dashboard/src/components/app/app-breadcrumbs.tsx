"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getDashboardBreadcrumbTrail } from "@/lib/dashboard-breadcrumbs";
import { dashboardRoutes } from "@/lib/routes";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const labels = useBreadcrumbLabels();
  const trail = getDashboardBreadcrumbTrail(pathname, labels);
  const currentRoute = trail.at(-1);

  if (!currentRoute || currentRoute.href === dashboardRoutes.overview || trail.length === 1) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{currentRoute?.title ?? "Dashboard"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {trail.slice(0, -1).map((route) => (
          <BreadcrumbItem className="hidden sm:inline-flex" key={route.id}>
            <BreadcrumbLink asChild>
              <Link href={route.href}>{route.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        ))}
        <BreadcrumbSeparator className="hidden sm:inline-flex" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{currentRoute.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
