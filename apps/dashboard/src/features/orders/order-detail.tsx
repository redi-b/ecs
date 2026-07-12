import type { MerchantOrder } from "@ecs/contracts";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderActions, getOrderProgressSteps } from "@/features/orders/order-actions";
import { OrderStatusBadge } from "@/features/orders/order-table-cells";
import {
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
  formatOrderStatusLabel,
  getOrderCustomerName,
  getOrderCustomerPhone,
} from "@/features/orders/order-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type OrderDetailProps = {
  action: string;
  order: MerchantOrder;
  tenantId?: string | undefined;
};

export function OrderDetail({ action, order, tenantId }: OrderDetailProps) {
  const customerName = getOrderCustomerName(order);
  const customerPhone = getOrderCustomerPhone(order);
  const progress = getOrderProgressSteps(order);
  const itemCount = (order.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Order {formatOrderDisplayId(order)}</CardTitle>
                <OrderStatusBadge status={order.status} />
                <OrderStatusBadge status={order.paymentStatus} tone="payment" />
                <OrderStatusBadge status={order.fulfillmentStatus} tone="fulfillment" />
              </div>
              <CardDescription>
                {customerName ? `${customerName} · ` : ""}
                Placed {formatOrderDate(order.createdAt)}
                {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:min-w-72">
              <DetailMetric
                label="Total"
                value={formatOrderMoney(order.total, order.currencyCode)}
              />
              <DetailMetric
                label="Payment"
                value={formatOrderStatusLabel(order.paymentStatus, "payment")}
              />
            </div>
          </div>

          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {progress.map((step, index) => (
              <li
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm",
                  step.done
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground",
                )}
                key={step.id}
              >
                <span className="block text-[11px] font-medium tracking-wide uppercase opacity-70">
                  Step {index + 1}
                </span>
                <span className="font-medium">{step.label}</span>
              </li>
            ))}
          </ol>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]">
        <div className="space-y-6">
          <DetailSection
            description="Who ordered and how to reach them."
            title="Customer"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Name" value={customerName ?? "Not provided"} />
              <DetailField label="Phone" value={customerPhone ?? "Not provided"} />
              <DetailField
                className="sm:col-span-2"
                label="Email"
                value={order.email ?? "Not provided"}
              />
            </div>
          </DetailSection>

          <DetailSection
            description="Where to deliver or where the customer will pick up."
            title="Delivery address"
          >
            <div className="space-y-3">
              <div className="rounded-xl border px-4 py-3 text-sm">
                {formatShippingAddress(order.shippingAddress).map((line) => (
                  <div className="break-words" key={line}>
                    {line}
                  </div>
                ))}
              </div>
              {(order.delivery?.landmark || order.delivery?.notes || order.delivery?.choice) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailField
                    label="Delivery type"
                    value={friendlyDeliveryChoice(order.delivery?.choice)}
                  />
                  <DetailField
                    label="Landmark"
                    value={order.delivery?.landmark?.trim() || "—"}
                  />
                  <DetailField label="Notes" value={order.delivery?.notes?.trim() || "—"} />
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection description="What the customer bought." title="Items">
            <OrderItemsTable
              currencyCode={order.currencyCode}
              items={order.items ?? []}
              tenantId={tenantId}
            />
          </DetailSection>
        </div>

        <div className="space-y-6">
          <DetailSection
            description="What to do next for packing and delivery."
            title="Fulfillment"
          >
            <OrderActions action={action} order={order} />
          </DetailSection>

          <DetailSection description="Money for this order." title="Payment">
            <div className="space-y-3">
              <DetailField
                label="Amount"
                value={formatOrderMoney(order.total, order.currencyCode)}
              />
              <DetailField
                label="Status"
                value={formatOrderStatusLabel(order.paymentStatus, "payment")}
              />
              <p className="text-xs text-muted-foreground">
                Most local sales use cash on delivery. Mark payment as settled in your own
                process when the customer pays.
              </p>
            </div>
          </DetailSection>

          <DetailSection description="Packing and delivery history." title="Activity">
            <FulfillmentActivity order={order} />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function FulfillmentActivity({ order }: { order: MerchantOrder }) {
  const fulfillments = order.fulfillments ?? [];

  if (!fulfillments.length) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
        Not packed yet. Use the next step when you are ready to prepare the order.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {fulfillments.map((fulfillment, index) => {
        const state = fulfillment.canceledAt
          ? "Canceled"
          : fulfillment.deliveredAt
            ? "Delivered"
            : fulfillment.shippedAt
              ? "Out for delivery"
              : "Packed";
        const when =
          fulfillment.deliveredAt ||
          fulfillment.shippedAt ||
          fulfillment.canceledAt ||
          null;

        return (
          <li className="rounded-xl border px-4 py-3 text-sm" key={fulfillment.id}>
            <div className="font-medium">
              Package {fulfillments.length > 1 ? index + 1 : ""} {state}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {when ? formatOrderDate(when) : "Ready for handoff"}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OrderItemsTable({
  currencyCode,
  items,
  tenantId,
}: {
  currencyCode: string | null;
  items: NonNullable<MerchantOrder["items"]>;
  tenantId?: string | undefined;
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
        No items on this order.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Packed</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const packed = item.fulfilledQuantity ?? 0;
            const qty = item.quantity ?? 0;
            return (
              <TableRow key={item.id}>
                <TableCell className="min-w-48 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <LineItemThumbnail src={item.thumbnail} title={item.title} />
                    <div className="min-w-0">
                      {item.productId ? (
                        <Link
                          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                          href={getTenantScopedPath(
                            dashboardRoutes.productDetail(item.productId),
                            tenantId,
                          )}
                        >
                          {item.title ?? "Item"}
                        </Link>
                      ) : (
                        <div className="font-medium">{item.title ?? "Item"}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatOrderMoney(item.unitPrice, currencyCode)} each
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{qty || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {qty > 0 ? `${packed}/${qty}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatOrderMoney(item.total, currencyCode)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function LineItemThumbnail({ src, title }: { src: string | null; title: string | null }) {
  if (!src) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted text-xs font-medium text-muted-foreground">
        {getInitials(title)}
      </div>
    );
  }

  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={title ?? "Order item"} className="size-full object-cover" src={src} />
    </div>
  );
}

function getInitials(value: string | null) {
  return (
    value
      ?.split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "IT"
  );
}

function DetailSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailField({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("space-y-1 rounded-xl border px-4 py-3", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{value}</div>
    </div>
  );
}

function friendlyDeliveryChoice(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const key = value.trim().toLowerCase();
  if (key === "delivery" || key === "local_delivery") return "Local delivery";
  if (key === "pickup") return "Customer pickup";
  return value.replaceAll("_", " ");
}

function formatShippingAddress(address: MerchantOrder["shippingAddress"]) {
  if (!address) {
    return ["No delivery address on this order."];
  }

  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province, address.postalCode].filter(Boolean).join(", ");
  const lines = [
    name,
    address.phone,
    address.address1,
    address.address2,
    cityLine,
    address.countryCode?.toUpperCase() === "ET" ? "Ethiopia" : address.countryCode?.toUpperCase(),
  ].filter((line): line is string => Boolean(line?.trim()));

  return lines.length ? lines : ["No delivery address on this order."];
}
