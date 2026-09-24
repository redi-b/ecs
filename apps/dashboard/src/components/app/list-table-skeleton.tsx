import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ListTableSkeletonProps = {
  /** Number of body rows to render. */
  rows?: number;
  /**
   * Approximate data columns (excluding select + actions affordances).
   * Drives how many mid-width cells appear after the identity column.
   */
  columns?: number;
  className?: string;
  /** Match embedded DataTable chrome (no outer card). */
  embedded?: boolean;
  /**
   * Leading media placeholder (product thumb, avatar).
   * Off by default for generic lists; products/media can enable.
   */
  showMedia?: boolean;
};

/**
 * Layout-faithful loading stand-in for list tables.
 * Mimics checkbox + identity + data cells + actions, not a grid of equal bars.
 */
export function ListTableSkeleton({
  rows = 7,
  columns = 4,
  className,
  embedded = false,
  showMedia = false,
}: ListTableSkeletonProps) {
  const midCount = Math.max(2, Math.min(5, columns - 1));
  // Stable width rhythm so rows don't feel randomly jittery.
  const midWidths = ["w-14", "w-16", "w-12", "w-20", "w-14"] as const;
  const titleWidths = ["w-[9.5rem]", "w-[11rem]", "w-[8rem]", "w-[10.5rem]", "w-[7.5rem]"] as const;
  const subWidths = ["w-20", "w-24", "w-16", "w-28", "w-18"] as const;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        embedded
          ? "flex min-w-0 flex-col"
          : "flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3 border-b border-border/80 bg-[var(--table-sticky-header)] px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded-[4px]" />
        <Skeleton className="h-2.5 w-16 shrink-0" />
        <div className="flex min-w-0 flex-1 items-center gap-6">
          {Array.from({ length: midCount }, (_, i) => (
            <Skeleton
              className={cn("h-2.5 shrink-0", midWidths[i % midWidths.length])}
              key={`head-${i}`}
            />
          ))}
        </div>
        <Skeleton className="size-4 shrink-0 rounded-full opacity-0" aria-hidden />
      </div>

      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }, (_, row) => (
          <div className="flex items-center gap-3 px-4 py-3" key={`row-${row}`}>
            <Skeleton className="size-4 shrink-0 rounded-[4px]" />

            <div className="flex min-w-0 flex-[1.35] items-center gap-3">
              {showMedia ? (
                <Skeleton className="size-9 shrink-0 rounded-lg" />
              ) : null}
              <div className="flex min-w-0 flex-col gap-1.5">
                <Skeleton
                  className={cn("h-3.5 max-w-full", titleWidths[row % titleWidths.length])}
                />
                <Skeleton
                  className={cn("h-2.5 max-w-full opacity-80", subWidths[row % subWidths.length])}
                />
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 items-center gap-6 sm:flex">
              {Array.from({ length: midCount }, (_, col) => {
                // First mid col often a status pill; rest shorter value cells.
                if (col === 0) {
                  return (
                    <Skeleton
                      className="h-5 w-16 shrink-0 rounded-full"
                      key={`cell-${row}-${col}`}
                    />
                  );
                }
                return (
                  <Skeleton
                    className={cn(
                      "h-3 shrink-0",
                      midWidths[(col + row) % midWidths.length],
                    )}
                    key={`cell-${row}-${col}`}
                  />
                );
              })}
            </div>

            <Skeleton className="ml-auto size-7 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
