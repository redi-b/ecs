"use client";

import {
  BarChart3Icon,
  BoxesIcon,
  EyeIcon,
  LayoutDashboardIcon,
  PaintbrushIcon,
  ShoppingBagIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/app/theme-toggle";
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
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const sections = [
  {
    label: null,
    routes: [{ href: "/demo", label: "Overview", icon: LayoutDashboardIcon }],
  },
  {
    label: "Commerce",
    routes: [
      { href: "/demo/products", label: "Products", icon: BoxesIcon },
      { href: "/demo/orders", label: "Orders", icon: ShoppingBagIcon },
    ],
  },
  {
    label: "Storefront",
    routes: [{ href: "/demo/storefront", label: "Editor", icon: PaintbrushIcon }],
  },
  {
    label: "Insights",
    routes: [{ href: "/demo/insights", label: "Insights", icon: BarChart3Icon }],
  },
] as const;

export function DashboardDemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-11 rounded-lg px-2" size="lg">
                  <Link href="/demo">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      A
                    </span>
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="truncate font-semibold leading-none tracking-tight">
                        Aster Market
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
            {sections.map((section, index) => (
              <div className="flex flex-col" key={section.label ?? "overview"}>
                {index > 0 ? <SidebarSeparator className="my-2" /> : null}
                <SidebarGroup className="px-3 py-0 group-data-[collapsible=icon]:px-2">
                  {section.label ? (
                    <SidebarGroupLabel className="text-[0.65rem] font-semibold tracking-[0.08em] text-muted-foreground/90 uppercase">
                      {section.label}
                    </SidebarGroupLabel>
                  ) : null}
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {section.routes.map(({ href, icon: Icon, label }) => {
                        const active =
                          href === "/demo" ? pathname === href : pathname.startsWith(href);
                        return (
                          <SidebarMenuItem key={href}>
                            <SidebarMenuButton
                              asChild
                              className="rounded-lg"
                              isActive={active}
                              tooltip={label}
                            >
                              <Link href={href}>
                                <Icon />
                                <span>{label}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>
            ))}
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-11 rounded-lg px-2" tooltip="Interactive preview">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background">
                    <EyeIcon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate text-sm font-medium">Interactive preview</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Changes are not saved
                    </span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:px-6">
            <SidebarTrigger className="size-9 shrink-0 rounded-full" />
            <div aria-hidden className="hidden h-5 w-px bg-border/80 sm:block" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              Merchant dashboard preview
            </p>
            <span className="hidden rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              Preview only
            </span>
            <ThemeToggle />
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function DemoPageHeader({ description, title }: { description: string; title: string }) {
  return (
    <header className="flex flex-col gap-1.5 border-b border-border/80 pb-5 sm:pb-6">
      <h1 className="type-page-title text-balance">{title}</h1>
      <p className="type-meta max-w-2xl">{description}</p>
    </header>
  );
}
