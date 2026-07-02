"use client";

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

export function AccountMenu() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip="Account"
              aria-label="Open account menu"
              className={cn(
                "rounded-full",
                "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!",
              )}
            >
              <Avatar size={collapsed ? "default" : "sm"}>
                <AvatarFallback>EC</AvatarFallback>
              </Avatar>
              <span className="truncate">Merchant account</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align={collapsed ? "end" : "center"}
            sideOffset={collapsed ? 10 : 16}
            collisionPadding={12}
            className="w-56 rounded-2xl p-1.5"
          >
            <DropdownMenuLabel>Merchant account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <AppIcons.user />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <AppIcons.settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
