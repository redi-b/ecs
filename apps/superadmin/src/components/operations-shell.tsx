"use client";

import {
  Activity,
  Building2,
  ChevronsUpDown,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId } from "react";
import { OperationsBreadcrumbs } from "@/components/operations-breadcrumbs";
import { OperatorCommand } from "@/components/operator-command";
import { ThemeMenu } from "@/components/theme-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type Operator = { email: string; name: string };

const navigation = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "Overview",
    permission: "platform.overview.read",
    shortcut: "O",
  },
  {
    href: "/merchants",
    icon: Building2,
    label: "Merchants",
    permission: "tenants.read",
    shortcut: "M",
  },
  {
    href: "/work",
    icon: ClipboardList,
    label: "Work",
    permission: "platform.work.read",
    shortcut: "W",
  },
  {
    href: "/health",
    icon: Activity,
    label: "Health",
    permission: "platform.health.read",
    shortcut: "H",
  },
  {
    href: "/audit",
    icon: FileClock,
    label: "Audit",
    permission: "platform.audit.read",
    shortcut: "A",
  },
  {
    href: "/operators",
    icon: UsersRound,
    label: "Operators",
    permission: "platform.operators.read",
    shortcut: "P",
  },
] as const;

export function OperationsShell({
  children,
  operator,
  permissions,
}: {
  children: ReactNode;
  operator: Operator;
  permissions: string[];
}) {
  const pathname = usePathname();
  const mainId = useId();
  const initials = getInitials(operator.name || operator.email);
  const visibleNavigation = navigation.filter((item) => permissions.includes(item.permission));

  return (
    <>
      <a
        className="fixed start-4 top-4 z-50 -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        href={`#${mainId}`}
      >
        Skip to main content
      </a>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "15.5rem",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
      >
        <MobileNavigationReset key={pathname} />
        <Sidebar className="border-r border-sidebar-border/90" collapsible="icon">
          <SidebarHeader className="flex h-14 shrink-0 flex-row items-center border-b border-sidebar-border p-0 px-3 group-data-[collapsible=icon]:px-2">
            <SidebarMenu className="w-full">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-10 rounded-xl"
                  size="lg"
                  tooltip="ECS Operations"
                >
                  <Link href="/">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-sidebar-border bg-sidebar text-primary">
                      <ShieldCheck aria-hidden />
                    </span>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">ECS Operations</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        Platform workspace
                      </span>
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent className="gap-0 py-2">
            <SidebarGroup className="px-3 py-0 group-data-[collapsible=icon]:px-2">
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleNavigation.map((item) => {
                    const active =
                      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          className="h-9 rounded-lg"
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Link href={item.href}>
                            <Icon aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      aria-label="Open account menu"
                      className="h-11 rounded-xl group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!"
                      tooltip={`${operator.name} · Account menu`}
                    >
                      <Avatar className="group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:after:border-0">
                        <AvatarFallback className="bg-transparent text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate text-sm font-medium">{operator.name}</span>
                        <span className="truncate text-xs text-sidebar-foreground/60">
                          {operator.email}
                        </span>
                      </span>
                      <ChevronsUpDown
                        aria-hidden
                        className="ml-auto group-data-[collapsible=icon]:hidden"
                      />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64" side="right" sideOffset={8}>
                    <DropdownMenuLabel>
                      <span className="block truncate">{operator.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {operator.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild variant="destructive">
                      <form action="/sign-out" method="post">
                        <button className="flex w-full items-center gap-2" type="submit">
                          <LogOut aria-hidden data-icon="inline-start" />
                          Sign out
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:px-6">
            <SidebarTrigger className="size-10 md:size-7" />
            <Separator className="h-4" orientation="vertical" />
            <div className="min-w-0 flex-1">
              <OperationsBreadcrumbs />
            </div>
            <OperatorCommand destinations={visibleNavigation} />
            <ThemeMenu />
          </header>
          <main
            className="operations-enter min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8"
            id={mainId}
            tabIndex={-1}
          >
            <div className="mx-auto w-full max-w-[1500px]">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

function MobileNavigationReset() {
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  return null;
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "OP";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
