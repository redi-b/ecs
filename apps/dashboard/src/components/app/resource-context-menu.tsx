"use client";

import Link from "@/components/app/link";
import type { ResourceRowActions } from "@/components/app/row-actions-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const NATIVE_CONTEXT_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "img",
  "video",
  "audio",
  "canvas",
  "[contenteditable='true']",
  "[data-native-context-menu]",
].join(",");

export function shouldKeepNativeContextMenu(target: EventTarget | null, shiftKey: boolean) {
  if (shiftKey || !(target instanceof Element)) return true;
  if (target.closest(NATIVE_CONTEXT_SELECTOR)) return true;

  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

type ResourceContextMenuProps = ResourceRowActions & {
  children: React.ReactNode;
};

export function ResourceContextMenu({ actions, children, label }: ResourceContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenuCapture={(event) => {
          if (shouldKeepNativeContextMenu(event.target, event.shiftKey)) {
            event.stopPropagation();
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={label}>
        <ContextMenuGroup>
          {actions.map((action) => {
            if (action.type === "separator") {
              return <ContextMenuSeparator key={action.id} />;
            }

            const Icon = action.icon;

            if (action.type === "link") {
              return (
                <ContextMenuItem asChild disabled={action.disabled ?? false} key={action.label}>
                  <Link href={action.href}>
                    {Icon ? <Icon data-icon="inline-start" /> : null}
                    {action.label}
                  </Link>
                </ContextMenuItem>
              );
            }

            return (
              <ContextMenuItem
                disabled={action.disabled ?? false}
                key={action.label}
                onSelect={() => void action.onSelect()}
                {...(action.variant ? { variant: action.variant } : {})}
              >
                {Icon ? <Icon data-icon="inline-start" /> : null}
                {action.label}
              </ContextMenuItem>
            );
          })}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
