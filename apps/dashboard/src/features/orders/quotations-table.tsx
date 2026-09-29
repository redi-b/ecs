"use client";

import type { MerchantQuotationSummary } from "@ecs/contracts";
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

export function QuotationsTable({ quotations }: { quotations: MerchantQuotationSummary[] }) {
  const { formatDate, formatNumber, t } = useI18n();
  if (!quotations.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[var(--radius)] border bg-card px-6 text-center">
        <AppIcons.orders aria-hidden="true" className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="type-section-title">{t("orders.quotes.emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("orders.quotes.emptyMessage")}
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
            <TableHead>{t("orders.quotes.number")}</TableHead>
            <TableHead>{t("orders.quotes.customer")}</TableHead>
            <TableHead>{t("orders.quotes.total")}</TableHead>
            <TableHead>{t("orders.quotes.validUntil")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("table.headers.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.map((quote) => (
            <TableRow key={quote.id}>
              <TableCell className="font-medium">{quote.number}</TableCell>
              <TableCell>{quote.customerLabel || t("orders.drafts.customerPending")}</TableCell>
              <TableCell>{formatNumber(quote.total, { maximumFractionDigits: 2 })} ETB</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(quote.expiresAt)}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={dashboardRoutes.orderQuotation(quote.id)}>
                    {t("orders.quotes.open")}
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
