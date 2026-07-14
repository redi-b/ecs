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
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type OrderDetailProps = {
  action: string;
  order: MerchantOrder;
  tenantId?: string | undefined;
};

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

function buildActivity(order: MerchantOrder) {
  const events: Array<{ at: string | null; label: string }> = [];
  events.push({ at: order.createdAt, label: "Order received" });

  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.shippedAt) {
      events.push({ at: fulfillment.shippedAt, label: "Marked ready" });
    }
    if (fulfillment.deliveredAt) {
      events.push({ at: fulfillment.deliveredAt, label: "Handed to customer" });
    }
    if (fulfillment.canceledAt) {
      events.push({ at: fulfillment.canceledAt, label: "Fulfillment canceled" });
    }
  }

  if (getPaymentLabel(order) === "paid") {
    events.push({ at: order.updatedAt, label: "Payment recorded" });
  }

  if (getOrderProgress(order) === "completed") {
    events.push({ at: order.updatedAt, label: "Order completed" });
  }
  if (getOrderProgress(order) === "canceled") {
    events.push({ at: order.updatedAt, label: "Order canceled" });
  }

  return events
    .filter((event) => event.at)
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
}

export function OrderDetail({ action, order, tenantId }: OrderDetailProps) {
  const customerName = getOrderCustomerName(order);
  const customerPhone = getOrderCustomerPhone(order);
  const items = order.items ?? [];
  const progress = getOrderProgress(order);
  const steps = [
    { id: "new", label: "New", done: true },
    {
      id: "ready",
      label: "Ready",
      done: progress === "ready" || progress === "completed",
    },
    {
      id: "completed",
      label: "Completed",
      done: progress === "completed",
    },
  ] as const;

  const activity = buildActivity(order);
  const address = order.shippingAddress;
  const addressLine = [
    address?.address1,
    address?.address2,
    address?.city,
    address?.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">Order {formatOrderReference(order)}</CardTitle>
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
                    Canceled
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
          <Section title="Items">
            {items.length === 0 ? (
              <p className="text-muted-foreground">No line items on this order.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-16 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
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
                                <Link className={cn(listEntityLinkClassName, "truncate")} href={href}>
                                  {item.title ?? "Item"}
                                </Link>
                              ) : (
                                <p className="font-medium">{item.title ?? "Item"}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatOrderMoney(item.unitPrice, order.currencyCode)} each
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatOrderMoney(order.subtotal, order.currencyCode)}</span>
                </div>
              ) : null}
              {order.shippingTotal != null ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>{formatOrderMoney(order.shippingTotal, order.currencyCode)}</span>
                </div>
              ) : null}
              {order.discountTotal != null && order.discountTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatOrderMoney(order.discountTotal, order.currencyCode)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 font-medium">
                <span>Total</span>
                <span>{formatOrderMoney(order.total, order.currencyCode)}</span>
              </div>
            </div>
          </Section>

          <Section title="Activity">
            {activity.length === 0 ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((event, index) => (
                  <li className="flex items-start justify-between gap-3" key={`${event.label}-${index}`}>
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
            title="Payment"
            help={{
              summary: "Payment is separate from packing and handoff.",
              title: "Payment",
              body: "Cash sales are marked paid when you receive the money. Online (Chapa) usually updates automatically; use Re-check if it looks stuck.",
            }}
          >
            <Field label="Method" value={getMethodDisplayLabel(getMethodLabel(order))} />
            <Field
              label="Status"
              value={
                <Badge variant="secondary">{getPaymentStatusLabel(getPaymentLabel(order))}</Badge>
              }
            />
            <Field label="Reference" value={order.paymentReference} />
          </Section>

          <Section title="Customer">
            <Field label="Name" value={customerName} />
            <Field
              label="Phone"
              value={
                customerPhone ? (
                  <a className="hover:underline" href={`tel:${customerPhone}`}>
                    {customerPhone}
                  </a>
                ) : null
              }
            />
            <Field label="Email" value={order.email} />
            {order.customerId ? (
              <Field
                label="In customers"
                value={
                  <Link
                    className={cn(listEntityLinkClassName, "inline-flex items-center gap-1")}
                    href={getTenantScopedPath(
                      `${dashboardRoutes.customers}?highlight=${encodeURIComponent(order.customerId)}`,
                      tenantId,
                    )}
                  >
                    Open in customers list
                    <span aria-hidden className="text-xs">
                      →
                    </span>
                  </Link>
                }
              />
            ) : null}
          </Section>

          <Section title="Delivery">
            <Field
              label="Type"
              value={getDeliveryDisplayLabel(getDeliveryLabel(order))}
            />
            <Field label="Address" value={addressLine || null} />
            <Field label="Landmark" value={order.delivery?.landmark} />
            <Field label="Customer notes" value={order.delivery?.notes} />
          </Section>

          {order.note ? (
            <Section title="Internal note">
              <p className="whitespace-pre-wrap">{order.note}</p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
