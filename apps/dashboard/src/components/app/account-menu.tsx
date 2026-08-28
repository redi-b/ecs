"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { useState } from "react";
import { useActorOrFallback } from "@/components/app/actor-context";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
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

export function AccountMenu({
  actor,
  demoMode = false,
}: {
  actor: MerchantDashboardSummary["actor"];
  demoMode?: boolean;
}) {
  const { t } = useI18n();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { actor: liveActor } = useActorOrFallback(actor);
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [suppressTooltip, setSuppressTooltip] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accountName = liveActor.name?.trim() || liveActor.email;
  const accountInitials = getAccountInitials(accountName);
  const openBeside = !isMobile && collapsed;

  function closeMobileSidebar() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  async function signOut() {
    if (demoMode) return;
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
              size="default"
              aria-label={t("account.openMenu")}
              onPointerLeave={() => setSuppressTooltip(false)}
              onBlur={() => setSuppressTooltip(false)}
              {...(suppressTooltip ? {} : { tooltip: t("account.tooltip") })}
              className={cn(
                "h-9 rounded-lg",
                "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!",
              )}
            >
              <Avatar
                className={cn(collapsed && "size-full after:border-0")}
                size={collapsed ? "default" : "sm"}
              >
                <AvatarFallback>{accountInitials}</AvatarFallback>
              </Avatar>
              <span className="truncate group-data-[collapsible=icon]:hidden">{accountName}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={openBeside ? "right" : "top"}
            align={openBeside ? "end" : "center"}
            sideOffset={openBeside ? 10 : 12}
            collisionPadding={12}
            className="w-56 max-w-[calc(100vw-1.5rem)] rounded-xl p-1 shadow-md"
          >
            <DropdownMenuLabel className="px-2.5 py-1.5 font-normal">
              <span className="block truncate text-sm font-medium text-popover-foreground">
                {accountName}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {liveActor.email}
              </span>
              <span className="block truncate text-xs capitalize text-muted-foreground">
                {liveActor.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="py-1.5">
                <Link href={dashboardRoutes.settings} onClick={closeMobileSidebar} prefetch={false}>
                  <AppIcons.settings />
                  {t("account.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-1.5">
                <Link href={dashboardRoutes.billing} onClick={closeMobileSidebar} prefetch={false}>
                  <AppIcons.billing />
                  {t("account.billing")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              className="py-1.5"
              disabled={demoMode || isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
              variant="destructive"
            >
              {isSigningOut ? <AppIcons.loader className="animate-spin" /> : <AppIcons.logout />}
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
