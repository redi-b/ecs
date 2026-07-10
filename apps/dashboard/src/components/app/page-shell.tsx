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
        "flex min-h-0 min-w-0 flex-1 flex-col gap-7 overflow-x-hidden p-5 md:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b pb-6 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">{children}</div>
    </main>
  );
}
