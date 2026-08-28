"use client";

import type { SuperadminTenant } from "@ecs/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { OperationsPagination } from "@/components/operations-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DirectoryData = { tenants: SuperadminTenant[]; count: number; limit: number; offset: number };
const pageSize = 20;
const helper = createColumnHelper<SuperadminTenant>();

export function MerchantDirectory({
  initialData,
  initialPage,
  initialQuery,
}: {
  initialData: DirectoryData;
  initialPage: number;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const result = useQuery({
    queryKey: ["operations", "merchants", { page, query }],
    queryFn: ({ signal }) => fetchDirectory(query, page, signal),
    initialData: page === initialPage && query === initialQuery ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () => [
      helper.accessor("name", {
        header: "Merchant",
        cell: ({ row }) => (
          <Link
            className="group/link block min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/tenants/${row.original.id}`}
          >
            <p className="truncate font-medium transition-colors group-hover/link:text-primary">
              {row.original.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">@{row.original.handle}</p>
            {row.original.ownerEmail ? (
              <p className="truncate text-xs text-muted-foreground">{row.original.ownerEmail}</p>
            ) : null}
          </Link>
        ),
      }),
      helper.accessor("status", {
        header: "Status",
        cell: (info) => <Badge variant="outline">{formatStatus(info.getValue())}</Badge>,
      }),
      helper.accessor("primaryDomainHostname", {
        header: "Storefront",
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() ?? "Not assigned"}</span>
        ),
      }),
      helper.display({
        id: "open",
        cell: ({ row }) => (
          <Link
            aria-label={`Open ${row.original.name}`}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-[color,background-color,transform] hover:translate-x-0.5 hover:bg-muted hover:text-foreground"
            href={`/tenants/${row.original.id}`}
          >
            <ArrowRight />
          </Link>
        ),
      }),
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: result.data?.tenants ?? [],
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: result.data?.count ?? 0,
  });

  function updateUrl(nextQuery: string, nextPage: number) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextPage > 1) params.set("page", String(nextPage));
    window.history.pushState(null, "", params.size ? `/merchants?${params}` : "/merchants");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim().slice(0, 100);
    setQuery(next);
    setPage(1);
    updateUrl(next, 1);
  }
  function changePage(next: number) {
    setPage(next);
    updateUrl(query, next);
  }

  return (
    <div className="flex flex-col gap-5">
      {result.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Merchant directory unavailable</EmptyTitle>
            <EmptyDescription>Try the search again in a moment.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : table.getRowModel().rows.length ? (
        <>
          <div
            className="overflow-hidden rounded-2xl border bg-card shadow-xs transition-opacity duration-200 data-[pending=true]:opacity-65"
            data-pending={result.isPlaceholderData}
          >
            <div className="flex flex-col gap-3 border-b bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <form className="flex min-w-0 flex-1 gap-2 sm:max-w-2xl" onSubmit={submit}>
                <Input
                  aria-label="Search merchants"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search name, handle, or owner email"
                  value={draft}
                />
                <Button disabled={result.isFetching} type="submit">
                  {result.isFetching ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Search data-icon="inline-start" />
                  )}
                  Search
                </Button>
              </form>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {result.data?.count ?? 0} merchants
                </span>
                <Button
                  aria-label="Refresh merchants"
                  disabled={result.isFetching}
                  onClick={() => result.refetch()}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  {result.isFetching ? <Spinner /> : <RefreshCw />}
                </Button>
              </div>
            </div>
            <div className="max-h-[min(65vh,48rem)] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead
                          className={
                            header.column.id === "open"
                              ? "w-12"
                              : header.column.id === "status"
                                ? "hidden w-40 sm:table-cell"
                                : header.column.id === "primaryDomainHostname"
                                  ? "hidden w-56 md:table-cell"
                                  : ""
                          }
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow className="group transition-colors hover:bg-muted/55" key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          className={
                            cell.column.id === "status"
                              ? "hidden sm:table-cell"
                              : cell.column.id === "primaryDomainHostname"
                                ? "hidden md:table-cell"
                                : ""
                          }
                          key={cell.id}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <OperationsPagination
            count={result.data?.count ?? 0}
            onPageChange={changePage}
            page={page}
            pageSize={pageSize}
            pending={result.isPlaceholderData}
          />
        </>
      ) : (
        <Empty className="rounded-2xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>{query ? "No matching merchants" : "No merchants yet"}</EmptyTitle>
            <EmptyDescription>
              {query
                ? "Try a different name, handle, or owner email."
                : "Merchants will appear here after onboarding begins."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

async function fetchDirectory(
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<DirectoryData> {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  });
  if (query) params.set("q", query);
  const response = await fetch(`/api/tenants?${params}`, { signal });
  if (!response.ok) throw new Error("merchant_directory_unavailable");
  return response.json() as Promise<DirectoryData>;
}
function formatStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
