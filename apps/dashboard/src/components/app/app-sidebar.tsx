"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/app/account-menu";
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

export function AppSidebar() {
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
                  return (
                    <Collapsible key={route.id} asChild defaultOpen={active}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={route.title}
                            className="rounded-xl"
                          >
                            {content}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                          <SidebarMenuSub>
                            {route.children.map((child) => (
                              <SidebarMenuSubItem key={child.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isRouteActive(pathname, child)}
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
        <AccountMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
