"use client";

import type { MerchantQuotationSummary } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/app/data-table";
import { AppIcons } from "@/components/app/icons";
import { useI18n } from "@/i18n/provider";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";

export function QuotationsTable({ quotations }: { quotations: MerchantQuotationSummary[] }) {
  const { formatDate, formatNumber, t } = useI18n();
  const columns = useMemo<ColumnDef<MerchantQuotationSummary>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("orders.quotes.number"),
        cell: ({ row }) => (
          <Link
            className={`${listEntityLinkClassName} font-mono`}
            href={dashboardRoutes.orderQuotation(row.original.id)}
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: "customerLabel",
        header: t("orders.quotes.customer"),
        cell: ({ row }) => row.original.customerLabel || t("orders.drafts.customerPending"),
      },
      {
        accessorKey: "total",
        header: t("orders.quotes.total"),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.pricingComplete
              ? `${formatNumber(row.original.total, { maximumFractionDigits: 2 })} ETB`
              : t("orders.quotes.incompleteShort")}
          </span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: t("orders.quotes.validUntil"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.expiresAt)}</span>
        ),
      },
    ],
    [formatDate, formatNumber, t],
  );

  return (
    <DataTable
      columns={columns}
      data={quotations}
      emptyIcon={<AppIcons.orders aria-hidden="true" className="size-8" />}
      emptyMessage={t("orders.quotes.emptyMessage")}
      emptyTitle={t("orders.quotes.emptyTitle")}
      enableSorting={false}
      getRowId={(quote) => quote.id}
    />
  );
}
