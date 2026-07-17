"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { DataTableBulkBar } from "@/components/app/data-table-bulk-bar";
import { AppIcons } from "@/components/app/icons";
import { PaginationBar } from "@/components/app/pagination-bar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyMessage: string;
  emptyTitle?: string;
  filteredEmptyMessage?: string;
  filteredEmptyTitle?: string;
  /** Rendered under the scroll region (e.g. server PaginationControls). Always visible. */
  footer?: React.ReactNode;
  getRowId?: (row: TData) => string;
  globalFilter?: string;
  isFiltered?: boolean;
  onGlobalFilterChange?: (value: string) => void;
  pageSize?: number;
  selectedSummaryLabel?: string | ((selectedCount: number) => string);
  toolbar?: React.ReactNode;
};

export function DataTable<TData>({
  bulkActions,
  columns,
  data,
  emptyMessage,
  emptyTitle,
  filteredEmptyMessage,
  filteredEmptyTitle,
  footer,
  getRowId,
  globalFilter,
  isFiltered = false,
  onGlobalFilterChange,
  pageSize,
  selectedSummaryLabel,
  toolbar,
}: DataTableProps<TData>) {
  const { t } = useI18n();
  const resolvedEmptyTitle = emptyTitle ?? t("table.empty.noRowsTitle");
  const resolvedFilteredEmptyTitle = filteredEmptyTitle ?? t("table.empty.noMatchingRowsTitle");
  const resolvedSelectedSummaryLabel = selectedSummaryLabel ?? t("common.selected");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize ?? (data.length || 1),
  });
  const isPaginated = typeof pageSize === "number" && pageSize > 0;

  useEffect(() => {
    if (!isPaginated || typeof pageSize !== "number") return;
    setPagination((current) =>
      current.pageSize === pageSize ? current : { pageIndex: 0, pageSize },
    );
  }, [isPaginated, pageSize]);

  const table = useReactTable({
    columns,
    data,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    ...(isPaginated ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
    onGlobalFilterChange: (updater) => {
      const nextValue = typeof updater === "function" ? updater(globalFilter ?? "") : updater;

      onGlobalFilterChange?.(String(nextValue ?? ""));
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      globalFilter,
      ...(isPaginated ? { pagination } : {}),
      rowSelection,
      sorting,
    },
  });

  const rows = table.getRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const emptyStateMessage =
    isFiltered && rows.length === 0 ? (filteredEmptyMessage ?? emptyMessage) : emptyMessage;
  const emptyStateTitle =
    isFiltered && rows.length === 0 ? resolvedFilteredEmptyTitle : resolvedEmptyTitle;
  const selectedSummary =
    typeof resolvedSelectedSummaryLabel === "function"
      ? resolvedSelectedSummaryLabel(selectedRows.length)
      : resolvedSelectedSummaryLabel;

  const pageCount = Math.max(1, table.getPageCount());
  const pageIndex = table.getState().pagination.pageIndex;
  const showClientPagination = isPaginated && data.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(max > 4 && el.scrollLeft > 4);
      setCanScrollRight(max > 4 && el.scrollLeft < max - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Table width can change when data/columns reflow.
    const tableEl = el.querySelector("table");
    if (tableEl) observer.observe(tableEl);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [rows.length, data.length, columns.length]);

  const isEmpty = rows.length === 0;

  return (
    <div className="mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border bg-card/95 lg:mb-6">
      {toolbar ? (
        <div className="shrink-0 border-b bg-muted/20 p-3">{toolbar}</div>
      ) : null}

      {isEmpty ? (
        // Empty: no wide table chrome, headers, or scroll arrows — a single clear panel.
        <div className="flex min-h-56 items-center justify-center px-5 py-12 sm:min-h-64 sm:px-8">
          <Empty className="max-w-sm border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AppIcons.search data-icon="inline-start" />
              </EmptyMedia>
              <EmptyTitle>{emptyStateTitle}</EmptyTitle>
              <EmptyDescription>{emptyStateMessage}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        /*
          Scroll region owns vertical overflow so:
          - thead can stick at top of the table body
          - footer pagination stays visible without scrolling past every row
        */
        <div className="relative min-h-0">
          <div
            className="max-h-[min(36rem,calc(100dvh-14rem))] min-h-0 overflow-auto"
            ref={scrollRef}
          >
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 z-30 [&_tr]:border-b-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow className="border-b-0 hover:bg-transparent" key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        className={cn(
                          // Solid surface. Use 1px box-shadow (not border-b): sticky table cells
                          // paint body rows over CSS borders while scrolling.
                          "h-11 bg-card px-4 text-xs uppercase text-muted-foreground sticky top-0",
                          "shadow-[0_1px_0_0_var(--border)]",
                          getStickyColumnClass(header.column.id, true),
                        )}
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    className="group/row transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5 data-[state=selected]:hover:bg-primary/10"
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    key={row.id}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isSticky = cell.column.id === "select" || cell.column.id === "actions";
                      return (
                        <TableCell
                          className={cn(
                            "px-4 py-3",
                            isSticky
                              ? getStickyColumnClass(cell.column.id, false, row.getIsSelected())
                              : cn(
                                  "bg-card group-hover/row:bg-muted/40",
                                  row.getIsSelected() && "bg-primary/5 group-hover/row:bg-primary/10",
                                ),
                          )}
                          key={cell.id}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Horizontal scroll affordance — only when the table has rows and overflows. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-40 flex w-9 items-center justify-start bg-linear-to-r from-card via-card/90 to-transparent pl-1 transition-opacity",
              canScrollLeft ? "opacity-100" : "opacity-0",
            )}
          >
            <AppIcons.arrowLeft className="size-3.5 text-muted-foreground" />
          </div>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 z-40 flex w-9 items-center justify-end bg-linear-to-l from-card via-card/90 to-transparent pr-1 transition-opacity",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          >
            <AppIcons.arrowRight className="size-3.5 text-muted-foreground" />
          </div>
        </div>
      )}

      <DataTableBulkBar
        actions={bulkActions?.(selectedRows.map((row) => row.original))}
        onClearSelection={() => table.resetRowSelection()}
        selectedCount={selectedRows.length}
        summaryLabel={selectedSummary}
      />

      {showClientPagination ? (
        <div className="shrink-0 border-t bg-muted/10 px-3 py-2">
          <PaginationBar
            onPageChange={(page) => table.setPageIndex(page - 1)}
            page={pageIndex + 1}
            totalPages={pageCount}
          />
        </div>
      ) : null}

      {/* Skip empty-list footers (e.g. "No results" + page 1) — the empty panel is enough. */}
      {footer && !isEmpty ? (
        <div className="shrink-0 border-t bg-muted/10 px-3 py-2">{footer}</div>
      ) : null}
    </div>
  );
}

function getStickyColumnClass(columnId: string, isHeader: boolean, isSelected = false) {
  if (columnId === "select") {
    return cn(
      "sticky left-0 w-12 min-w-12",
      isHeader
        ? "z-40 bg-card"
        : cn(
            "z-20",
            isSelected
              ? "bg-[color-mix(in_oklch,var(--card),var(--primary)_5%)] group-hover/row:bg-[color-mix(in_oklch,var(--card),var(--primary)_10%)]"
              : "bg-card group-hover/row:bg-[color-mix(in_oklch,var(--card),var(--muted)_40%)]",
          ),
    );
  }

  if (columnId === "actions") {
    return cn(
      "sticky right-0 w-14 min-w-14",
      isHeader
        ? "z-40 bg-card"
        : cn(
            "z-20",
            isSelected
              ? "bg-[color-mix(in_oklch,var(--card),var(--primary)_5%)] group-hover/row:bg-[color-mix(in_oklch,var(--card),var(--primary)_10%)]"
              : "bg-card group-hover/row:bg-[color-mix(in_oklch,var(--card),var(--muted)_40%)]",
          ),
    );
  }

  return isHeader ? "z-30" : "";
}
