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
                    className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm transition-colors first:rounded-t-[calc(var(--radius)-1px)] last:rounded-b-[calc(var(--radius)-1px)] hover:bg-muted/45 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="relative isolate block h-11 w-16 shrink-0" aria-hidden>
                      {(order.products.length ? order.products : [{ id: "empty", thumbnail: null }])
                        .slice(0, 3)
                        .map((product, index) => (
                          <span
                            key={product.id}
                            className={`absolute top-0.5 flex size-10 items-center justify-center overflow-hidden rounded-lg border border-foreground/10 bg-muted shadow-sm ring-2 ring-card transition-transform duration-200 ease-out motion-reduce:transition-none ${index === 0 ? "group-hover:-translate-x-0.5 group-focus-visible:-translate-x-0.5" : index === 1 ? "rotate-3 group-hover:translate-x-1 group-hover:rotate-6 group-focus-visible:translate-x-1 group-focus-visible:rotate-6" : "rotate-6 group-hover:translate-x-1.5 group-hover:rotate-12 group-focus-visible:translate-x-1.5 group-focus-visible:rotate-12"}`}
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
                        <span className="sr-only">{formatOrderReference(order)}</span>
                        {order.createdAt ? (
                          <time className="shrink-0" dateTime={order.createdAt}>
                            {formatShortDate(order.createdAt, locale)}
                          </time>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col items-end gap-1 text-xs">
                      <span className="font-medium tabular-nums">
                        {formatMoney(order.total, order.currencyCode ?? currencyCode, locale)}
                      </span>
                      <span className="flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-[11px] leading-4">
                        {order.reasons.map((reason) => (
                          <span
                            key={reason}
                            className={
                              reason === "payment"
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground"
                            }
                          >
                            {t(
                              reason === "payment"
                                ? "overview.attention.awaitingPayment"
                                : "overview.attention.toPack",
                            )}
                          </span>
                        ))}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="flex min-h-24 items-center gap-3 rounded-lg border border-dashed px-4 py-5">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
          >
            <AppIcons.products className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            {t(orders ? "overview.attention.emptyQueue" : "overview.attention.queueUnavailable")}
          </p>
        </div>
      )}
    </div>
  );
}
