"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ReactNode } from "react";
import Link from "@/components/app/link";

import {
  DetailHero,
  DetailMetric,
  DetailSection,
} from "@/components/app/detail-surface";
import { AppIcons } from "@/components/app/icons";
import { RefreshButton } from "@/components/app/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CustomerAddressDeleteButton,
  CustomerAddressDialog,
} from "@/features/customers/customer-address-dialog";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import {
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderReference,
  getOrderProgress,
  getOrderProgressLabel,
  getPaymentLabel,
  getPaymentStatusLabel,
} from "@/features/orders/order-domain";
import { useI18n } from "@/i18n/provider";
import type { MerchantCustomer } from "@/lib/merchant-customers";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CustomerDetailProps = {
  customer: MerchantCustomer;
  loadOrdersFailed?: boolean;
  orders: MerchantOrder[];
  ordersTotalCount: number;
};

function customerInitials(customer: MerchantCustomer) {
  const first = customer.firstName?.trim()?.[0];
  const last = customer.lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const emailLead = customer.email.trim()[0];
  return (emailLead ?? "?").toUpperCase();
}

/** Platform shop/tenant groups are internal — hide them from merchants. */
function merchantFacingGroups(customer: MerchantCustomer) {
  return customer.groups.filter(
    (group) => !group.name.startsWith("Tenant ") && !group.name.startsWith("Shop "),
  );
}

function progressBadgeVariant(progress: ReturnType<typeof getOrderProgress>) {
  if (progress === "completed") return "default" as const;
  if (progress === "canceled") return "outline" as const;
  return "secondary" as const;
}

function MetaDot() {
  return (
    <span aria-hidden className="text-muted-foreground/50">
      ·
    </span>
  );
}

/** Page-level actions: edit belongs with refresh, not inside the hero metrics row. */
export function CustomerDetailPageActions({ customer }: { customer: MerchantCustomer }) {
  return (
    <div className="flex items-center gap-2">
      <CustomerFormDialog customer={customer} />
      <RefreshButton />
    </div>
  );
}

export function CustomerDetail({
  customer,
  loadOrdersFailed = false,
  orders,
  ordersTotalCount,
}: CustomerDetailProps) {
  const { t, locale } = useI18n();
  const groups = merchantFacingGroups(customer);
  const memberSince = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(customer.createdAt),
  );
  const ordersHref = customer.email
    ? `${dashboardRoutes.orders}?q=${encodeURIComponent(customer.email)}`
    : dashboardRoutes.orders;
  const addressCount = customer.addresses.length;
  const ordersMeta = loadOrdersFailed
    ? null
    : ordersTotalCount === 0
      ? null
      : ordersTotalCount === 1
        ? t("customers.orders.countOne")
        : t("customers.orders.count", { count: ordersTotalCount });

  const metaParts: Array<{ key: string; node: ReactNode }> = [];
  if (customer.phone) {
    metaParts.push({
      key: "phone",
      node: (
        <a className="hover:underline" href={`tel:${customer.phone}`}>
          {customer.phone}
        </a>
      ),
    });
  }
  if (customer.companyName?.trim()) {
    metaParts.push({ key: "company", node: customer.companyName.trim() });
  }
  metaParts.push({ key: "since", node: t("customers.detail.memberSince", { date: memberSince }) });

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <DetailHero>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tracking-wide text-primary ring-1 ring-primary/15"
            >
              {customerInitials(customer)}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  className="truncate text-sm font-medium hover:underline"
                  href={`mailto:${customer.email}`}
                >
                  {customer.email}
                </a>
                {groups.map((group) => (
                  <Badge key={group.id} className="font-normal" variant="secondary">
                    {group.name}
                  </Badge>
                ))}
              </div>
              {metaParts.length ? (
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  {metaParts.map((part, index) => (
                    <span className="inline-flex items-center gap-x-1.5" key={part.key}>
                      {index > 0 ? <MetaDot /> : null}
                      {part.node}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[13rem] sm:shrink-0">
            <DetailMetric
              label={t("customers.orders.title")}
              value={loadOrdersFailed ? "—" : String(ordersTotalCount)}
            />
            <DetailMetric label={t("customers.detail.addresses")} value={String(addressCount)} />
          </div>
        </div>
      </DetailHero>

      <DetailSection
        action={
          <Button asChild size="sm" type="button" variant="outline">
            <Link href={ordersHref} prefetch={false}>
              <AppIcons.orders data-icon="inline-start" />
              {t("customers.orders.viewAll")}
            </Link>
          </Button>
        }
        meta={ordersMeta}
        title={t("customers.orders.title")}
      >
        {loadOrdersFailed ? (
          <p className="text-muted-foreground">{t("customers.orders.loadFailed")}</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground">{t("customers.orders.empty")}</p>
        ) : (
          <>
            <ul className="divide-y rounded-xl border border-border/70">
              {orders.map((order) => {
                const progress = getOrderProgress(order);
                return (
                  <li key={order.id}>
                    <Link
                      className={cn(
                        "flex flex-wrap items-center gap-3 px-3.5 py-3 transition-colors",
                        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      href={dashboardRoutes.orderDetail(order.id)}
                      prefetch={false}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium tabular-nums">
                            {formatOrderReference(order)}
                          </span>
                          <Badge className="font-normal" variant={progressBadgeVariant(progress)}>
                            {getOrderProgressLabel(progress, t)}
                          </Badge>
                          <Badge className="font-normal" variant="outline">
                            {getPaymentStatusLabel(getPaymentLabel(order), t)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatOrderDateTime(order.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatOrderMoney(order.total, order.currencyCode)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {/* Truncation note only — primary “view all” stays in the section header
                so long lists never bury the escape hatch under N rows. */}
            {!loadOrdersFailed && ordersTotalCount > orders.length ? (
              <p className="text-xs text-muted-foreground">
                {t("customers.orders.showingRecent", {
                  shown: orders.length,
                  total: ordersTotalCount,
                })}
              </p>
            ) : null}
          </>
        )}
      </DetailSection>

      <DetailSection
        action={<CustomerAddressDialog customerId={customer.id} />}
        meta={
          addressCount === 0
            ? null
            : addressCount === 1
              ? t("customers.addresses.savedCountOne")
              : t("customers.addresses.savedCount", { count: addressCount })
        }
        title={t("customers.detail.addresses")}
      >
        {addressCount === 0 ? (
          <p className="text-muted-foreground">{t("customers.addresses.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customer.addresses.map((address) => {
              const line = [
                address.address1,
                address.address2,
                address.city,
                address.province,
                address.postalCode,
                address.countryCode?.toUpperCase(),
              ]
                .filter(Boolean)
                .join(", ");
              const contact = [address.firstName, address.lastName].filter(Boolean).join(" ");
              return (
                <div
                  className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/15 p-3.5"
                  key={address.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        {address.addressName ||
                          address.address1 ||
                          t("customers.detail.defaultAddressName")}
                      </p>
                      {contact ? (
                        <p className="text-xs text-muted-foreground">{contact}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {address.isDefaultShipping ? (
                        <Badge className="font-normal" variant="secondary">
                          {t("customers.addresses.defaultShipping")}
                        </Badge>
                      ) : null}
                      {address.isDefaultBilling ? (
                        <Badge className="font-normal" variant="outline">
                          {t("customers.addresses.defaultBilling")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {line || t("customers.addresses.noDetails")}
                  </p>
                  {address.phone ? (
                    <p className="text-xs text-muted-foreground">
                      <a className="hover:underline" href={`tel:${address.phone}`}>
                        {address.phone}
                      </a>
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
                    <CustomerAddressDialog address={address} customerId={customer.id} />
                    <CustomerAddressDeleteButton
                      addressId={address.id}
                      customerId={customer.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>
    </div>
  );
}
