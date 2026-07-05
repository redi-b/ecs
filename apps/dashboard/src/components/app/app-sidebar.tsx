"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/app/account-menu";
import { AppIcons } from "@/components/app/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { type AppRoute, appRoutes } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

function isRouteActive(pathname: string, route: AppRoute) {
  if (route.href === dashboardRoutes.overview) {
    return pathname === dashboardRoutes.overview;
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

function isProductListActive(pathname: string) {
  if (pathname === dashboardRoutes.products || pathname === dashboardRoutes.productsNew) {
    return true;
  }

  if (
    pathname === dashboardRoutes.productCategories ||
    pathname.startsWith(`${dashboardRoutes.productCategories}/`) ||
    pathname === dashboardRoutes.productCollections ||
    pathname.startsWith(`${dashboardRoutes.productCollections}/`) ||
    pathname.startsWith(`${dashboardRoutes.products}/actions/`)
  ) {
    return false;
  }

  return pathname.startsWith(`${dashboardRoutes.products}/`);
}

function isChildRouteActive(pathname: string, route: AppRoute) {
  if (route.href === dashboardRoutes.products) {
    return isProductListActive(pathname);
  }

  return isRouteActive(pathname, route);
}

export function AppSidebar({ actor }: { actor: MerchantDashboardSummary["actor"] }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="ECS" className="rounded-xl">
              <Link href={dashboardRoutes.overview}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  E
                </span>
                <span className="truncate font-semibold">ECS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel>Merchant</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {appRoutes.map((route) => {
                const Icon = route.icon;
                const active = isRouteActive(pathname, route);
                const content = (
                  <>
                    <Icon />
                    <span>{route.title}</span>
                  </>
                );

                if (route.children?.length) {
                  const ChevronIcon = AppIcons.arrowDown;

                  return (
                    <Collapsible
                      key={route.id}
                      asChild
                      defaultOpen={active}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={route.title}
                            className="rounded-xl"
                          >
                            {content}
                            <ChevronIcon className="ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                          <SidebarMenuSub>
                            {route.children.map((child) => (
                              <SidebarMenuSubItem key={child.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isChildRouteActive(pathname, child)}
                                >
                                  <Link href={child.href}>{child.title}</Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={route.id}>
                    {route.disabled ? (
                      <SidebarMenuButton
                        disabled
                        isActive={false}
                        tooltip={route.title}
                        className="rounded-xl"
                      >
                        {content}
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={route.title}
                        className="rounded-xl"
                      >
                        <Link href={route.href}>{content}</Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <AccountMenu actor={actor} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
