import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  /** Compact control that explains or qualifies the page title. */
  titleAccessory?: ReactNode;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Optional context label. Reserve for information that the title cannot carry. */
  eyebrow?: string;
  /** Secondary meta row under description (counts, status chips). */
  meta?: ReactNode;
  className?: string;
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
  titleAccessory,
  description,
  children,
  actions,
  eyebrow,
  meta,
  className,
  hideHeader = false,
  headerMode = "visible",
}: PageShellProps) {
  return (
    <main
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-5 overflow-x-hidden p-4 sm:gap-6 sm:p-5 md:gap-7 md:p-8",
        "flex-1",
        className,
      )}
    >
      {!hideHeader && headerMode === "sr-only" ? <h1 className="sr-only">{title}</h1> : null}
      {!hideHeader && headerMode === "visible" ? (
        <header className="flex flex-col gap-3 border-b border-border/80 pb-5 sm:pb-6 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="flex min-w-0 max-w-3xl flex-col gap-1.5">
            {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="type-page-title min-w-0 text-pretty">{title}</h1>
              {titleAccessory ? <div className="shrink-0">{titleAccessory}</div> : null}
            </div>
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
