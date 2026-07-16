import type { MerchantOrder } from "@ecs/contracts";
import Link from "@/components/app/link";

import { HelpTip } from "@/components/app/help-tip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderActions } from "@/features/orders/order-actions";
import { OrderPaymentCell, OrderProgressBadge } from "@/features/orders/order-table-cells";
import {
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderReference,
  getDeliveryDisplayLabel,
  getDeliveryLabel,
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

function Section({
  title,
  children,
  help,
}: {
  title: string;
  children: React.ReactNode;
  help?: { summary: string; title?: string; body?: string };
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {help ? (
          <HelpTip summary={help.summary} {...(help.title ? { title: help.title } : {})}>
            {help.body}
          </HelpTip>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
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
  const steps = [
    { id: "new", label: t("orders.detail.stepNew"), done: true },
    {
      id: "ready",
      label: t("orders.detail.stepReady"),
      done: progress === "ready" || progress === "completed",
    },
    {
      id: "completed",
      label: t("orders.detail.stepCompleted"),
      done: progress === "completed",
    },
  ] as const;

  const activity = buildActivity(order, t);
  const address = order.shippingAddress;
  const addressLine = [
    address?.address1,
    address?.address2,
    address?.city,
    address?.province,
  ]
    .filter(Boolean)
    .join(", ");
  const ref = formatOrderReference(order);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">
                  {t("orders.detail.orderHeading", { ref })}
                </CardTitle>
                <OrderProgressBadge order={order} />
                <OrderPaymentCell order={order} />
              </div>
              <p className="text-sm text-muted-foreground">
                {customerName}
                {customerPhone ? ` · ${customerPhone}` : ""}
                {" · "}
                {formatOrderMoney(order.total, order.currencyCode)}
                {" · "}
                {formatOrderDateTime(order.createdAt)}
              </p>
              <ol className="flex flex-wrap gap-2 pt-1">
                {steps.map((step) => (
                  <li
                    key={step.id}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      step.done
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </li>
                ))}
                {progress === "canceled" ? (
                  <li className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {t("orders.detail.stepCanceled")}
                  </li>
                ) : null}
              </ol>
            </div>
            <div className="w-full max-w-md">
              <OrderActions action={action} order={order} variant="card" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-6">
          <Section title={t("orders.detail.items")}>
            {items.length === 0 ? (
              <p className="text-muted-foreground">{t("orders.detail.noItems")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("orders.detail.item")}</TableHead>
                    <TableHead className="w-16 text-right">{t("orders.detail.qty")}</TableHead>
                    <TableHead className="w-28 text-right">{t("orders.detail.total")}</TableHead>
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
                    const itemTitle = item.title ?? t("orders.detail.fallbackItem");
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt=""
                                className="size-10 rounded-md object-cover"
                                src={item.thumbnail}
                              />
                            ) : (
                              <div className="size-10 rounded-md bg-muted" />
                            )}
                            <div className="min-w-0">
                              {href ? (
                                <Link
                                  className={cn(listEntityLinkClassName, "truncate")}
                                  href={href}
                                >
                                  {itemTitle}
                                </Link>
                              ) : (
                                <p className="font-medium">{itemTitle}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {t("orders.detail.each", {
                                  price: formatOrderMoney(item.unitPrice, order.currencyCode),
                                })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatOrderMoney(item.total, order.currencyCode)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div className="space-y-1 border-t pt-3 text-sm">
              {order.subtotal != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.subtotal")}</span>
                  <span>{formatOrderMoney(order.subtotal, order.currencyCode)}</span>
                </div>
              ) : null}
              {order.shippingTotal != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.delivery")}</span>
                  <span>{formatOrderMoney(order.shippingTotal, order.currencyCode)}</span>
                </div>
              ) : null}
              {order.discountTotal != null && order.discountTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orders.detail.discount")}</span>
                  <span>-{formatOrderMoney(order.discountTotal, order.currencyCode)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 font-medium">
                <span>{t("orders.detail.total")}</span>
                <span>{formatOrderMoney(order.total, order.currencyCode)}</span>
              </div>
            </div>
          </Section>

          <Section title={t("orders.detail.activity")}>
            {activity.length === 0 ? (
              <p className="text-muted-foreground">{t("orders.detail.noActivity")}</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((event, index) => (
                  <li
                    className="flex items-start justify-between gap-3"
                    key={`${event.label}-${index}`}
                  >
                    <span>{event.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatOrderDateTime(event.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title={t("orders.detail.payment")}
            help={{
              summary: t("orders.detail.paymentHelpSummary"),
              title: t("orders.detail.payment"),
              body: t("orders.detail.paymentHelpBody"),
            }}
          >
            <Field
              label={t("orders.detail.method")}
              value={getMethodDisplayLabel(getMethodLabel(order), t)}
            />
            <Field
              label={t("orders.detail.status")}
              value={
                <Badge variant="secondary">
                  {getPaymentStatusLabel(getPaymentLabel(order), t)}
                </Badge>
              }
            />
            <Field label={t("orders.detail.reference")} value={order.paymentReference} />
          </Section>

          <Section title={t("orders.detail.customer")}>
            <Field label={t("orders.detail.name")} value={customerName} />
            <Field
              label={t("orders.detail.phone")}
              value={
                customerPhone ? (
                  <a className="hover:underline" href={`tel:${customerPhone}`}>
                    {customerPhone}
                  </a>
                ) : null
              }
            />
            <Field label={t("orders.detail.email")} value={order.email} />
            {order.customerId ? (
              <Field
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
          </Section>

          <Section title={t("orders.detail.deliverySection")}>
            <Field
              label={t("orders.detail.type")}
              value={getDeliveryDisplayLabel(getDeliveryLabel(order), t)}
            />
            <Field label={t("orders.detail.address")} value={addressLine || null} />
            <Field label={t("orders.detail.landmark")} value={order.delivery?.landmark} />
            <Field label={t("orders.detail.customerNotes")} value={order.delivery?.notes} />
          </Section>

          {order.note ? (
            <Section title={t("orders.detail.internalNote")}>
              <p className="whitespace-pre-wrap">{order.note}</p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
