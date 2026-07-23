import type { MerchantOrder } from "@ecs/contracts";
import Link from "@/components/app/link";

import {
  DetailActivityList,
  DetailField,
  DetailFieldGrid,
  DetailHero,
  DetailHeroStat,
  DetailSection,
  DetailStepTrack,
} from "@/components/app/detail-surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/features/orders/order-actions";
import { OrderPaymentCell } from "@/features/orders/order-table-cells";
import {
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderReference,
  getDeliveryDisplayLabel,
  getDeliveryLabel,
  getDisplayOrderEmail,
  getMethodDisplayLabel,
  getMethodLabel,
  getOrderCustomerName,
  getOrderCustomerPhone,
  getOrderProgress,
  getPaymentLabel,
  getPaymentStatusLabel,
} from "@/features/orders/order-domain";
import type { MessageKey } from "@/i18n/messages";
import { getTranslations } from "@/i18n/server";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type OrderDetailProps = {
  action: string;
  order: MerchantOrder;
  tenantId?: string | undefined;
};

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

function settlementMethodLabel(
  method: string,
  t: Translate,
): string {
  switch (method) {
    case "cash":
      return t("orders.settlement.cash");
    case "telebirr":
      return t("orders.settlement.telebirr");
    case "cbe_birr":
      return t("orders.settlement.cbeBirr");
    case "bank_transfer":
      return t("orders.settlement.bankTransfer");
    case "chapa":
      return t("orders.settlement.chapa");
    default:
      return t("orders.settlement.other");
  }
}

function buildActivity(order: MerchantOrder, t: Translate) {
  const events: Array<{ at: string | null; label: string }> = [];
  events.push({ at: order.createdAt, label: t("orders.detail.activityReceived") });

  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.shippedAt) {
      events.push({ at: fulfillment.shippedAt, label: t("orders.detail.activityReady") });
    }
    if (fulfillment.deliveredAt) {
      events.push({ at: fulfillment.deliveredAt, label: t("orders.detail.activityHanded") });
    }
    if (fulfillment.canceledAt) {
      events.push({
        at: fulfillment.canceledAt,
        label: t("orders.detail.activityFulfillmentCanceled"),
      });
    }
  }

  if (getPaymentLabel(order) === "paid") {
    events.push({ at: order.updatedAt, label: t("orders.detail.activityPayment") });
  }

  if (getOrderProgress(order) === "completed") {
    events.push({ at: order.updatedAt, label: t("orders.detail.activityCompleted") });
  }
  if (getOrderProgress(order) === "canceled") {
    events.push({ at: order.updatedAt, label: t("orders.detail.activityCanceled") });
  }

  return events
    .filter((event) => event.at)
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
}

export async function OrderDetail({ action, order, tenantId }: OrderDetailProps) {
  const t = await getTranslations();
  const customerName = getOrderCustomerName(order, t);
  const customerPhone = getOrderCustomerPhone(order);
  const items = order.items ?? [];
  const progress = getOrderProgress(order);
  const steps =
    progress === "canceled"
      ? [
          {
            id: "canceled",
            label: t("orders.detail.stepCanceled"),
            done: false,
            current: true,
            muted: true,
          },
        ]
      : [
          {
            id: "new",
            label: t("orders.detail.stepNew"),
            done: true,
            current: progress === "new",
          },
          {
            id: "ready",
            label: t("orders.detail.stepReady"),
            done: progress === "ready" || progress === "completed",
            current: progress === "ready",
          },
          {
            id: "completed",
            label: t("orders.detail.stepCompleted"),
            done: progress === "completed",
            current: progress === "completed",
          },
        ];

  const activity = buildActivity(order, t);
  const address = order.shippingAddress;
  const addressLine = [address?.address1, address?.address2, address?.city, address?.province]
    .filter(Boolean)
    .join(", ");
  const ref = formatOrderReference(order);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/*
        Two-zone hero (old structure, cleaned):
        - Left: order id, payment chips only (no progress badge — track covers that),
          customer/meta, connected fulfillment track
        - Right: next actions
      */}
      <DetailHero actions={<OrderActions action={action} order={order} variant="card" />}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="type-section-title text-balance">
              {t("orders.detail.orderHeading", { ref })}
            </h2>
            {/* Payment chips only — fulfillment is the numbered track. */}
            <OrderPaymentCell order={order} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DetailHeroStat label={t("orders.detail.name")} value={customerName} />
            <DetailHeroStat
              label={t("orders.detail.phone")}
              value={
                customerPhone ? (
                  <a className="hover:underline" href={`tel:${customerPhone}`}>
                    {customerPhone}
                  </a>
                ) : null
              }
            />
            <DetailHeroStat
              label={t("orders.detail.total")}
              value={
                <span className="font-mono tabular-nums">
                  {formatOrderMoney(order.total, order.currencyCode)}
                </span>
              }
            />
            <DetailHeroStat
              label={t("orders.detail.placed")}
              value={formatOrderDateTime(order.createdAt)}
            />
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("orders.detail.fulfillmentTrack")}
            </p>
            <DetailStepTrack steps={steps} />
          </div>
        </div>
      </DetailHero>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.9fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <DetailSection title={t("orders.detail.items")}>
            {items.length === 0 ? (
              <p className="text-muted-foreground">{t("orders.detail.noItems")}</p>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                        {t("orders.detail.item")}
                      </TableHead>
                      <TableHead className="h-9 w-16 text-right text-xs font-medium text-muted-foreground">
                        {t("orders.detail.qty")}
                      </TableHead>
                      <TableHead className="h-9 w-28 text-right text-xs font-medium text-muted-foreground">
                        {t("orders.detail.total")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const href = item.productId
                        ? getTenantScopedPath(
                            dashboardRoutes.productDetail(item.productId),
                            tenantId,
                          )
                        : null;
                      const productName =
                        item.productTitle?.trim() ||
                        item.title?.trim() ||
                        t("orders.detail.fallbackItem");
                      const variantLabel = item.variantTitle?.trim() ?? "";
                      const showVariant =
                        variantLabel.length > 0 &&
                        variantLabel.toLowerCase() !== productName.toLowerCase();
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-3">
                              {item.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  className="size-10 rounded-md object-cover ring-1 ring-border/60"
                                  src={item.thumbnail}
                                />
                              ) : (
                                <div className="size-10 rounded-md bg-muted ring-1 ring-border/40" />
                              )}
                              <div className="min-w-0 space-y-0.5">
                                {href ? (
                                  <Link
                                    className={cn(listEntityLinkClassName, "truncate")}
                                    href={href}
                                  >
                                    {productName}
                                  </Link>
                                ) : (
                                  <p className="font-medium">{productName}</p>
                                )}
                                {showVariant ? (
                                  <div className="flex flex-wrap gap-1">
                                    {variantLabel.split(" · ").map((part) => (
                                      <Badge
                                        key={part}
                                        className="h-5 max-w-full truncate rounded-md px-1.5 font-normal"
                                        variant="secondary"
                                      >
                                        {part}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                                <p className="text-xs text-muted-foreground">
                                  {t("orders.detail.each", {
                                    price: formatOrderMoney(item.unitPrice, order.currencyCode),
                                  })}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right tabular-nums">
                            {item.quantity ?? "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-medium tabular-nums">
                            {formatOrderMoney(item.total, order.currencyCode)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-1.5 border-t border-border/70 pt-3 text-sm">
              {order.subtotal != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.subtotal")}</span>
                  <span className="tabular-nums">
                    {formatOrderMoney(order.subtotal, order.currencyCode)}
                  </span>
                </div>
              ) : null}
              {order.shippingTotal != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.delivery")}</span>
                  <span className="tabular-nums">
                    {formatOrderMoney(order.shippingTotal, order.currencyCode)}
                  </span>
                </div>
              ) : null}
              {order.discountTotal != null && order.discountTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.discount")}</span>
                  <span className="tabular-nums">
                    -{formatOrderMoney(order.discountTotal, order.currencyCode)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 pt-0.5 text-base font-semibold">
                <span>{t("orders.detail.total")}</span>
                <span className="font-mono tabular-nums">
                  {formatOrderMoney(order.total, order.currencyCode)}
                </span>
              </div>
            </div>
          </DetailSection>

          <DetailSection title={t("orders.detail.activity")}>
            <DetailActivityList
              empty={t("orders.detail.noActivity")}
              items={activity.map((event) => ({
                label: event.label,
                at: formatOrderDateTime(event.at),
              }))}
            />
          </DetailSection>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <DetailSection
            help={{
              summary: t("orders.detail.paymentHelpSummary"),
              title: t("orders.detail.payment"),
              body: t("orders.detail.paymentHelpBody"),
            }}
            title={t("orders.detail.payment")}
          >
            <DetailFieldGrid className="sm:grid-cols-1">
              <DetailField
                label={t("orders.detail.method")}
                value={getMethodDisplayLabel(getMethodLabel(order), t)}
              />
              <DetailField
                label={t("orders.detail.status")}
                value={
                  <Badge variant="secondary">
                    {getPaymentStatusLabel(getPaymentLabel(order), t)}
                  </Badge>
                }
              />
              <DetailField label={t("orders.detail.reference")} value={order.paymentReference} />
              {order.settlement ? (
                <>
                  <DetailField
                    label={t("orders.settlement.sectionTitle")}
                    value={settlementMethodLabel(order.settlement.method, t)}
                  />
                  {order.settlement.accountLabel || order.settlement.bankName ? (
                    <DetailField
                      label={t("orders.settlement.receivingAccount")}
                      value={[
                        order.settlement.accountLabel,
                        order.settlement.bankName,
                        order.settlement.accountLast4
                          ? `···${order.settlement.accountLast4}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ) : null}
                  {order.settlement.reference ? (
                    <DetailField
                      label={t("orders.settlement.reference")}
                      value={order.settlement.reference}
                    />
                  ) : null}
                </>
              ) : null}
            </DetailFieldGrid>
          </DetailSection>

          <DetailSection title={t("orders.detail.customer")}>
            <DetailFieldGrid className="sm:grid-cols-1">
              <DetailField label={t("orders.detail.name")} value={customerName} />
              <DetailField
                label={t("orders.detail.phone")}
                value={
                  customerPhone ? (
                    <a className="hover:underline" href={`tel:${customerPhone}`}>
                      {customerPhone}
                    </a>
                  ) : null
                }
              />
              <DetailField
                label={t("orders.detail.email")}
                value={getDisplayOrderEmail(order.email)}
              />
              {order.customerId ? (
                <DetailField
                  label={t("orders.detail.inCustomers")}
                  value={
                    <Link
                      className={cn(listEntityLinkClassName, "inline-flex items-center gap-1")}
                      href={getTenantScopedPath(
                        `${dashboardRoutes.customers}?highlight=${encodeURIComponent(order.customerId)}`,
                        tenantId,
                      )}
                    >
                      {t("orders.detail.openInCustomers")}
                      <span aria-hidden className="text-xs">
                        →
                      </span>
                    </Link>
                  }
                />
              ) : null}
            </DetailFieldGrid>
          </DetailSection>

          <DetailSection title={t("orders.detail.deliverySection")}>
            <DetailFieldGrid className="sm:grid-cols-1">
              <DetailField
                label={t("orders.detail.type")}
                value={getDeliveryDisplayLabel(getDeliveryLabel(order), t)}
              />
              <DetailField label={t("orders.detail.address")} value={addressLine || null} />
              <DetailField label={t("orders.detail.landmark")} value={order.delivery?.landmark} />
              <DetailField
                label={t("orders.detail.customerNotes")}
                value={order.delivery?.notes}
              />
            </DetailFieldGrid>
          </DetailSection>

          {order.note ? (
            <DetailSection title={t("orders.detail.internalNote")}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{order.note}</p>
            </DetailSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
