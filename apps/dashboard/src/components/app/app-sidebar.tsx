"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/app/account-menu";
import { AppIcons } from "@/components/app/icons";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { type AppRoute, appRouteSections, getAppRoutesBySection } from "@/lib/navigation";
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

function useCloseMobileSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();

  return () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
}

function getRouteLocalizationKey(id: string): MessageKey {
  const camelCased = id.replace(/-([a-z])/g, (_, letter: string | undefined) =>
    letter ? letter.toUpperCase() : "",
  );
  return `nav.${camelCased}` as MessageKey;
}

function NavRouteItem({ pathname, route }: { pathname: string; route: AppRoute }) {
  const { isMobile, state } = useSidebar();
  const closeMobileSidebar = useCloseMobileSidebar();
  const { t } = useI18n();
  const Icon = route.icon;
  const active = isRouteActive(pathname, route);
  const collapsed = state === "collapsed" && !isMobile;

  const localizedTitle = t(getRouteLocalizationKey(route.id)) || route.title;

  if (route.children?.length) {
    // Icon rail hides collapsible subtrees — open nested links in a flyout instead.
    if (collapsed) {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="rounded-xl" isActive={active} tooltip={localizedTitle}>
                <Icon />
                <span>{localizedTitle}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-48 rounded-xl"
              side="right"
              sideOffset={8}
            >
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {localizedTitle}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {route.children.map((child) => (
                <DropdownMenuItem asChild key={child.id}>
                  <Link href={child.href} onClick={closeMobileSidebar} prefetch={false}>
                    {t(getRouteLocalizationKey(child.id)) || child.title}
                  </Link>
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
            <SidebarMenuButton className="rounded-xl" isActive={active} tooltip={localizedTitle}>
              <Icon />
              <span>{localizedTitle}</span>
              <ChevronIcon className="ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenuSub>
              {route.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton asChild isActive={isChildRouteActive(pathname, child)}>
                    <Link href={child.href} onClick={closeMobileSidebar} prefetch={false}>
                      {t(getRouteLocalizationKey(child.id)) || child.title}
                    </Link>
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
        <SidebarMenuButton className="rounded-xl" disabled isActive={false} tooltip={localizedTitle}>
          <Icon />
          <span>{localizedTitle}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton asChild className="rounded-xl" isActive={active} tooltip={localizedTitle}>
          <Link href={route.href} onClick={closeMobileSidebar} prefetch={false}>
            <Icon />
            <span>{localizedTitle}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar({ actor }: { actor: MerchantDashboardSummary["actor"] }) {
  const pathname = usePathname();
  const closeMobileSidebar = useCloseMobileSidebar();
  const { t } = useI18n();

  return (
    <Sidebar className="border-r" collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="rounded-xl" size="lg" tooltip="ECS">
              <Link href={dashboardRoutes.overview} onClick={closeMobileSidebar} prefetch={false}>
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

          return (
            <SidebarGroup
              className="px-3 group-data-[collapsible=icon]:px-2"
              key={section.id}
            >
              {section.label ? (
                <SidebarGroupLabel>
                  {t(`nav.section.${section.id}` as MessageKey) || section.label}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {routes.map((route) => (
                    <NavRouteItem key={route.id} pathname={pathname} route={route} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <AccountMenu actor={actor} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
