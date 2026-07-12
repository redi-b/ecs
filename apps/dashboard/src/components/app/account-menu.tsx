"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "next/link";
import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AccountMenu({ actor }: { actor: MerchantDashboardSummary["actor"] }) {
  const { t } = useI18n();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [suppressTooltip, setSuppressTooltip] = useState(false);
  const accountName = actor.name?.trim() || actor.email;
  const accountInitials = getAccountInitials(accountName);

  function handleMenuOpenChange(open: boolean) {
    setMenuOpen(open);

    if (open) {
      setSuppressTooltip(true);
      return;
    }

    if (collapsed) {
      setSuppressTooltip(true);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t("account.openMenu")}
              onPointerLeave={() => setSuppressTooltip(false)}
              onBlur={() => setSuppressTooltip(false)}
              {...(suppressTooltip ? {} : { tooltip: t("account.tooltip") })}
              className={cn(
                "rounded-full",
                "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!",
              )}
            >
              <Avatar size={collapsed ? "default" : "sm"}>
                <AvatarFallback>{accountInitials}</AvatarFallback>
              </Avatar>
              <span className="truncate">{accountName}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align={collapsed ? "end" : "center"}
            sideOffset={collapsed ? 10 : 16}
            collisionPadding={12}
            className="w-56 rounded-xl"
          >
            <DropdownMenuLabel className="px-2 py-1.5">
              <span className="block truncate text-sm font-medium text-popover-foreground">
                {accountName}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {actor.email}
              </span>
              <span className="block truncate text-xs font-normal capitalize text-muted-foreground">
                {actor.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={dashboardRoutes.billing}>
                  <AppIcons.billing />
                  {t("account.billing")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={dashboardRoutes.media}>
                  <AppIcons.image />
                  {t("account.mediaLibrary")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="mailto:support@ecs.et">
                  <AppIcons.externalLink />
                  {t("account.support")}
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action="/admin/sign-out" method="post">
              <DropdownMenuItem asChild variant="destructive">
                <button className="w-full" type="submit">
                  <AppIcons.logout />
                  {t("account.signOut")}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function getAccountInitials(value: string) {
  const [first = "", second = ""] = value
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return `${first.charAt(0)}${second.charAt(0) || first.charAt(1) || ""}`.toUpperCase();
}
