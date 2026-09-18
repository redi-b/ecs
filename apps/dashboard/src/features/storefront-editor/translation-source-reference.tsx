import type { ReactNode } from "react";

export function TranslationSourceReference({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 py-1">
      <span className="mt-0.5 inline-flex h-5 min-w-7 items-center justify-center rounded-md border bg-muted/40 px-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
        EN
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground/80">{children}</div>
      </div>
    </div>
  );
}
