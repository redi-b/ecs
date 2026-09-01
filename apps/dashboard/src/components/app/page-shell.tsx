import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Optional context label. Reserve for information that the title cannot carry. */
  eyebrow?: string;
  /** Secondary meta row under description (counts, status chips). */
  meta?: ReactNode;
  className?: string;
  /** Locks the page to the dashboard viewport and delegates scrolling to its children. */
  viewportWorkspace?: boolean;
  /** Immersive workspaces can move page identity into their own chrome. */
  hideHeader?: boolean;
  /** Keep a semantic page title without repeating identity already shown by app chrome. */
  headerMode?: "visible" | "sr-only";
};

/**
 * Shared merchant page chrome: title ladder, actions, and content rhythm.
 * Keep ops screens consistent; put signature expression in shell + auth, not every page.
 */
export function PageShell({
  title,
  description,
  children,
  actions,
  eyebrow,
  meta,
  className,
  viewportWorkspace = false,
  hideHeader = false,
  headerMode = "visible",
}: PageShellProps) {
  return (
    <main
      data-viewport-workspace={viewportWorkspace ? "" : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-5 overflow-x-hidden p-4 sm:gap-6 sm:p-5 md:gap-7 md:p-8",
        viewportWorkspace ? "h-[calc(100dvh-3.5rem)] flex-none overflow-hidden" : "flex-1",
        className,
      )}
    >
      {!hideHeader && headerMode === "sr-only" ? <h1 className="sr-only">{title}</h1> : null}
      {!hideHeader && headerMode === "visible" ? (
        <header className="flex flex-col gap-3 border-b border-border/80 pb-5 sm:pb-6 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="flex min-w-0 max-w-3xl flex-col gap-1.5">
            {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
            <h1 className="type-page-title text-pretty">{title}</h1>
            {description ? <p className="type-meta max-w-2xl text-pretty">{description}</p> : null}
            {meta ? <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto md:max-w-md md:shrink-0 md:justify-end">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-5">{children}</div>
    </main>
  );
}
