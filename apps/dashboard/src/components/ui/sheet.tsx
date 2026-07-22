"use client";

import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { preventDialogDismissForPortals } from "@/lib/dialog-outside";
import { FloatingPortalContainerProvider } from "@/lib/floating-portal-container";
import { isNestedOverlayActive } from "@/lib/nested-overlay";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/20 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onInteractOutside,
  onPointerDownOutside,
  onFocusOutside,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex max-h-dvh flex-col gap-0 overflow-x-hidden overflow-y-visible bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:border-t",
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r",
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l",
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:max-h-[85dvh] data-[side=top]:border-b",
          "data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          "data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
          className,
        )}
        {...props}
        ref={(node) => {
          setPortalContainer(node);
        }}
        onEscapeKeyDown={(event) => {
          if (isNestedOverlayActive()) {
            event.preventDefault();
          }
          onEscapeKeyDown?.(event);
        }}
        onFocusOutside={(event) => {
          preventDialogDismissForPortals(event);
          onFocusOutside?.(event);
        }}
        onInteractOutside={(event) => {
          preventDialogDismissForPortals(event);
          onInteractOutside?.(event);
        }}
        onPointerDownOutside={(event) => {
          preventDialogDismissForPortals(event);
          onPointerDownOutside?.(event);
        }}
      >
        <FloatingPortalContainerProvider container={portalContainer}>
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close data-slot="sheet-close" asChild>
              <Button variant="ghost" className="absolute top-3 right-3 z-10" size="icon-sm">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </SheetPrimitive.Close>
          )}
        </FloatingPortalContainerProvider>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-0.5 border-b p-4 pr-12", className)}
      {...props}
    />
  );
}

/** Scrollable middle region between fixed SheetHeader and SheetFooter. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col gap-2 border-t bg-muted/30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
