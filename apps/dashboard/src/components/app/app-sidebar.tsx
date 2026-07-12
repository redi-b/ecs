"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { AccountMenu } from "@/components/app/account-menu";
import { AppIcons } from "@/components/app/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  type AppRoute,
  appRouteSections,
  getAppRoutesBySection,
  getFooterAppRoutes,
} from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

function isRouteActive(pathname: string, route: AppRoute) {
  if (route.href === dashboardRoutes.overview) {
    return pathname === dashboardRoutes.overview;
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

function isProductListActive(pathname: string) {
  if (pathname === dashboardRoutes.products) {
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

function NavRouteItem({ pathname, route }: { pathname: string; route: AppRoute }) {
  const { isMobile, state } = useSidebar();
  const Icon = route.icon;
  const active = isRouteActive(pathname, route);
  const collapsed = state === "collapsed" && !isMobile;

  if (route.children?.length) {
    // Icon rail hides collapsible subtrees — open nested links in a flyout instead.
    if (collapsed) {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="rounded-xl" isActive={active} tooltip={route.title}>
                <Icon />
                <span>{route.title}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-48 rounded-xl"
              side="right"
              sideOffset={8}
            >
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {route.title}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {route.children.map((child) => (
                <DropdownMenuItem asChild key={child.id}>
                  <Link href={child.href}>{child.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    const ChevronIcon = AppIcons.arrowDown;

    return (
      <Collapsible asChild className="group/collapsible" defaultOpen={active}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="rounded-xl" isActive={active} tooltip={route.title}>
              <Icon />
              <span>{route.title}</span>
              <ChevronIcon className="ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenuSub>
              {route.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton asChild isActive={isChildRouteActive(pathname, child)}>
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
    <SidebarMenuItem>
      {route.disabled ? (
        <SidebarMenuButton className="rounded-xl" disabled isActive={false} tooltip={route.title}>
          <Icon />
          <span>{route.title}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton asChild className="rounded-xl" isActive={active} tooltip={route.title}>
          <Link href={route.href}>
            <Icon />
            <span>{route.title}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

function RouteGroup({
  label,
  pathname,
  routes,
  showSeparator,
}: {
  label: string | null;
  pathname: string;
  routes: AppRoute[];
  showSeparator: boolean;
}) {
  if (!routes.length) return null;

  return (
    <Fragment>
      {showSeparator ? (
        <SidebarSeparator className="mx-3 my-1 group-data-[collapsible=icon]:mx-2" />
      ) : null}
      <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-2">
        {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {routes.map((route) => (
              <NavRouteItem key={route.id} pathname={pathname} route={route} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </Fragment>
  );
}

export function AppSidebar({ actor }: { actor: MerchantDashboardSummary["actor"] }) {
  const pathname = usePathname();
  const footerRoutes = getFooterAppRoutes();
  let renderedGroups = 0;

  return (
    <Sidebar className="border-r" collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="rounded-xl" size="lg" tooltip="ECS">
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
        {appRouteSections.map((section) => {
          const routes = getAppRoutesBySection(section.id);
          if (!routes.length) return null;
          const showSeparator = renderedGroups > 0;
          renderedGroups += 1;
          return (
            <RouteGroup
              key={section.id}
              label={section.label}
              pathname={pathname}
              routes={routes}
              showSeparator={showSeparator}
            />
          );
        })}
      </SidebarContent>

      <SidebarFooter className="gap-1 p-3 group-data-[collapsible=icon]:p-2">
        {footerRoutes.length ? (
          <>
            <SidebarSeparator className="mx-0 mb-1" />
            <SidebarMenu className="gap-1">
              {footerRoutes.map((route) => (
                <NavRouteItem key={route.id} pathname={pathname} route={route} />
              ))}
            </SidebarMenu>
          </>
        ) : null}
        <AccountMenu actor={actor} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
