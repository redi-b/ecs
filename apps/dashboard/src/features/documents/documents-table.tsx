"use client";

import type {
  MerchantOperationsDocumentKind,
  MerchantOperationsDocumentSummary,
} from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { DataTable } from "@/components/app/data-table";
import { type DataTableFilter, DataTableFilters } from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import type { ResourceRowActions } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

const kinds: MerchantOperationsDocumentKind[] = [
  "quotation",
  "order_summary",
  "payment_receipt",
  "packing_slip",
];

export function DocumentsTable({
  documents,
  footer,
  from,
  initialQuery,
  kind,
  to,
}: {
  documents: MerchantOperationsDocumentSummary[];
  footer?: ReactNode;
  from: string;
  initialQuery: string;
  kind: MerchantOperationsDocumentKind | "all";
  to: string;
}) {
  const { formatDate, formatNumber, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);

  const pushFilters = useCallback(
    (
      next: Partial<{
        from: string;
        kind: MerchantOperationsDocumentKind | "all";
        q: string;
        to: string;
      }>,
    ) => {
      const values = { from, kind, q: initialQuery, to, ...next };
      const url = new URL(window.location.href);
      setParam(url, "q", values.q, "");
      setParam(url, "kind", values.kind, "all");
      setParam(url, "from", values.from, "");
      setParam(url, "to", values.to, "");
      url.searchParams.delete("page");
      startTransition(() => router.push(`${url.pathname}?${url.searchParams.toString()}`));
    },
    [from, initialQuery, kind, router, to],
  );

  const clearFilters = useCallback(() => {
    setSearchValue("");
    const url = new URL(window.location.href);
    for (const key of ["q", "kind", "from", "to", "page"]) url.searchParams.delete(key);
    startTransition(() => router.push(url.pathname));
  }, [router]);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        defaultValue: "all",
        id: "kind",
        label: t("documents.type"),
        onChange: (value) => pushFilters({ kind: value as MerchantOperationsDocumentKind | "all" }),
        options: [
          { label: t("documents.allTypes"), value: "all" },
          ...kinds.map((value) => ({ label: t(`documents.types.${value}`), value })),
        ],
        value: kind,
      },
      {
        id: "date",
        kind: "date",
        label: t("documents.issued"),
        onChange: (value) =>
          pushFilters({
            from: value?.kind === "range" ? value.start : "",
            to: value?.kind === "range" ? value.end : "",
          }),
        options: [],
        value: from && to ? { end: to, kind: "range", start: from } : null,
      },
    ],
    [from, kind, pushFilters, t, to],
  );

  const columns = useMemo<ColumnDef<MerchantOperationsDocumentSummary>[]>(
    () => [
      {
        id: "document",
        header: t("documents.document"),
        cell: ({ row }) => (
          <div className="min-w-40">
            <Link className="font-medium hover:underline" href={detailHref(row.original)}>
              {row.original.number}
            </Link>
            {row.original.orderReference ? (
              <p className="text-xs text-muted-foreground">{row.original.orderReference}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "kind",
        header: t("documents.type"),
        cell: ({ row }) => (
          <Badge variant="outline">{t(`documents.types.${row.original.kind}`)}</Badge>
        ),
      },
      {
        accessorKey: "customerLabel",
        header: t("documents.customer"),
        cell: ({ row }) => row.original.customerLabel || "—",
      },
      {
        accessorKey: "issuedAt",
        header: t("documents.issued"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.issuedAt)}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: () => <span className="block text-right">{t("documents.total")}</span>,
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right font-mono tabular-nums">
            {row.original.total == null ? "—" : `${formatNumber(row.original.total)} ETB`}
          </span>
        ),
      },
    ],
    [formatDate, formatNumber, t],
  );

  const rowActions = useCallback(
    (document: MerchantOperationsDocumentSummary): ResourceRowActions => ({
      actions: [
        {
          href: detailHref(document),
          icon: AppIcons.documents,
          label: t("documents.viewPrint"),
          type: "link",
        },
        ...(document.kind !== "quotation" && document.orderId
          ? [
              {
                href: dashboardRoutes.orderDetail(document.orderId),
                icon: AppIcons.orders,
                label: t("documents.openSource"),
                type: "link" as const,
              },
            ]
          : []),
      ],
      label: t("documents.rowActions"),
    }),
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={documents}
      emptyIcon={<AppIcons.documents aria-hidden className="size-8" />}
      emptyMessage={t("documents.emptyMessage")}
      emptyTitle={t("documents.emptyTitle")}
      enableSorting={false}
      filteredEmptyMessage={t("documents.filteredEmptyMessage")}
      filteredEmptyTitle={t("documents.filteredEmptyTitle")}
      footer={footer}
      getRowId={(document) => `${document.kind}:${document.id}`}
      isFiltered={Boolean(initialQuery || from || to || kind !== "all")}
      isLoading={pending}
      rowActions={rowActions}
      toolbar={
        <DataTableFilters filters={filters} onClearAll={clearFilters}>
          <ListToolbarSearch
            clearLabel={t("common.clearSearch")}
            label={t("documents.searchLabel")}
            onChange={(value) => {
              setSearchValue(value);
              pushFilters({ q: value });
            }}
            placeholder={t("documents.searchPlaceholder")}
            value={searchValue}
          />
        </DataTableFilters>
      }
    />
  );
}

function detailHref(document: MerchantOperationsDocumentSummary) {
  return document.kind === "quotation"
    ? dashboardRoutes.orderQuotation(document.id)
    : dashboardRoutes.salesDocument(document.id);
}

function setParam(url: URL, key: string, value: string, defaultValue: string) {
  if (value && value !== defaultValue) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
}
