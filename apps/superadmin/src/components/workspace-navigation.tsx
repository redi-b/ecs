"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type WorkspaceNavigationItem<T extends string> = { id: T; label: string };

export function WorkspaceNavigation<T extends string>({
  active,
  ariaLabel,
  basePath,
  items,
}: {
  active: T;
  ariaLabel: string;
  basePath: string;
  items: WorkspaceNavigationItem<T>[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(active);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );
  const indicatorStyle = getWorkspaceIndicatorStyle(items.length, index);

  useEffect(() => setSelected(active), [active]);

  function select(id: T) {
    if (id === selected) return;
    setSelected(id);
    startTransition(() =>
      router.push(`${basePath}?view=${encodeURIComponent(id)}`, { scroll: false }),
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-14 z-20 overflow-x-auto border-y bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div
        aria-busy={pending}
        className="relative grid px-1.5 py-1.5"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(7rem, 1fr))`,
          minWidth: `${items.length * 7}rem`,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-1.5 rounded-xl bg-muted ring-1 ring-border/70 transition-transform duration-300 ease-[var(--ease-operations)] motion-reduce:transition-none"
          style={indicatorStyle}
        />
        {items.map((item) => (
          <button
            aria-current={item.id === selected ? "page" : undefined}
            className={cn(
              "relative z-10 flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200",
              item.id === selected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={item.id}
            onClick={() => select(item.id)}
            type="button"
          >
            {item.label}
            {pending && item.id === selected ? <Spinner className="size-3.5" /> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function getWorkspaceIndicatorStyle(itemCount: number, activeIndex: number) {
  const safeCount = Math.max(1, itemCount);
  const safeIndex = Math.min(Math.max(0, activeIndex), safeCount - 1);
  return {
    transform: `translate3d(${safeIndex * 100}%, 0, 0)`,
    width: `calc((100% - 0.75rem) / ${safeCount})`,
  };
}
