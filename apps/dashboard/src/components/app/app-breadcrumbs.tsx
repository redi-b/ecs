"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { findRouteByHref } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const route = findRouteByHref(pathname);

  if (!route || route.href === dashboardRoutes.overview) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <Link href={dashboardRoutes.overview}>Overview</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:inline-flex" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{route.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
