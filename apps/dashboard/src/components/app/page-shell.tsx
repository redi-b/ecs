import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageShell({ title, description, children, actions, className }: PageShellProps) {
  return (
    <main
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-x-hidden p-4 sm:gap-7 sm:p-5 md:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b pb-5 sm:pb-6 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 max-w-3xl flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-normal sm:text-2xl">
            {title}
          </h1>
          <p className="text-sm leading-6 text-pretty text-muted-foreground">{description}</p>
        </div>
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:max-w-md md:justify-end md:shrink-0">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">{children}</div>
    </main>
  );
}
