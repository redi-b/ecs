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
import { appRoutes } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const trail =
    appRoutes
      .flatMap((item) => {
        const children = item.children ?? [];
        return [
          { route: item, trail: [item] },
          ...children.map((child) => ({ route: child, trail: [item, child] })),
        ];
      })
      .filter(({ route }) => pathname === route.href || pathname.startsWith(`${route.href}/`))
      .sort((a, b) => b.route.href.length - a.route.href.length)[0]?.trail ?? [];
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
