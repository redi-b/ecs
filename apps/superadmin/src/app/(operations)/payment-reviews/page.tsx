import { CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { OperationsDataState } from "@/components/operations-data-state";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperationsPagination } from "@/components/operations-pagination";
import { OperatorReadError } from "@/components/operator-read-error";
import { RefreshPageButton } from "@/components/refresh-page-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentReviewActions } from "@/features/superadmin/payment-review-actions";
import { getBillingPaymentReviews } from "@/lib/platform-api/superadmin/console";

export default async function PaymentReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number.parseInt((await searchParams)?.page ?? "1", 10) || 1);
  const limit = 20;
  const requestHeaders = await headers();
  const result = await getBillingPaymentReviews({
    cookieHeader: requestHeaders.get("cookie"),
    limit,
    offset: (page - 1) * limit,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "billing_unavailable", status: 503 }));

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        actions={<RefreshPageButton label="Refresh payment reviews" />}
        description="Confirm or reject submitted plan payments without opening each merchant."
        title="Payment reviews"
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Payment reviews"
          status={result.status}
          unavailableDescription="Submitted payments could not be loaded."
        />
      ) : result.data.items.length ? (
        <>
          <OperationsListShell status={`${result.data.count} waiting`}>
            <div className="divide-y">
            {result.data.items.map((item) => (
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center" key={item.evidenceId}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.tenantName}</p>
                    <Badge variant="outline">{formatProvider(item.provider)}</Badge>
                    <Badge variant="warning">Needs review</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatMoney(item.amount, item.currency)} · @{item.tenantHandle} · {formatDate(item.createdAt)}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{item.reference}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/tenants/${item.tenantId}`}>Merchant details</Link>
                  </Button>
                  <PaymentReviewActions
                    invoiceId={item.invoiceId}
                    provider={item.provider}
                    reference={item.reference}
                    tenantId={item.tenantId}
                  />
                </div>
              </div>
            ))}
            </div>
          </OperationsListShell>
          <OperationsPagination
            basePath="/payment-reviews"
            count={result.data.count}
            page={page}
            pageSize={limit}
            resourceLabel="payments"
          />
        </>
      ) : (
        <OperationsDataState
          description="New payment evidence will appear here when an automatic check cannot decide."
          icon={CheckCircle2}
          title="No payments waiting"
        />
      )}
    </div>
  );
}

function formatProvider(value: string) {
  return value.toLowerCase() === "cbe" ? "CBE" : value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  return new Intl.NumberFormat("en-ET", { currency, style: "currency" }).format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
