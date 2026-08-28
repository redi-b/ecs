"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/app/account-menu";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
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
import { getDemoSidebarRoute } from "@/features/demo/dashboard-demo-routes";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { type AppRoute, appRouteSections, getAppRoutesBySection } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

function isRouteActive(pathname: string, route: AppRoute) {
  if (route.id === "overview") {
    return pathname === route.href;
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
  const tooltip = route.disabled
    ? `${localizedTitle} · ${t("overview.demo.fullDashboard")}`
    : localizedTitle;

  if (route.children?.length) {
    // Icon rail hides collapsible subtrees — open nested links in a flyout instead.
    if (collapsed) {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="rounded-lg" isActive={active} tooltip={localizedTitle}>
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
                <DropdownMenuItem
                  asChild={!child.disabled}
                  disabled={Boolean(child.disabled)}
                  key={child.id}
                >
                  {child.disabled ? (
                    <span>{t(getRouteLocalizationKey(child.id)) || child.title}</span>
                  ) : (
                    <Link href={child.href} onClick={closeMobileSidebar} prefetch={false}>
                      {t(getRouteLocalizationKey(child.id)) || child.title}
                    </Link>
                  )}
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
            <SidebarMenuButton className="rounded-lg" isActive={active} tooltip={localizedTitle}>
              <Icon />
              <span>{localizedTitle}</span>
              <ChevronIcon className="ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenuSub>
              {route.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild={!child.disabled}
                    isActive={!child.disabled && isChildRouteActive(pathname, child)}
                  >
                    {child.disabled ? (
                      <span aria-disabled="true" className="cursor-not-allowed opacity-50">
                        {t(getRouteLocalizationKey(child.id)) || child.title}
                      </span>
                    ) : (
                      <Link href={child.href} onClick={closeMobileSidebar} prefetch={false}>
                        {t(getRouteLocalizationKey(child.id)) || child.title}
                      </Link>
                    )}
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
        <SidebarMenuButton className="rounded-lg" disabled isActive={false} tooltip={tooltip}>
          <Icon />
          <span>{localizedTitle}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          asChild
          className="rounded-lg"
          isActive={active}
          tooltip={localizedTitle}
        >
          <Link href={route.href} onClick={closeMobileSidebar} prefetch={false}>
            <Icon />
            <span>{localizedTitle}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  access,
  demoMode = false,
}: {
  access: Pick<MerchantDashboardSummary, "actor" | "tenant">;
  demoMode?: boolean;
}) {
  const pathname = usePathname();
  const closeMobileSidebar = useCloseMobileSidebar();
  const { t } = useI18n();
  const shopName = access.tenant.name?.trim() || access.tenant.handle;
  const shopInitial = (shopName.charAt(0) || "E").toUpperCase();

  const visibleSections = appRouteSections.filter(
    (section) => getAppRoutesBySection(section.id).length > 0,
  );

  return (
    <Sidebar className="border-r border-sidebar-border/90" collapsible="icon">
      {/*
        Match AppHeader height (h-14) so the header bottom border is one continuous line.
      */}
      {/*
        Match AppHeader height (h-14) so the header bottom border is one continuous line.
        Brand uses menu button chrome (previous look); sizing stays compact inside h-14.
      */}
      <SidebarHeader className="flex h-14 shrink-0 flex-row items-center border-b border-sidebar-border p-0 px-3 group-data-[collapsible=icon]:px-2">
        <SidebarMenu className="w-full">
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10 rounded-xl" size="lg" tooltip={shopName}>
              <Link
                href={demoMode ? "/demo" : dashboardRoutes.overview}
                onClick={closeMobileSidebar}
                prefetch={false}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_color-mix(in_oklch,white_22%,transparent)]">
                  {shopInitial}
                </span>
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="truncate font-semibold leading-none tracking-tight">
                    {shopName}
                  </span>
                  <span className="truncate text-[0.7rem] font-medium text-muted-foreground">
                    ECS
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {visibleSections.map((section, index) => {
          const routes = getAppRoutesBySection(section.id).map((route) =>
            demoMode ? getDemoSidebarRoute(route) : route,
          );

          return (
            <div className="flex flex-col" key={section.id}>
              {index > 0 ? <SidebarSeparator className="my-2" /> : null}
              <SidebarGroup className="px-3 py-0 group-data-[collapsible=icon]:px-2">
                {section.label ? (
                  <SidebarGroupLabel className="text-[0.65rem] font-semibold tracking-[0.08em] text-muted-foreground/90 uppercase">
                    {t(`nav.section.${section.id}` as MessageKey) || section.label}
                  </SidebarGroupLabel>
                ) : null}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {routes.map((route) => (
                      <NavRouteItem key={route.id} pathname={pathname} route={route} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:p-2">
        <AccountMenu actor={access.actor} demoMode={demoMode} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
