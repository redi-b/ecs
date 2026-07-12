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
import { useEffect, useState } from "react";

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
  emptyTitle = "No rows yet",
  filteredEmptyMessage,
  filteredEmptyTitle = "No matching rows",
  footer,
  getRowId,
  globalFilter,
  isFiltered = false,
  onGlobalFilterChange,
  pageSize,
  selectedSummaryLabel = "selected",
  toolbar,
}: DataTableProps<TData>) {
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
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length;
  const emptyStateMessage =
    isFiltered && rows.length === 0 ? (filteredEmptyMessage ?? emptyMessage) : emptyMessage;
  const emptyStateTitle = isFiltered && rows.length === 0 ? filteredEmptyTitle : emptyTitle;
  const selectedSummary =
    typeof selectedSummaryLabel === "function"
      ? selectedSummaryLabel(selectedRows.length)
      : selectedSummaryLabel;

  const pageCount = Math.max(1, table.getPageCount());
  const pageIndex = table.getState().pagination.pageIndex;
  const showClientPagination = isPaginated && data.length > 0;

  return (
    <div className="mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border bg-card/95 lg:mb-6">
      {toolbar ? (
        <div className="shrink-0 border-b bg-muted/20 p-3">{toolbar}</div>
      ) : null}

      {/*
        Scroll region owns vertical overflow so:
        - thead can stick at top of the table body
        - footer pagination stays visible without scrolling past every row
      */}
      <div className="relative max-h-[min(36rem,calc(100dvh-14rem))] min-h-0 overflow-auto">
        <Table className="min-w-max">
          <TableHeader className="sticky top-0 z-30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      // Muted solid surface + layered edge so body rows never blend into chrome.
                      "h-11 border-b border-border/80 bg-muted/55 px-4 text-xs uppercase tracking-wide text-muted-foreground",
                      "sticky top-0 shadow-[inset_0_-1px_0_0_var(--border),0_4px_10px_-6px_rgba(0,0,0,0.18)]",
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
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  className="group/row transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5 data-[state=selected]:hover:bg-primary/10"
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cn(
                        "bg-card px-4 py-3 group-hover/row:bg-muted/40",
                        row.getIsSelected() && "bg-primary/5 group-hover/row:bg-primary/10",
                        getStickyColumnClass(cell.column.id, false),
                      )}
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-52 px-4" colSpan={visibleColumnCount}>
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <AppIcons.search data-icon="inline-start" />
                      </EmptyMedia>
                      <EmptyTitle>{emptyStateTitle}</EmptyTitle>
                      <EmptyDescription>{emptyStateMessage}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

      {footer ? (
        <div className="shrink-0 border-t bg-muted/10 px-3 py-2">{footer}</div>
      ) : null}
    </div>
  );
}

function getStickyColumnClass(columnId: string, isHeader: boolean) {
  if (columnId === "select") {
    return cn(
      "sticky left-0 w-12 min-w-12",
      // Match header chrome tint so sticky edge columns stay opaque while scrolling.
      isHeader ? "z-40 bg-muted/55" : "z-20 bg-card group-hover/row:bg-muted/40",
    );
  }

  if (columnId === "actions") {
    return cn(
      "sticky right-0 w-14 min-w-14",
      isHeader ? "z-40 bg-muted/55" : "z-20 bg-card group-hover/row:bg-muted/40",
    );
  }

  return isHeader ? "z-30" : "";
}
