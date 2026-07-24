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
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
  /** Quiet icon for the true-empty state (not used for filtered “no matches”). */
  emptyIcon?: React.ReactNode;
  filteredEmptyMessage?: string;
  filteredEmptyTitle?: string;
  /** Rendered under the scroll region (e.g. server PaginationControls). Always visible. */
  footer?: React.ReactNode;
  getRowId?: (row: TData) => string;
  globalFilter?: string;
  isFiltered?: boolean;
  /** Server/filter navigation pending — show table skeleton instead of “Updating…”. */
  isLoading?: boolean;
  onGlobalFilterChange?: (value: string) => void;
  pageSize?: number;
  selectedSummaryLabel?: string | ((selectedCount: number) => string);
  /** Thumbnail/avatar placeholder in loading skeleton (products, media). */
  skeletonShowMedia?: boolean;
  toolbar?: React.ReactNode;
  /**
   * Parent owns the card chrome + toolbar (e.g. shared Grid/List shell).
   * Skips outer border/margin so the switcher is not remounted on view change.
   */
  embedded?: boolean;
};

export function DataTable<TData>({
  bulkActions,
  columns,
  data,
  emptyMessage,
  emptyTitle,
  emptyIcon,
  filteredEmptyMessage,
  filteredEmptyTitle,
  footer,
  getRowId,
  globalFilter,
  isFiltered = false,
  isLoading = false,
  onGlobalFilterChange,
  pageSize,
  selectedSummaryLabel,
  skeletonShowMedia = false,
  toolbar,
  embedded = false,
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
  const shellClass = embedded
    ? "flex min-w-0 flex-col"
    : cn(
        "mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card",
        "shadow-[0_16px_40px_-20px_color-mix(in_oklch,var(--foreground)_22%,transparent)] ring-1 ring-foreground/[0.04]",
        "lg:mb-6",
      );

  const resolvedEmptyIcon = isFiltered ? (
    <AppIcons.search className="size-5" aria-hidden />
  ) : (
    (emptyIcon ?? <AppIcons.list className="size-5" aria-hidden />)
  );

  return (
    <div className={shellClass}>
      {!embedded && toolbar ? (
        <div className="shrink-0 border-b border-border/60 bg-muted/20 px-3 py-3 sm:px-4 sm:py-3.5">
          {toolbar}
        </div>
      ) : null}

      {isLoading ? (
        <ListTableSkeleton
          className={cn(
            "mb-0 rounded-none border-0 shadow-none",
            embedded && "rounded-none",
          )}
          columns={Math.min(6, Math.max(3, columns.length))}
          embedded
          rows={pageSize && pageSize > 0 ? Math.min(pageSize, 8) : 7}
          showMedia={skeletonShowMedia}
        />
      ) : isEmpty ? (
        <div className="flex min-h-52 items-center justify-center px-6 py-12 sm:min-h-60">
          <Empty className="max-w-sm gap-3 border-0 bg-transparent p-0">
            <EmptyHeader className="gap-2.5">
              <span className="text-muted-foreground/80">{resolvedEmptyIcon}</span>
              <EmptyTitle className="font-medium">{emptyStateTitle}</EmptyTitle>
              <EmptyDescription className="text-sm leading-relaxed">
                {emptyStateMessage}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
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
                          "h-12 sticky top-0 bg-[var(--table-sticky-header)] px-4 text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase",
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
                    className="group/row border-border/50 transition-colors hover:bg-muted/35 data-[state=selected]:bg-primary/[0.06] data-[state=selected]:hover:bg-primary/10"
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    key={row.id}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isSticky = cell.column.id === "select" || cell.column.id === "actions";
                      return (
                        <TableCell
                          className={cn(
                            "px-4 py-3.5",
                            isSticky
                              ? getStickyColumnClass(cell.column.id, false, row.getIsSelected())
                              : cn(
                                  "bg-card group-hover/row:bg-muted/35",
                                  row.getIsSelected() &&
                                    "bg-primary/[0.06] group-hover/row:bg-primary/10",
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

          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-12 z-10 w-6 bg-linear-to-r from-card to-transparent transition-opacity",
              canScrollLeft ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-14 z-10 w-6 bg-linear-to-l from-card to-transparent transition-opacity",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}

      <DataTableBulkBar
        actions={bulkActions?.(selectedRows.map((row) => row.original))}
        onClearSelection={() => table.resetRowSelection()}
        selectedCount={selectedRows.length}
        summaryLabel={selectedSummary}
      />

      {showClientPagination ? (
        <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3 py-2.5 sm:px-4">
          <PaginationBar
            onPageChange={(page) => table.setPageIndex(page - 1)}
            page={pageIndex + 1}
            totalPages={pageCount}
          />
        </div>
      ) : null}

      {footer && !isEmpty && !isLoading ? (
        <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3 py-2.5 sm:px-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

const stickyHeaderBg = "bg-[var(--table-sticky-header)]";

function getStickyColumnClass(columnId: string, isHeader: boolean, isSelected = false) {
  if (columnId === "select") {
    return cn(
      "sticky left-0 w-12 min-w-12",
      isHeader
        ? cn("z-40", stickyHeaderBg)
        : cn(
            "z-20",
            isSelected
              ? "bg-[var(--table-sticky-cell-selected)] group-hover/row:bg-[var(--table-sticky-cell-selected-hover)]"
              : "bg-[var(--table-sticky-cell)] group-hover/row:bg-[var(--table-sticky-cell-hover)]",
          ),
    );
  }

  if (columnId === "actions") {
    return cn(
      "sticky right-0 w-14 min-w-14",
      isHeader
        ? cn("z-40", stickyHeaderBg)
        : cn(
            "z-20",
            isSelected
              ? "bg-[var(--table-sticky-cell-selected)] group-hover/row:bg-[var(--table-sticky-cell-selected-hover)]"
              : "bg-[var(--table-sticky-cell)] group-hover/row:bg-[var(--table-sticky-cell-hover)]",
          ),
    );
  }

  return isHeader ? "z-30" : "";
}
