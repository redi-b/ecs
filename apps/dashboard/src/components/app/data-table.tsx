"use client";

import { useState } from "react";
import type * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { DataTableBulkBar } from "@/components/app/data-table-bulk-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData> = {
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyMessage: string;
  filteredEmptyMessage?: string;
  getRowId?: (row: TData) => string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  selectedSummaryLabel?: string;
  toolbar?: React.ReactNode;
};

export function DataTable<TData>({
  bulkActions,
  columns,
  data,
  emptyMessage,
  filteredEmptyMessage,
  getRowId,
  globalFilter,
  onGlobalFilterChange,
  toolbar,
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    columns,
    data,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
    onGlobalFilterChange: (updater) => {
      const nextValue =
        typeof updater === "function" ? updater(globalFilter ?? "") : updater;

      onGlobalFilterChange?.(String(nextValue ?? ""));
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      globalFilter,
      rowSelection,
      sorting,
    },
  });

  const rows = table.getRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const emptyStateMessage =
    data.length > 0 && rows.length === 0 ? (filteredEmptyMessage ?? emptyMessage) : emptyMessage;

  return (
    <div className="overflow-hidden rounded-[1.35rem] border bg-card/95 shadow-sm shadow-primary/5">
      {toolbar ? <div className="border-b bg-muted/20 p-3">{toolbar}</div> : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className="h-11 px-4 text-xs uppercase text-muted-foreground"
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
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="px-4 py-3" key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-40 px-4 text-center text-sm text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyStateMessage}
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
      />
    </div>
  );
}
