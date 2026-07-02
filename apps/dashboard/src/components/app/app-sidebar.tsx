"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/app/account-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { appRoutes, type AppRoute } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

function isRouteActive(pathname: string, route: AppRoute) {
  if (route.href === dashboardRoutes.overview) {
    return pathname === dashboardRoutes.overview;
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="ECS">
              <Link href={dashboardRoutes.overview}>
                <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                  E
                </span>
                <span className="font-semibold">ECS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Merchant</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appRoutes.map((route) => {
                const Icon = route.icon;

                return (
                  <SidebarMenuItem key={route.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isRouteActive(pathname, route)}
                      tooltip={route.title}
                    >
                      <Link href={route.href}>
                        <Icon />
                        <span>{route.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
