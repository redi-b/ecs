"use client";

import type { MerchantOrder } from "@ecs/contracts";
import { useEffect, useRef, useState } from "react";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
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
  getOrderWorkflowLabel,
  getOrderWorkflowStage,
  getPaymentLabel,
  getPaymentStatusLabel,
} from "@/features/orders/order-domain";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { listEntityLinkClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function OrderProductPreview({ src }: { src: string | null | undefined }) {
  return src ? (
    // biome-ignore lint/performance/noImgElement: Merchant media may use tenant storage hosts.
    <img src={src} alt="" loading="lazy" className="size-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      <AppIcons.products aria-hidden />
    </span>
  );
}

function OrderProductsSummary({ order, href }: { order: MerchantOrder; href?: string }) {
  const { t } = useI18n();
  const items = order.items ?? [];
  const [itemsOpen, setItemsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = items[0];
  const title = first?.productTitle ?? first?.title ?? null;
  const extra = Math.max(0, items.length - 1);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  const openItems = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setItemsOpen(true);
  };
  const closeItems = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setItemsOpen(false), 120);
  };
  return (
    <div className="group flex min-w-0 items-center gap-2.5">
      <span className="relative isolate flex h-10 w-14 shrink-0 items-center" aria-hidden>
        {(items.length ? items : [{ id: "empty", thumbnail: null }])
          .slice(0, 3)
          .map((item, index) => (
            <span
              className={cn(
                "absolute flex size-9 items-center justify-center overflow-hidden rounded-md border border-foreground/10 bg-muted shadow-sm ring-2 ring-card transition-transform duration-200 ease-out motion-reduce:transition-none",
                index === 0
                  ? "left-0 group-hover:-translate-x-1 group-focus-within:-translate-x-1"
                  : index === 1
                    ? "left-2 rotate-3 group-hover:translate-x-1 group-hover:rotate-6 group-focus-within:translate-x-1 group-focus-within:rotate-6"
                    : "left-4 rotate-6 group-hover:translate-x-2 group-hover:rotate-12 group-focus-within:translate-x-2 group-focus-within:rotate-12",
              )}
              key={item.id}
              style={{ zIndex: 3 - index }}
            >
              <OrderProductPreview src={item.thumbnail} />
            </span>
          ))}
      </span>
      <span className="min-w-0">
        {href ? (
          <Link
            className={cn(listEntityLinkClassName, "block truncate font-medium")}
            href={href}
            prefetch={false}
          >
            {title ?? "—"}
          </Link>
        ) : (
          <span className="block truncate font-medium">{title ?? "—"}</span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {extra ? (
            <Popover onOpenChange={setItemsOpen} open={itemsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-sm px-1 text-left hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  onPointerEnter={(event) => event.pointerType === "mouse" && openItems()}
                  onPointerLeave={(event) => event.pointerType === "mouse" && closeItems()}
                >
                  +{extra} {t("orders.labels.more")}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 p-2"
                onPointerEnter={(event) => event.pointerType === "mouse" && openItems()}
                onPointerLeave={(event) => event.pointerType === "mouse" && closeItems()}
              >
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  {t("orders.labels.items")}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <li className="flex items-center gap-2 rounded-md px-1 py-1.5" key={item.id}>
                      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        <OrderProductPreview src={item.thumbnail} />
                      </span>
                      <span className="min-w-0 truncate text-sm">
                        {item.productTitle ?? item.title ?? t("orders.labels.itemFallback")}
                      </span>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          ) : (
            <span>
              {t(
                (first?.quantity ?? 0) === 1 ? "orders.labels.itemOne" : "orders.labels.itemsCount",
                {
                  count: first?.quantity ?? 0,
                },
              )}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

export function OrderIdentityCell({
  href: hrefOverride,
  order,
  tenantId,
}: {
  href?: string | null;
  order: MerchantOrder;
  tenantId?: string;
}) {
  const href =
    hrefOverride === null
      ? null
      : (hrefOverride ?? getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId));
  if (!href) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3">
        <OrderProductsSummary order={order} />
      </div>
    );
  }
  return <OrderProductsSummary order={order} href={href} />;
}

export function OrderReferenceCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {formatOrderReference(order)}
    </span>
  );
}

export function OrderPlacedCell({ order }: { order: MerchantOrder }) {
  const { formatDateTime } = useI18n();
  return (
    <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
      {order.createdAt ? formatDateTime(order.createdAt) : "—"}
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
  return <p className="max-w-[14rem] truncate text-sm">{getOrderItemsSummary(order, t)}</p>;
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
  const progress = getOrderWorkflowStage(order);
  const variant =
    progress === "completed"
      ? "success"
      : progress === "new"
        ? "info"
        : progress === "ready_for_pickup" || progress === "out_for_delivery" || progress === "ready"
          ? "secondary"
          : progress === "canceled"
            ? "outline"
            : "secondary";
  return (
    <Badge variant={variant} className="font-normal">
      {getOrderWorkflowLabel(progress, t)}
    </Badge>
  );
}

export function OrderDeliveryCell({ order }: { order: MerchantOrder }) {
  const { t } = useI18n();
  const label = getDeliveryLabel(order);
  return <span className="text-sm text-muted-foreground">{getDeliveryDisplayLabel(label, t)}</span>;
}
