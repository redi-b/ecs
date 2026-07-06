"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
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
import { cn } from "@/lib/utils";

export function AccountMenu({ actor }: { actor: MerchantDashboardSummary["actor"] }) {
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
              aria-label="Open account menu"
              onPointerLeave={() => setSuppressTooltip(false)}
              onBlur={() => setSuppressTooltip(false)}
              {...(suppressTooltip ? {} : { tooltip: "Account" })}
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
            className="w-56 rounded-2xl p-2"
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
              <DropdownMenuItem className="rounded-xl px-2 py-2" disabled>
                <AppIcons.user />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-2 py-2" disabled>
                <AppIcons.settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action="/admin/sign-out" method="post">
              <DropdownMenuItem asChild className="rounded-xl px-2 py-2">
                <button className="w-full" type="submit">
                  <AppIcons.logout />
                  Sign out
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
