"use client";

import type { MerchantOrder } from "@ecs/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatOrderDisplayId,
  formatOrderMoney,
  formatOrderStatusLabel,
  getOrderCustomerPrimaryLine,
  getOrderCustomerSecondaryLine,
  getOrderSimpleStatus,
} from "@/features/orders/order-table-state";
import { cn } from "@/lib/utils";

type OrderStatusTone = "fulfillment" | "order" | "payment";

export function OrderIdentityCell({ href, order }: { href: string; order: MerchantOrder }) {
  return (
    <Link
      className="group flex min-w-24 flex-col gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={href}
    >
      <span className="font-medium text-foreground transition-colors group-hover:text-primary">
        {formatOrderDisplayId(order)}
      </span>
    </Link>
  );
}

export function OrderCustomerCell({ order }: { order: MerchantOrder }) {
  const primary = getOrderCustomerPrimaryLine(order);
  const secondary = getOrderCustomerSecondaryLine(order);

  return (
    <div className="flex min-w-40 flex-col gap-1">
      <span className="text-sm text-foreground">{primary}</span>
      {secondary ? <span className="text-xs text-muted-foreground">{secondary}</span> : null}
    </div>
  );
}

export function OrderMoneyCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="font-medium tabular-nums text-foreground">
      {formatOrderMoney(order.total, order.currencyCode)}
    </span>
  );
}

export function OrderSimpleStatusBadge({ order }: { order: MerchantOrder }) {
  const label = getOrderSimpleStatus(order);
  const key = label.toLowerCase();

  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5",
        key === "done" || key === "delivered"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : key === "ready"
            ? "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            : key === "canceled"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
      variant="outline"
    >
      {label}
    </Badge>
  );
}

export function OrderStatusBadge({
  status,
  tone = "order",
}: {
  status: string | null;
  tone?: OrderStatusTone;
}) {
  const label = formatOrderStatusLabel(status, tone);
  const normalized = status?.replaceAll("_", " ").toLowerCase() ?? "unknown";
  const isPositive =
    normalized.includes("paid") ||
    normalized.includes("captured") ||
    normalized.includes("fulfilled") ||
    normalized.includes("complete") ||
    normalized.includes("delivered");
  const isAttention =
    normalized.includes("pending") ||
    normalized.includes("awaiting") ||
    normalized.includes("requires") ||
    normalized.includes("not_paid") ||
    normalized.includes("not fulfilled") ||
    normalized.includes("not_fulfilled") ||
    normalized.includes("unfulfilled");
  const isCanceled = normalized.includes("cancel");

  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5",
        tone === "payment" && "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        tone === "fulfillment" &&
          "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        tone === "order" &&
          "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        isPositive &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        isAttention && "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        isCanceled && "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      )}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
