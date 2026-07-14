"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useState } from "react";

import { useActorOrFallback } from "@/components/app/actor-context";
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
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { actor: liveActor } = useActorOrFallback(actor);
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [suppressTooltip, setSuppressTooltip] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accountName = liveActor.name?.trim() || liveActor.email;
  const accountInitials = getAccountInitials(accountName);

  function closeMobileSidebar() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setMenuOpen(false);
    closeMobileSidebar();
    const response = await fetch("/admin/sign-out", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    window.location.assign(data?.redirectTo ?? "/admin/sign-in");
  }

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
                {liveActor.email}
              </span>
              <span className="block truncate text-xs font-normal capitalize text-muted-foreground">
                {liveActor.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={dashboardRoutes.settings} onClick={closeMobileSidebar} prefetch={false}>
                  <AppIcons.settings />
                  {t("account.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={dashboardRoutes.billing} onClick={closeMobileSidebar} prefetch={false}>
                  <AppIcons.billing />
                  {t("account.billing")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
              variant="destructive"
            >
              {isSigningOut ? (
                <AppIcons.loader className="animate-spin" />
              ) : (
                <AppIcons.logout />
              )}
              {isSigningOut ? t("account.signingOut") : t("account.signOut")}
            </DropdownMenuItem>
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
