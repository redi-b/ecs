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
import { useState } from "react";

import { DataTableBulkBar } from "@/components/app/data-table-bulk-bar";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="mb-4 w-full min-w-0 overflow-hidden rounded-[1.35rem] border bg-card/95 shadow-sm shadow-primary/5 lg:mb-6">
      {toolbar ? <div className="border-b bg-muted/20 p-3">{toolbar}</div> : null}
      <div className="max-w-full overflow-hidden">
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      "h-11 bg-card px-4 text-xs uppercase text-muted-foreground",
                      getStickyColumnClass(header.column.id),
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
                        getStickyColumnClass(cell.column.id),
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
      {isPaginated && rows.length ? (
        <div className="flex items-center justify-between gap-3 border-t bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="sm"
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="sm"
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getStickyColumnClass(columnId: string) {
  if (columnId === "select") {
    return "sticky left-0 z-20 w-12 min-w-12";
  }

  if (columnId === "actions") {
    return "sticky right-0 z-20 w-14 min-w-14";
  }

  return "";
}
