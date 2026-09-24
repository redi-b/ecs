"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

type TouchTooltipContextValue = {
  open: () => void;
};

const TouchTooltipContext = React.createContext<TouchTooltipContextValue | null>(null);

function Tooltip({ defaultOpen, onOpenChange, open: controlledOpen, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  const touch = React.useMemo(() => ({ open: () => setOpen(true) }), [setOpen]);

  return (
    <TouchTooltipContext.Provider value={touch}>
      <TooltipPrimitive.Root data-slot="tooltip" onOpenChange={setOpen} open={open} {...props} />
    </TouchTooltipContext.Provider>
  );
}

function TooltipTrigger({ onClickCapture, onPointerCancel, onPointerDown, onPointerMove, onPointerUp, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const touch = React.useContext(TouchTooltipContext);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onClickCapture={(event) => {
        onClickCapture?.(event);
        if (!longPressedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        longPressedRef.current = false;
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        clearTimer();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.pointerType !== "touch" || event.defaultPrevented) return;
        clearTimer();
        longPressedRef.current = false;
        timerRef.current = setTimeout(() => {
          longPressedRef.current = true;
          touch?.open();
        }, 500);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (event.pointerType === "touch") clearTimer();
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        clearTimer();
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-[100] inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-[100] **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-[100] size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
