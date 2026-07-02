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
              className="rounded-full"
            >
              <Avatar size="sm">
                <AvatarFallback>EC</AvatarFallback>
              </Avatar>
              <span className="truncate">Merchant account</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align={collapsed ? "center" : "start"}
            sideOffset={10}
            className="w-56 rounded-3xl p-2"
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
