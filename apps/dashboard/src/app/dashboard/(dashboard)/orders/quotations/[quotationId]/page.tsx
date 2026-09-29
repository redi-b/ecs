import { merchantQuotationTotal } from "@ecs/contracts";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { ConvertQuotationButton } from "@/features/orders/convert-quotation-button";
import { ReviseQuotationButton } from "@/features/orders/revise-quotation-button";
import { getTranslations } from "@/i18n/server";
import { getMerchantQuotation } from "@/lib/merchant-orders";

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  const requestHeaders = await headers();
  const result = await getMerchantQuotation({
    cookieHeader: requestHeaders.get("cookie"),
    quotationId,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
  });
  if (!result.ok) notFound();
  const t = await getTranslations();
  const quote = result.quotation;
  const snapshot = quote.snapshot;
  const customer =
    [snapshot.customer.firstName, snapshot.customer.lastName].filter(Boolean).join(" ") ||
    snapshot.customer.phone ||
    snapshot.customer.email ||
    t("orders.drafts.customerPending");
  const total = merchantQuotationTotal(snapshot);
  return (
    <PageShell
      actions={
        quote.status === "issued" ? (
          <>
            <ReviseQuotationButton
              draftId={snapshot.draftId}
              quotationId={quote.id}
              revision={quote.currentRevision}
            />
            <ConvertQuotationButton quotationId={quote.id} />
          </>
        ) : null
      }
      eyebrow={t("orders.quotes.eyebrow")}
      title={quote.number}
    >
      <div className="detail-surface space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="type-meta text-muted-foreground">{t("orders.quotes.customer")}</p>
            <p className="font-medium">{customer}</p>
          </div>
          <Badge variant="outline">{t(`orders.quotes.status.${quote.status}`)}</Badge>
        </header>
        <section className="grid gap-5 sm:grid-cols-3">
          <div>
            <p className="type-meta text-muted-foreground">{t("orders.quotes.validUntil")}</p>
            <p>
              {new Intl.DateTimeFormat(snapshot.language === "am" ? "am-ET" : "en-ET", {
                dateStyle: "medium",
                timeZone: "Africa/Addis_Ababa",
              }).format(new Date(snapshot.expiresAt))}
            </p>
          </div>
          <div>
            <p className="type-meta text-muted-foreground">{t("orders.quotes.items")}</p>
            <p>{snapshot.items.length}</p>
          </div>
          <div>
            <p className="type-meta text-muted-foreground">{t("orders.quotes.total")}</p>
            <p className="font-medium">
              {new Intl.NumberFormat(snapshot.language === "am" ? "am-ET" : "en-ET", {
                maximumFractionDigits: 2,
              }).format(total)}{" "}
              ETB
            </p>
          </div>
        </section>
        <section>
          <h2 className="type-section-title mb-3">{t("orders.quotes.lines")}</h2>
          <div className="divide-y rounded-[var(--radius)] border">
            {snapshot.items.map((item, index) => (
              <div
                className="flex justify-between gap-4 px-4 py-3"
                key={`${item.variantId}-${index}`}
              >
                <span>
                  {t("orders.quotes.lineLabel", { number: index + 1, quantity: item.quantity })}
                </span>
                <span>
                  {new Intl.NumberFormat(snapshot.language === "am" ? "am-ET" : "en-ET", {
                    maximumFractionDigits: 2,
                  }).format((item.unitPrice ?? 0) * item.quantity)}{" "}
                  ETB
                </span>
              </div>
            ))}
          </div>
        </section>
        {result.revisions.length > 1 ? (
          <section>
            <h2 className="type-section-title">{t("orders.quotes.history")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("orders.quotes.revisionCount", { count: result.revisions.length })}
            </p>
          </section>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("orders.quotes.notInvoice")}</p>
      </div>
    </PageShell>
  );
}
