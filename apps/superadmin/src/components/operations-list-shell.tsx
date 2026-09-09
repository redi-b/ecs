import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function OperationsListShell({ children, className, footer, status, toolbar }: { children: ReactNode; className?: string; footer?: ReactNode; status?: ReactNode; toolbar?: ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {toolbar || status ? (
        <header className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          {toolbar ? <div className="min-w-0 flex-1">{toolbar}</div> : <span />}
          {status ? <div className="shrink-0 text-sm text-muted-foreground">{status}</div> : null}
        </header>
      ) : null}
      {children}
      {footer ? <footer className="border-t px-3 py-3 sm:px-4">{footer}</footer> : null}
    </section>
  );
}
