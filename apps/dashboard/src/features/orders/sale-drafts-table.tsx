"use client";

import type { MerchantSaleDraftSummary } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/app/data-table";
import { AppIcons } from "@/components/app/icons";
import { useI18n } from "@/i18n/provider";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import { IssueQuotationButton } from "./issue-quotation-button";

export function SaleDraftsTable({ drafts }: { drafts: MerchantSaleDraftSummary[] }) {
  const { formatDateTime, t } = useI18n();
  const columns = useMemo<ColumnDef<MerchantSaleDraftSummary>[]>(
    () => [
      {
        accessorKey: "customerLabel",
        header: t("orders.drafts.customer"),
        cell: ({ row }) => (
          <Link
            className={listEntityLinkClassName}
            href={`${dashboardRoutes.orders}?view=drafts&draft=${encodeURIComponent(row.original.id)}`}
          >
            {row.original.customerLabel || t("orders.drafts.customerPending")}
          </Link>
        ),
      },
      {
        accessorKey: "itemCount",
        header: t("orders.drafts.items"),
        cell: ({ row }) => t("orders.drafts.itemCount", { count: row.original.itemCount }),
      },
      {
        accessorKey: "updatedAt",
        header: t("orders.drafts.updated"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.updatedAt)}</span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <IssueQuotationButton
              disabled={row.original.itemCount === 0}
              draftId={row.original.id}
            />
          </div>
        ),
      },
    ],
    [formatDateTime, t],
  );

  return (
    <DataTable
      columns={columns}
      data={drafts}
      emptyIcon={<AppIcons.folder aria-hidden="true" className="size-8" />}
      emptyMessage={t("orders.drafts.emptyMessage")}
      emptyTitle={t("orders.drafts.emptyTitle")}
      enableSorting={false}
      getRowId={(draft) => draft.id}
    />
  );
}
