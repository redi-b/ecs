import type { MerchantOrder } from "@ecs/contracts";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderStatusBadge } from "@/features/orders/order-table-cells";
import {
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
} from "@/features/orders/order-table-state";

type OrderDetailProps = {
  order: MerchantOrder;
};

export function OrderDetail({ order }: OrderDetailProps) {
  const fulfillments = order.fulfillments ?? [];
  const latestFulfillmentSignal = getLatestFulfillmentSignal(fulfillments);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{formatOrderDisplayId(order)}</CardTitle>
                <OrderStatusBadge status={order.status} />
                <OrderStatusBadge status={order.paymentStatus} tone="payment" />
                <OrderStatusBadge status={order.fulfillmentStatus} tone="fulfillment" />
              </div>
              <CardDescription className="break-all">
                {order.id} · Created {formatOrderDate(order.createdAt)}
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:min-w-80">
              <DetailMetric
                label="Total"
                value={formatOrderMoney(order.total, order.currencyCode)}
              />
              <DetailMetric label="Fulfillments" value={`${fulfillments.length}`} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
        <div className="space-y-6">
          <DetailSection
            description="Customer and delivery contact information captured with this order."
            title="Customer"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DetailField label="Email" value={order.email ?? "No email captured"} />
              <DetailField
                label="Customer name"
                value={order.delivery?.customerName ?? "No name captured"}
              />
              <DetailField
                label="Phone"
                value={
                  order.delivery?.customerPhone ?? order.shippingAddress?.phone ?? "No phone captured"
                }
              />
            </div>
          </DetailSection>

          <DetailSection
            description="Delivery preference and notes currently available in the order contract."
            title="Delivery"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DetailField label="Choice" value={formatNullable(order.delivery?.choice)} />
              <DetailField label="Landmark" value={formatNullable(order.delivery?.landmark)} />
              <DetailField label="Notes" value={formatNullable(order.delivery?.notes)} />
            </div>
          </DetailSection>

          <DetailSection
            description="Shipping address fields returned for this merchant order."
            title="Shipping address"
          >
            <div className="rounded-lg border px-4 py-3">
              <div className="space-y-1 text-sm">
                {formatShippingAddress(order.shippingAddress).map((line, index) => (
                  <div key={`${line}-${index}`} className="break-words">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </DetailSection>

          <DetailSection
            description="Item-level detail will appear here when the order contract includes items."
            title="Items"
          >
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              This order response does not include line items yet.
            </div>
          </DetailSection>
        </div>

        <div className="space-y-6">
          <DetailSection
            description="Current order, payment, and fulfillment states."
            title="Payment and fulfillment"
          >
            <div className="space-y-3">
              <StatusField label="Order status" status={order.status} />
              <StatusField label="Payment status" status={order.paymentStatus} tone="payment" />
              <StatusField
                label="Fulfillment status"
                status={order.fulfillmentStatus}
                tone="fulfillment"
              />
            </div>
          </DetailSection>

          <DetailSection
            description="Fulfillment activity currently available from the order contract."
            title="Fulfillments"
          >
            <div className="grid gap-4">
              <DetailField label="Fulfillment count" value={`${fulfillments.length}`} />
              <DetailField label="Latest signal" value={latestFulfillmentSignal} />
              {fulfillments.length ? (
                <div className="space-y-3">
                  {fulfillments.map((fulfillment) => (
                    <div key={fulfillment.id} className="space-y-2 rounded-lg border px-4 py-3">
                      <div className="text-sm font-medium">{fulfillment.id}</div>
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <MiniSignal
                          label="Shipped"
                          value={formatOrderDate(fulfillment.shippedAt)}
                        />
                        <MiniSignal
                          label="Delivered"
                          value={formatOrderDate(fulfillment.deliveredAt)}
                        />
                        <MiniSignal
                          label="Canceled"
                          value={formatOrderDate(fulfillment.canceledAt)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No fulfillments have been recorded for this order.
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection
            description="Order total using the current merchant order contract values."
            title="Totals"
          >
            <div className="grid gap-4">
              <DetailField
                label="Currency"
                value={order.currencyCode?.toUpperCase() ?? "Not available"}
              />
              <DetailField
                label="Total"
                value={formatOrderMoney(order.total, order.currencyCode)}
              />
              <DetailField label="Updated" value={formatOrderDate(order.updatedAt)} />
            </div>
          </DetailSection>
        </div>
      </div>
    </div>
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{value}</div>
    </div>
  );
}

function MiniSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="break-words">{value}</div>
    </div>
  );
}

function StatusField({
  label,
  status,
  tone,
}: {
  label: string;
  status: string | null;
  tone?: "fulfillment" | "order" | "payment";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      {tone ? <OrderStatusBadge status={status} tone={tone} /> : <OrderStatusBadge status={status} />}
    </div>
  );
}

function formatNullable(value: string | null | undefined) {
  return value?.trim() || "Not captured";
}

function formatShippingAddress(address: MerchantOrder["shippingAddress"]) {
  if (!address) {
    return ["No shipping address captured."];
  }

  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.city, address.province, address.postalCode].filter(Boolean).join(", ");
  const lines = [
    name,
    address.phone,
    address.address1,
    address.address2,
    cityLine,
    address.countryCode?.toUpperCase() ?? null,
  ].filter((line): line is string => Boolean(line?.trim()));

  return lines.length ? lines : ["No shipping address captured."];
}

function getLatestFulfillmentSignal(fulfillments: NonNullable<MerchantOrder["fulfillments"]>) {
  const signals = fulfillments.flatMap((fulfillment) => [
    { label: "Delivered", value: fulfillment.deliveredAt },
    { label: "Shipped", value: fulfillment.shippedAt },
    { label: "Canceled", value: fulfillment.canceledAt },
  ]);
  const latest = signals
    .filter(
      (signal): signal is { label: string; value: string } =>
        typeof signal.value === "string" && !Number.isNaN(new Date(signal.value).getTime()),
    )
    .sort((a, b) => new Date(b.value).getTime() - new Date(a.value).getTime())[0];

  if (!latest) {
    return "No shipped, delivered, or canceled signal";
  }

  return `${latest.label} ${formatOrderDate(latest.value)}`;
}
