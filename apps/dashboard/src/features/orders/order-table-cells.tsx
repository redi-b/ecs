"use client";

import type { MerchantOrder } from "@ecs/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
} from "@/features/orders/order-table-state";
import { cn } from "@/lib/utils";

type OrderStatusTone = "fulfillment" | "order" | "payment";

export function OrderIdentityCell({ href, order }: { href: string; order: MerchantOrder }) {
  return (
    <Link
      className="group flex min-w-36 flex-col gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={href}
    >
      <span className="font-medium text-foreground transition-colors group-hover:text-primary">
        {formatOrderDisplayId(order)}
      </span>
      <span className="text-xs text-muted-foreground">{formatOrderDate(order.createdAt)}</span>
    </Link>
  );
}

export function OrderCustomerCell({ order }: { order: MerchantOrder }) {
  return (
    <div className="flex min-w-44 flex-col gap-1">
      <span className="text-sm text-foreground">
        {order.delivery?.customerName ?? order.email ?? "No customer"}
      </span>
      <span className="text-xs text-muted-foreground">
        {order.delivery?.customerPhone ?? order.email ?? "No contact captured"}
      </span>
    </div>
  );
}

export function OrderMoneyCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="font-medium text-foreground">
      {formatOrderMoney(order.total, order.currencyCode)}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  tone = "order",
}: {
  status: string | null;
  tone?: OrderStatusTone;
}) {
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
    normalized.includes("not fulfilled") ||
    normalized.includes("unfulfilled");
  const isCanceled = normalized.includes("cancel");

  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 capitalize",
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
      {normalized}
    </Badge>
  );
}
