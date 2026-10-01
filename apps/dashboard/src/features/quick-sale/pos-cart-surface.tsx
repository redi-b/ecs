"use client";

import { type ReactNode, type RefObject, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const desktopQuery = "(min-width: 1024px)";
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function desktopSnapshot() {
  return window.matchMedia(desktopQuery).matches;
}
function serverDesktopSnapshot() {
  return true;
}

export function usePosDesktop() {
  return useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverDesktopSnapshot);
}

/** One cart presentation at a time; its sale state stays owned by the workspace. */
export function PosCartSurface({
  children,
  desktop,
  mobileOpen,
  onCloseMobile,
  busy,
  title,
  triggerRef,
}: {
  children: ReactNode;
  desktop: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  busy: boolean;
  title: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  if (desktop)
    return (
      <aside
        aria-label={title}
        className="hidden min-h-0 min-w-0 flex-col border-l bg-card lg:flex"
      >
        {children}
      </aside>
    );
  return (
    <Sheet
      open={mobileOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onCloseMobile();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="min-h-0 w-full max-w-none bg-card pt-[env(safe-area-inset-top)] data-[side=right]:h-dvh data-[side=right]:w-full sm:max-w-none"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
