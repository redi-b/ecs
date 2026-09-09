import type { LucideIcon } from "lucide-react";
import { CircleAlert, Inbox, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function OperationsDataState({
  action,
  className,
  description,
  icon: Icon = Inbox,
  title,
  tone = "default",
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  title: ReactNode;
  tone?: "default" | "destructive" | "restricted";
}) {
  const StateIcon = tone === "destructive" ? CircleAlert : tone === "restricted" ? LockKeyhole : Icon;
  return (
    <section
      className={cn("flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-5 py-10 text-center", className)}
      role={tone === "destructive" ? "alert" : undefined}
    >
      <StateIcon aria-hidden className={cn("size-5 text-muted-foreground", tone === "destructive" && "text-destructive")} />
      <div className="max-w-md">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}
