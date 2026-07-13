"use client";

import type { MerchantOrder } from "@ecs/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatOrderMoney,
  formatOrderReference,
  formatOrderRelativeTime,
  getDeliveryDisplayLabel,
  getDeliveryLabel,
  getMethodLabel,
  getMethodShortLabel,
  getOrderCustomerName,
  getOrderCustomerPhone,
  getOrderItemsSummary,
  getOrderProgress,
  getOrderProgressLabel,
  getPaymentLabel,
  getPaymentStatusLabel,
} from "@/features/orders/order-domain";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function OrderIdentityCell({
  order,
  tenantId,
}: {
  order: MerchantOrder;
  tenantId?: string;
}) {
  const href = getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId);
  return (
    <div className="min-w-0 space-y-0.5">
      <Link className="font-medium tabular-nums hover:underline" href={href}>
        {formatOrderReference(order)}
      </Link>
      <p className="text-xs text-muted-foreground">{formatOrderRelativeTime(order.createdAt)}</p>
    </div>
  );
}

export function OrderCustomerCell({ order }: { order: MerchantOrder }) {
  const name = getOrderCustomerName(order);
  const phone = getOrderCustomerPhone(order);
  const secondary = phone || order.email || null;

  return (
    <div className="min-w-0 space-y-0.5">
      <p className="truncate font-medium">{name}</p>
      {secondary ? (
        <p className="truncate text-xs text-muted-foreground">
          {phone ? (
            <a className="hover:underline" href={`tel:${phone}`}>
              {phone}
            </a>
          ) : (
            secondary
          )}
        </p>
      ) : null}
    </div>
  );
}

export function OrderItemsCell({ order }: { order: MerchantOrder }) {
  return <p className="max-w-[14rem] truncate text-sm">{getOrderItemsSummary(order)}</p>;
}

export function OrderMoneyCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="tabular-nums font-medium">
      {formatOrderMoney(order.total, order.currencyCode)}
    </span>
  );
}

export function OrderPaymentCell({ order }: { order: MerchantOrder }) {
  const method = getMethodLabel(order);
  const payment = getPaymentLabel(order);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="font-normal">
        {getMethodShortLabel(method)}
      </Badge>
      <Badge
        variant="secondary"
        className={cn(
          "font-normal",
          payment === "paid" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          payment === "unpaid" && "bg-amber-500/10 text-amber-800 dark:text-amber-400",
          payment === "failed" && "bg-red-500/10 text-red-700 dark:text-red-400",
        )}
      >
        {getPaymentStatusLabel(payment)}
      </Badge>
    </div>
  );
}

export function OrderProgressBadge({ order }: { order: MerchantOrder }) {
  const progress = getOrderProgress(order);
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        progress === "new" && "bg-sky-500/10 text-sky-800 dark:text-sky-400",
        progress === "ready" && "bg-violet-500/10 text-violet-800 dark:text-violet-400",
        progress === "completed" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        progress === "canceled" && "text-muted-foreground",
      )}
    >
      {getOrderProgressLabel(progress)}
    </Badge>
  );
}

export function OrderDeliveryCell({ order }: { order: MerchantOrder }) {
  const label = getDeliveryLabel(order);
  return (
    <span className="text-sm text-muted-foreground">{getDeliveryDisplayLabel(label)}</span>
  );
}
