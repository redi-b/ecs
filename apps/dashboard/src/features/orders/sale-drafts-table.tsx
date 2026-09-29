"use client";

import type { MerchantSaleDraftSummary } from "@ecs/contracts";
import Link from "next/link";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

export function SaleDraftsTable({ drafts }: { drafts: MerchantSaleDraftSummary[] }) {
  const { formatDateTime, t } = useI18n();
  if (drafts.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[var(--radius)] border bg-card px-6 text-center">
        <AppIcons.folder aria-hidden="true" className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="type-section-title">{t("orders.drafts.emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("orders.drafts.emptyMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("orders.drafts.customer")}</TableHead>
            <TableHead>{t("orders.drafts.items")}</TableHead>
            <TableHead>{t("orders.drafts.updated")}</TableHead>
            <TableHead className="w-28 text-right">
              <span className="sr-only">{t("table.headers.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft) => (
            <TableRow key={draft.id}>
              <TableCell className="font-medium">
                {draft.customerLabel || t("orders.drafts.customerPending")}
              </TableCell>
              <TableCell>{t("orders.drafts.itemCount", { count: draft.itemCount })}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(draft.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={`${dashboardRoutes.orders}?draft=${encodeURIComponent(draft.id)}`}>
                    {t("orders.drafts.resume")}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
