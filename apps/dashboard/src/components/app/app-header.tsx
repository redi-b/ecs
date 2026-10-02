"use client";

import { PermissionGate } from "@/components/app/access-context";
import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { AppIcons } from "@/components/app/icons";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import Link from "@/components/app/link";
import { NotificationCenter } from "@/components/app/notification-center";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

export function AppHeader({ demoMode = false }: { demoMode?: boolean }) {
  const { t } = useI18n();
  return (
    <header
      data-slot="app-header"
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md supports-backdrop-filter:bg-background/85 print:hidden dark:border-sidebar-border dark:bg-sidebar dark:backdrop-blur-none dark:supports-backdrop-filter:bg-sidebar sm:gap-3 sm:px-6"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger
            aria-label={t("common.toggleSidebar")}
            className="size-9 shrink-0 rounded-full"
          />
        </TooltipTrigger>
        <TooltipContent>{t("common.toggleSidebar")}</TooltipContent>
      </Tooltip>
      <div
        aria-hidden="true"
        className="hidden h-5 w-px shrink-0 self-center bg-border/80 sm:block"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <AppBreadcrumbs />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {demoMode ? null : (
          <PermissionGate permission="orders.create">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon-sm" variant="ghost">
                  <Link aria-label={t("nav.quickSale")} href={dashboardRoutes.pos} prefetch={false}>
                    <AppIcons.quickSale />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("nav.quickSale")}</TooltipContent>
            </Tooltip>
          </PermissionGate>
        )}
        {demoMode ? (
          <Badge className="hidden rounded-full sm:inline-flex" variant="secondary">
            {t("overview.demo.readOnly")}
          </Badge>
        ) : (
          <CommandCenter placement="header" />
        )}
        <div className="flex items-center gap-0.5">
          {demoMode ? null : (
            <PermissionGate permission="notifications.read">
              <NotificationCenter />
            </PermissionGate>
          )}
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
