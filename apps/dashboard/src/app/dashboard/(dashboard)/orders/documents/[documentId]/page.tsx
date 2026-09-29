import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
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

  return (
    <PageShell actions={<PrintSalesDocumentButton />} title={`${kind} ${document.number}`}>
      <article className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-5 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {document.snapshot.sellerName}
            </p>
            <h1 className="mt-1 type-section-title">{kind}</h1>
            <p className="mt-2 font-mono text-sm tabular-nums">{document.number}</p>
          </div>
          <Badge variant="secondary">{t("orders.documents.operationalOnly")}</Badge>
        </header>
        <div className="grid gap-5 border-b border-border py-6 sm:grid-cols-2">
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
        <div className="py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t("orders.detail.item")}</th>
                <th className="pb-2 text-right font-medium">{t("orders.detail.qty")}</th>
                <th className="pb-2 text-right font-medium">{t("orders.detail.total")}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item) => (
                <tr className="border-b border-border/60" key={item.id}>
                  <td className="py-3">{item.productTitle || item.title}</td>
                  <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {formatOrderMoney(item.total, order.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="pt-4 text-left font-semibold" colSpan={2}>
                  {t("orders.detail.total")}
                </th>
                <td className="pt-4 text-right font-mono text-base font-semibold tabular-nums">
                  {formatOrderMoney(order.total, order.currencyCode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <footer className="border-t border-border pt-5">
          <p className="font-semibold">{document.snapshot.disclaimer}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("orders.documents.disclaimerDetail")}
          </p>
        </footer>
      </article>
    </PageShell>
  );
}
