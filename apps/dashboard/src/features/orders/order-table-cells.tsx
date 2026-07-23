"use client";

import type { MerchantOrder } from "@ecs/contracts";
import Link from "@/components/app/link";

import { Badge } from "@/components/ui/badge";
import {
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderReference,
  getDeliveryDisplayLabel,
  getDeliveryLabel,
  getDisplayOrderEmail,
  getMethodLabel,
  getMethodShortLabel,
  getOrderCustomerPhone,
  getOrderCustomerRealName,
  getOrderItemsSummary,
  getOrderProgress,
  getOrderProgressLabel,
  getPaymentLabel,
  getPaymentStatusLabel,
} from "@/features/orders/order-domain";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
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
    <Link className={cn(listEntityLinkClassName, "tabular-nums")} href={href} prefetch={false}>
      {formatOrderReference(order)}
    </Link>
  );
}

export function OrderPlacedCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="whitespace-nowrap text-sm text-muted-foreground">
      {formatOrderDateTime(order.createdAt)}
    </span>
  );
}

export function OrderCustomerCell({ order }: { order: MerchantOrder }) {
  const { t } = useI18n();
  const realName = getOrderCustomerRealName(order);
  const phone = getOrderCustomerPhone(order);
  const email = getDisplayOrderEmail(order.email);

  // Prefer real name; otherwise lead with phone/email so we never show
  // "Customer" under a column also labeled Customer.
  const primary = realName || phone || email || t("orders.labels.customerFallback");
  const secondary = realName ? phone || email : phone && email ? email : null;
  const primaryIsPhone = !realName && Boolean(phone) && primary === phone;

  return (
    <div className="min-w-0 space-y-0.5">
      <p className="truncate font-medium">
        {primaryIsPhone ? (
          <a className="hover:underline" href={`tel:${phone}`}>
            {primary}
          </a>
        ) : (
          primary
        )}
      </p>
      {secondary ? (
        <p className="truncate text-xs text-muted-foreground">
          {realName && phone ? (
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
  const { t } = useI18n();
  return (
    <p className="max-w-[14rem] truncate text-sm">{getOrderItemsSummary(order, t)}</p>
  );
}

export function OrderMoneyCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="tabular-nums font-medium">
      {formatOrderMoney(order.total, order.currencyCode)}
    </span>
  );
}

export function OrderPaymentCell({ order }: { order: MerchantOrder }) {
  const { t } = useI18n();
  const method = getMethodLabel(order);
  const payment = getPaymentLabel(order);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="font-normal">
        {getMethodShortLabel(method, t)}
      </Badge>
      <Badge
        variant={
          payment === "paid"
            ? "success"
            : payment === "unpaid"
              ? "warning"
              : payment === "failed"
                ? "destructive"
                : "secondary"
        }
        className="font-normal"
      >
        {getPaymentStatusLabel(payment, t)}
      </Badge>
    </div>
  );
}

export function OrderProgressBadge({ order }: { order: MerchantOrder }) {
  const { t } = useI18n();
  const progress = getOrderProgress(order);
  const variant =
    progress === "completed"
      ? "success"
      : progress === "new"
        ? "info"
        : progress === "ready"
          ? "secondary"
          : progress === "canceled"
            ? "outline"
            : "secondary";
  return (
    <Badge variant={variant} className="font-normal">
      {getOrderProgressLabel(progress, t)}
    </Badge>
  );
}

export function OrderDeliveryCell({ order }: { order: MerchantOrder }) {
  const { t } = useI18n();
  const label = getDeliveryLabel(order);
  return (
    <span className="text-sm text-muted-foreground">
      {getDeliveryDisplayLabel(label, t)}
    </span>
  );
}
