import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { PageShell } from "@/components/app/page-shell";
import {
  formatOrderMoney,
  getOrderCustomerName,
  getOrderCustomerPhone,
} from "@/features/orders/order-domain";
import { PrintSalesDocumentButton } from "@/features/orders/print-sales-document-button";
import { getTranslations } from "@/i18n/server";
import { getMerchantSalesDocument } from "@/lib/merchant-orders";

export default async function SalesDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const [{ documentId }, cookieStore, requestHeaders, t] = await Promise.all([
    params,
    cookies(),
    headers(),
    getTranslations(),
  ]);
  const result = await getMerchantSalesDocument({
    cookieHeader: cookieStore.toString(),
    documentId,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
  });
  if (!result.ok) notFound();
  const { document } = result;
  const { order } = document.snapshot;
  const address = order.shippingAddress;
  const addressLine = [address?.address1, address?.address2, address?.city, address?.province]
    .filter(Boolean)
    .join(", ");
  const kind =
    document.kind === "payment_receipt"
      ? t("orders.documents.kinds.payment_receipt")
      : document.kind === "packing_slip"
        ? t("orders.documents.kinds.packing_slip")
        : t("orders.documents.kinds.order_summary");
  const branding = document.snapshot.branding;
  const documentAccent = branding?.accentColor ?? "#18181b";

  return (
    <PageShell actions={<PrintSalesDocumentButton />} title={`${kind} ${document.number}`}>
      <DashboardBreadcrumbLabel label={document.snapshot.orderReference} labelKey="order-details" />
      <DashboardBreadcrumbLabel label={order.id} labelKey="sales-document-order-id" />
      <DashboardBreadcrumbLabel
        label={`${kind} ${document.number}`}
        labelKey="sales-document-details"
      />
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
              <p className="text-base font-semibold tracking-tight">
                {document.snapshot.sellerName}
              </p>
              {branding?.phone || branding?.email || branding?.address ? (
                <div className="mt-2 max-w-md space-y-0.5 text-xs leading-relaxed text-muted-foreground">
                  {branding.phone ? <p>{branding.phone}</p> : null}
                  {branding.email ? <p>{branding.email}</p> : null}
                  {branding.address ? <p>{branding.address}</p> : null}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold tracking-tight">{kind}</p>
              <h1 className="mt-1 font-mono text-xl font-semibold tabular-nums">
                {document.number}
              </h1>
              <div
                className="ml-auto mt-3 w-12 border-t-2"
                style={{ borderColor: documentAccent }}
              />
            </div>
          </header>
          <div className="grid gap-6 rounded-xl bg-muted/25 p-5 sm:grid-cols-2 print:bg-muted/15">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("orders.documents.order")}
              </p>
              <p className="mt-1 font-medium">{document.snapshot.orderReference}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("orders.detail.customer")}
              </p>
              <p className="mt-1 font-medium">{getOrderCustomerName(order)}</p>
              {getOrderCustomerPhone(order) ? (
                <p className="text-sm">{getOrderCustomerPhone(order)}</p>
              ) : null}
              {addressLine ? <p className="text-sm text-muted-foreground">{addressLine}</p> : null}
            </div>
          </div>
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">{t("orders.detail.item")}</th>
                  <th className="pb-2 text-right font-medium">{t("orders.detail.qty")}</th>
                  <th className="pb-2 text-right font-medium">{t("orders.detail.total")}</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr className="border-b border-border/50" key={item.id}>
                    <td className="py-4 font-medium">{item.productTitle || item.title}</td>
                    <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-4 text-right font-mono tabular-nums">
                      {formatOrderMoney(item.total, order.currencyCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    className="border-t-2 px-1 py-3 text-left font-semibold"
                    colSpan={2}
                    style={{ borderColor: documentAccent }}
                  >
                    {t("orders.detail.total")}
                  </th>
                  <td
                    className="border-t-2 px-1 py-3 text-right font-mono text-base font-semibold tabular-nums"
                    style={{ borderColor: documentAccent }}
                  >
                    {formatOrderMoney(order.total, order.currencyCode)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t pt-5 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
            <div>
              {branding?.footerNote ? (
                <p className="mb-1 text-foreground">{branding.footerNote}</p>
              ) : null}
              <p>{document.snapshot.disclaimer}</p>
            </div>
            <p className="shrink-0 font-mono tabular-nums">{document.number}</p>
          </footer>
        </div>
      </article>
    </PageShell>
  );
}
