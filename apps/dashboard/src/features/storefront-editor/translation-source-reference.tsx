import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TranslationSourceReference({
  children,
  label,
  variant = "inline",
}: {
  children: ReactNode;
  label: string;
  variant?: "inline" | "panel";
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5",
        variant === "inline"
          ? "py-1"
          : "rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]",
      )}
    >
      <span className="mt-0.5 inline-flex h-5 min-w-7 items-center justify-center rounded-md border border-border/70 bg-background px-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground shadow-xs">
        EN
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground/80">{children}</div>
      </div>
    </div>
  );
}
