"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OperationsPagination({
  count,
  page,
  pageSize,
  pending,
  onPageChange,
  basePath,
  searchParams,
}: {
  count: number;
  page: number;
  pageSize: number;
  pending?: boolean;
  onPageChange?: (page: number) => void;
  basePath?: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const items = pageItems(current, pages);
  const from = count ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(count, current * pageSize);
  function change(next: number) {
    if (onPageChange) return onPageChange(next);
    if (!basePath) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {}))
      if (value) params.set(key, value);
    if (next > 1) params.set("page", String(next));
    router.push(params.size ? `${basePath}?${params}` : basePath, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm tabular-nums text-muted-foreground">
        {count
          ? `${from.toLocaleString()}–${to.toLocaleString()} of ${count.toLocaleString()}`
          : "0 merchants"}
      </p>
      <nav aria-label={`Page ${current} of ${pages}`} className="flex items-center gap-1.5">
        <Button
          aria-label="Previous page"
          disabled={current === 1 || pending}
          onClick={() => change(current - 1)}
          size="icon"
          variant="outline"
        >
          <ChevronLeft />
        </Button>
        <div className="flex items-center gap-0.5 rounded-full border bg-muted/30 p-0.5">
          {items.map((item, index) =>
            item === "…" ? (
              <span
                className="grid size-8 place-items-center text-muted-foreground"
                key={index === 1 ? "ellipsis-start" : "ellipsis-end"}
              >
                …
              </span>
            ) : (
              <button
                aria-current={item === current ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={cn(
                  "grid size-8 place-items-center rounded-full text-sm font-medium tabular-nums transition-[color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-operations)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  item === current
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
                disabled={pending}
                key={item}
                onClick={() => change(item)}
                type="button"
              >
                {item}
              </button>
            ),
          )}
        </div>
        <Button
          aria-label="Next page"
          disabled={current === pages || pending}
          onClick={() => change(current + 1)}
          size="icon"
          variant="outline"
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}

function pageItems(page: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const items: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push("…");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}
