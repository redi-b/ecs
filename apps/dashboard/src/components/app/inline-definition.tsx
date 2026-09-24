"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Accessible inline explanation for labels that need a small amount of context. */
export function InlineDefinition({
  children,
  content,
  className,
  align = "center",
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  function cancelClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function enter(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  }
  function leave(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  }
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-help text-inherit underline decoration-current/50 decoration-dashed underline-offset-[3px] outline-none transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          onPointerEnter={enter}
          onPointerLeave={leave}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="w-auto max-w-[min(22rem,calc(100vw-2rem))] px-3 py-2 text-sm leading-relaxed text-muted-foreground"
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
