"use client";

import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

export type RowAction =
  | {
      disabled?: boolean;
      href: string;
      icon?: AppIcon;
      label: string;
      type: "link";
    }
  | {
      disabled?: boolean;
      icon?: AppIcon;
      label: string;
      onSelect: () => Promise<void> | void;
      type: "button";
      variant?: "default" | "destructive";
    }
  | {
      id: string;
      type: "separator";
    };

type RowActionsMenuProps = {
  actions: RowAction[];
  label: string;
};

export function RowActionsMenu({ actions, label }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={label}
          className="rounded-full"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <AppIcons.more data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl" sideOffset={8}>
        <DropdownMenuGroup>
          {actions.map((action) => {
            if (action.type === "separator") {
              return <DropdownMenuSeparator key={action.id} />;
            }

            const Icon = action.icon;

            if (action.type === "link") {
              return (
                <DropdownMenuItem asChild disabled={action.disabled ?? false} key={action.label}>
                  <Link href={action.href}>
                    {Icon ? <Icon data-icon="inline-start" /> : null}
                    {action.label}
                  </Link>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                disabled={action.disabled ?? false}
                key={action.label}
                onSelect={() => {
                  void action.onSelect();
                }}
                {...(action.variant ? { variant: action.variant } : {})}
              >
                {Icon ? <Icon data-icon="inline-start" /> : null}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
