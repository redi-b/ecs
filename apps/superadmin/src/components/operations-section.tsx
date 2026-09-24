import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function OperationsSection({ actions, children, className, description, title }: { actions?: ReactNode; children: ReactNode; className?: string; description?: ReactNode; title?: ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {title || actions ? (
        <header className="flex items-start justify-between gap-4 border-b px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-medium">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
