"use client";

import type { Column } from "@tanstack/react-table";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableHeaderProps<TData, TValue> = {
  className?: string;
  column: Column<TData, TValue>;
  title: string;
};

export function DataTableHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span
        className={cn(
          "text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase",
          className,
        )}
      >
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();
  const SortIcon =
    sorted === "asc"
      ? AppIcons.arrowUp
      : sorted === "desc"
        ? AppIcons.arrowDown
        : AppIcons.arrowUpDown;

  return (
    <Button
      aria-label={`Sort by ${title}`}
      className={cn(
        "-ml-2 h-8 rounded-full px-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase hover:bg-foreground/5 hover:text-foreground",
        sorted && "text-foreground",
        className,
      )}
      onClick={column.getToggleSortingHandler()}
      type="button"
      variant="ghost"
    >
      {title}
      <SortIcon
        className={cn("opacity-50", sorted && "opacity-90")}
        data-icon="inline-end"
      />
    </Button>
  );
}
