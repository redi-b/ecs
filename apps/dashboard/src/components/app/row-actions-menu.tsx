"use client";

import Link from "next/link";

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

export type RowAction =
  | {
      disabled?: boolean;
      href: string;
      label: string;
      type: "link";
    }
  | {
      disabled?: boolean;
      label: string;
      onSelect: () => void;
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
      <DropdownMenuContent align="end" className="w-48" sideOffset={8}>
        <DropdownMenuGroup>
          {actions.map((action) => {
            if (action.type === "separator") {
              return <DropdownMenuSeparator key={action.id} />;
            }

            if (action.type === "link") {
              return (
                <DropdownMenuItem asChild disabled={action.disabled ?? false} key={action.label}>
                  <Link href={action.href}>{action.label}</Link>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                disabled={action.disabled ?? false}
                key={action.label}
                onSelect={action.onSelect}
                {...(action.variant ? { variant: action.variant } : {})}
              >
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
