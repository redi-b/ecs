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
      <span className={cn("text-xs font-medium normal-case text-muted-foreground", className)}>
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
        "-ml-2 h-8 rounded-full px-2 text-xs font-medium normal-case text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={column.getToggleSortingHandler()}
      type="button"
      variant="ghost"
    >
      {title}
      <SortIcon data-icon="inline-end" />
    </Button>
  );
}
