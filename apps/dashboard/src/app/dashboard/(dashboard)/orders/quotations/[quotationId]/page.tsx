import { merchantQuotationTotal } from "@ecs/contracts";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConvertQuotationButton } from "@/features/orders/convert-quotation-button";
import { QuotationPageActions } from "@/features/orders/quotation-page-actions";
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
  const pricingComplete = snapshot.items.every((item) => typeof item.unitPrice === "number");
  const locale = snapshot.language === "am" ? "am-ET" : "en-ET";
  const branding = snapshot.branding;
  const documentAccent = branding?.accentColor ?? "#18181b";
  const formatMoney = (value: number | null | undefined) =>
    typeof value === "number"
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ETB`
      : "—";
  return (
    <PageShell
      actions={
        <>
          {quote.status === "issued" ? (
            <ReviseQuotationButton
              draftId={snapshot.draftId}
              expiresAt={snapshot.expiresAt}
              quotationId={quote.id}
              revision={quote.currentRevision}
            />
          ) : null}
          <QuotationPageActions />
          {quote.status === "issued" && pricingComplete ? (
            <ConvertQuotationButton quotationId={quote.id} />
          ) : null}
        </>
      }
      title={quote.number}
    >
      <DashboardBreadcrumbLabel label={quote.number} labelKey="quotation-details" />
      {!pricingComplete ? (
        <Alert className="print:hidden" variant="destructive">
          <AlertTitle>{t("orders.quotes.incompleteTitle")}</AlertTitle>
          <AlertDescription>{t("orders.quotes.incompleteDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <article className="mx-auto w-full max-w-4xl rounded-xl border bg-card shadow-sm print:max-w-none print:rounded-none print:border-0 print:bg-white print:text-zinc-950 print:shadow-none">
        <div className="space-y-8 p-6 sm:p-10 print:p-0 print:pt-5">
          <header className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              {branding?.logoUrl ? (
                // biome-ignore lint/performance/noImgElement: Issued snapshots preserve the merchant's public logo URL.
                <img
                  alt=""
                  className="mb-5 h-12 max-w-44 object-contain object-left"
                  src={branding.logoUrl}
                />
              ) : null}
              <p className="text-base font-semibold tracking-tight">{snapshot.sellerName}</p>
              {branding?.phone || branding?.email || branding?.address ? (
                <div className="mt-2 max-w-md space-y-0.5 text-xs leading-relaxed text-muted-foreground">
                  {branding.phone ? <p>{branding.phone}</p> : null}
                  {branding.email ? <p>{branding.email}</p> : null}
                  {branding.address ? <p>{branding.address}</p> : null}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold tracking-tight">{t("orders.quotes.eyebrow")}</p>
              <h1 className="mt-1 font-mono text-xl font-semibold tabular-nums">{quote.number}</h1>
              <div
                className="ml-auto mt-3 w-12 border-t-2"
                style={{ borderColor: documentAccent }}
              />
              <p className="mt-2 text-xs capitalize text-muted-foreground print:hidden">
                {t(`orders.quotes.status.${quote.status}`)}
              </p>
            </div>
          </header>
          <section className="grid gap-6 rounded-xl bg-muted/25 p-5 sm:grid-cols-2 print:bg-muted/15">
            <div>
              <p className="type-meta text-muted-foreground">{t("orders.quotes.customer")}</p>
              <p className="font-medium">{customer}</p>
              {snapshot.customer.phone ? (
                <p className="text-sm">{snapshot.customer.phone}</p>
              ) : null}
              {snapshot.customer.email ? (
                <p className="text-sm">{snapshot.customer.email}</p>
              ) : null}
            </div>
            <div>
              <p className="type-meta text-muted-foreground">{t("orders.quotes.issuedAt")}</p>
              <p>{formatDate(snapshot.issuedAt, locale)}</p>
              <p className="mt-3 type-meta text-muted-foreground">
                {t("orders.quotes.validUntil")}
              </p>
              <p>{formatDate(snapshot.expiresAt, locale)}</p>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">{t("orders.quotes.lines")}</h2>
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_7rem] gap-3 border-b border-foreground/20 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t("orders.detail.item")}</span>
                <span className="text-right">{t("orders.detail.qty")}</span>
                <span className="text-right">{t("orders.quotes.unitPrice")}</span>
                <span className="text-right">{t("orders.detail.total")}</span>
              </div>
              {snapshot.items.map((item, index) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_7rem] items-start gap-3 border-b border-border/50 py-4 last:border-b-0"
                  key={`${item.variantId}-${index}`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {item.productTitle ?? t("orders.quotes.itemFallback", { number: index + 1 })}
                    </span>
                    {item.variantTitle || item.sku ? (
                      <span className="block text-xs text-muted-foreground">
                        {[item.variantTitle, item.sku].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums">{item.quantity}</span>
                  <span className="text-right font-mono text-sm tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </span>
                  <span className="text-right font-mono text-sm font-medium tabular-nums">
                    {formatMoney(
                      typeof item.unitPrice === "number" ? item.unitPrice * item.quantity : null,
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="ml-auto flex max-w-sm items-center justify-between border-t-2 px-1 py-3 font-semibold"
              style={{ borderColor: documentAccent }}
            >
              <span className="text-sm">{t("orders.quotes.total")}</span>
              <span className="font-mono text-lg tabular-nums">
                {pricingComplete ? formatMoney(total) : "—"}
              </span>
            </div>
          </section>
          {result.revisions.length > 1 ? (
            <section className="print:hidden">
              <h2 className="type-section-title">{t("orders.quotes.history")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("orders.quotes.revisionCount", { count: result.revisions.length })}
              </p>
            </section>
          ) : null}
          {snapshot.note ? (
            <section className="rounded-lg bg-muted/20 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{snapshot.note}</p>
            </section>
          ) : null}
          <footer className="flex flex-col gap-3 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
            <div>
              {branding?.footerNote ? (
                <p className="mb-1 text-foreground">{branding.footerNote}</p>
              ) : null}
              <p>{t("orders.quotes.notInvoice")}</p>
            </div>
            <p className="font-mono tabular-nums">{quote.number}</p>
          </footer>
        </div>
      </article>
    </PageShell>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Africa/Addis_Ababa",
  }).format(new Date(value));
}
