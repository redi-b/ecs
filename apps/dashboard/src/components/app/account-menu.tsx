"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { useState } from "react";
import { usePolicy } from "@/components/app/access-context";
import { useActorOrFallback } from "@/components/app/actor-context";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { ProfileAvatar } from "@/components/app/profile-avatar";
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
import { merchantPolicies } from "@/lib/access-policy";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AccountMenu({
  actor,
  accessibleShopCount = 1,
  currentTenantId,
  demoMode = false,
  shopPickerUrl,
}: {
  actor: MerchantDashboardSummary["actor"];
  accessibleShopCount?: number;
  currentTenantId?: string;
  demoMode?: boolean;
  shopPickerUrl?: string;
}) {
  const { t } = useI18n();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { actor: liveActor } = useActorOrFallback(actor);
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [suppressTooltip, setSuppressTooltip] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const canViewBilling = usePolicy(merchantPolicies.billing);
  const accountName = liveActor.name?.trim() || liveActor.email;
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
    const response = await fetch("/sign-out", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    window.location.assign(data?.redirectTo ?? "/sign-in");
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
              <ProfileAvatar
                userId={liveActor.id}
                name={liveActor.name}
                preferences={liveActor.avatar}
                className={cn(collapsed && "size-full after:border-0")}
                size={collapsed ? "default" : "sm"}
              />
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
              <DropdownMenuItem asChild={!demoMode} className="py-1.5" disabled={demoMode}>
                {demoMode ? (
                  <span>
                    <AppIcons.settings />
                    {t("account.settings")}
                  </span>
                ) : (
                  <Link
                    href={dashboardRoutes.settings}
                    onClick={closeMobileSidebar}
                    prefetch={false}
                  >
                    <AppIcons.settings />
                    {t("account.settings")}
                  </Link>
                )}
              </DropdownMenuItem>
              {demoMode || canViewBilling ? (
                <DropdownMenuItem asChild={!demoMode} className="py-1.5" disabled={demoMode}>
                  {demoMode ? (
                    <span>
                      <AppIcons.billing />
                      {t("account.billing")}
                    </span>
                  ) : (
                    <Link
                      href={dashboardRoutes.billing}
                      onClick={closeMobileSidebar}
                      prefetch={false}
                    >
                      <AppIcons.billing />
                      {t("account.billing")}
                    </Link>
                  )}
                </DropdownMenuItem>
              ) : null}
              {!demoMode && shopPickerUrl && accessibleShopCount > 1 ? (
                <DropdownMenuItem asChild className="py-1.5">
                  <a
                    href={`${shopPickerUrl}?current=${encodeURIComponent(currentTenantId ?? "")}`}
                    onClick={closeMobileSidebar}
                  >
                    <AppIcons.shoppingBag />
                    {t("account.switchShop")}
                  </a>
                </DropdownMenuItem>
              ) : null}
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
