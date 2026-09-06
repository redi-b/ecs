"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { useId, useState } from "react";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { formatOrderReference, getDisplayOrderEmail } from "@/features/orders/order-domain";
import { formatMoney, formatShortDate } from "@/features/overview/overview-helpers";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

type WaitingOrder = NonNullable<
  NonNullable<MerchantDashboardSummary["operations"]>["waitingOrders"]
>[number];

function ProductPreview({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // biome-ignore lint/performance/noImgElement: Merchant media uses per-shop storage hosts; thumbnails are lazy loaded at a fixed size.
    <img
      src={src}
      alt=""
      loading="lazy"
      width={48}
      height={48}
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <AppIcons.products className="size-5 text-muted-foreground" aria-hidden />
  );
}

export function WaitingOrders({
  orders,
  currencyCode,
  href,
}: {
  orders: WaitingOrder[] | null | undefined;
  currencyCode: string;
  href: (value: string) => string;
}) {
  const { t, locale } = useI18n();
  const headingId = useId();
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground" id={headingId}>
          {t("overview.attention.waitingOnYou")}
        </h3>
        <Link
          className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={href(dashboardRoutes.orders)}
          prefetch={false}
        >
          {t("overview.attention.allOrders")}
        </Link>
      </div>
      {orders?.length ? (
        <section
          aria-labelledby={headingId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Make the scroll region keyboard-scrollable.
          tabIndex={0}
          className="max-h-[8.125rem] overflow-y-auto overscroll-y-contain rounded-lg border [scrollbar-gutter:stable] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ul className="divide-y">
            {orders.map((order) => {
              const first = order.products[0];
              const customer = order.customerName || getDisplayOrderEmail(order.email);
              return (
                <li key={order.id}>
                  <Link
                    href={href(dashboardRoutes.orderDetail(order.id))}
                    prefetch={false}
                    className="group grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-1.5 text-sm transition-colors first:rounded-t-[calc(var(--radius)-1px)] last:rounded-b-[calc(var(--radius)-1px)] hover:bg-muted/45 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="relative isolate block h-10 w-14 shrink-0" aria-hidden>
                      {(order.products.length ? order.products : [{ id: "empty", thumbnail: null }])
                        .slice(0, 3)
                        .map((product, index) => (
                          <span
                            key={product.id}
                            className="absolute top-0 flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted ring-2 ring-background"
                            style={{ left: `${index * 0.5}rem`, zIndex: 3 - index }}
                          >
                            <ProductPreview key={product.thumbnail} src={product.thumbnail} />
                          </span>
                        ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-x-1.5">
                        <span className="truncate text-sm font-medium">
                          {first?.title || t("overview.attention.orderItems")}
                        </span>
                        {order.productCount > 1 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t("overview.attention.moreProducts", {
                              count: order.productCount - 1,
                            })}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-x-2 text-xs text-muted-foreground">
                        {customer ? <span className="truncate">{customer}</span> : null}
                        <span className="truncate" title={formatOrderReference(order)}>
                          {formatOrderReference(order)}
                        </span>
                        {order.createdAt ? (
                          <time className="shrink-0" dateTime={order.createdAt}>
                            {formatShortDate(order.createdAt, locale)}
                          </time>
                        ) : null}
                      </span>
                      <span className="block truncate text-[11px] leading-4">
                        {order.reasons.map((reason) => (
                          <span
                            key={reason}
                            className={
                              reason === "payment"
                                ? "mr-2 text-amber-700 dark:text-amber-400"
                                : "mr-2 text-muted-foreground"
                            }
                          >
                            {t(
                              reason === "payment"
                                ? "overview.attention.awaitingPayment"
                                : "overview.attention.unfulfilledOrders",
                            )}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 self-start pt-0.5 text-xs font-medium tabular-nums">
                      {formatMoney(order.total, order.currencyCode ?? currencyCode, locale)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="py-5 text-sm text-muted-foreground">
          {t(orders ? "overview.attention.emptyQueue" : "overview.attention.queueUnavailable")}
        </p>
      )}
    </div>
  );
}
