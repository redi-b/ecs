"use client";

import type { MerchantBillingStatus } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";

type CatalogPlan = {
  id: string;
  name: string;
  price: string;
  isFree: boolean;
  isCurrent: boolean;
};

type InvoiceRow = MerchantBillingStatus["invoices"][number];

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

/**
 * Merchant-facing plan copy keys. Not raw DB limits (those are not enforced yet).
 * Unknown future plans fall back to name + price only.
 */
function planCopy(name: string, t: Translate) {
  if (name === "Starter") {
    return {
      tagline: t("billing.plans.starter.tagline"),
      highlights: [
        t("billing.plans.starter.highlights.storefront"),
        t("billing.plans.starter.highlights.orders"),
        t("billing.plans.starter.highlights.noPayment"),
      ],
    };
  }
  if (name === "Growth") {
    return {
      tagline: t("billing.plans.growth.tagline"),
      highlights: [
        t("billing.plans.growth.highlights.everythingStarter"),
        t("billing.plans.growth.highlights.monthlyPrepaid"),
        t("billing.plans.growth.highlights.payChapa"),
      ],
    };
  }
  return {
    tagline: t("billing.plan.fallbackTagline"),
    highlights: [] as string[],
  };
}

export function BillingWorkspace({
  billing,
  tenantId,
  storefrontHostname,
  returnedFromPayment = false,
  billingPath,
}: {
  billing: MerchantBillingStatus;
  tenantId: string;
  storefrontHostname: string;
  /** Landed from Chapa return_url with paid=1. */
  returnedFromPayment?: boolean;
  billingPath?: string;
}) {
  const router = useRouter();
  const { t, locale, formatNumber } = useI18n();
  const [isPending, startTransition] = useTransition();
  const busy = isPending;

  const catalog = useMemo((): CatalogPlan[] => {
    if (!billing.plan) return [];
    if (billing.catalog && billing.catalog.length > 0) {
      return billing.catalog;
    }
    const current: CatalogPlan = {
      id: billing.plan.id,
      name: billing.plan.name,
      price: billing.plan.price,
      isFree: billing.plan.isFree === true || Number(billing.plan.price) === 0,
      isCurrent: true,
    };
    const others = (billing.availablePaidPlans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      isFree: Number(plan.price) === 0,
      isCurrent: false,
    }));
    return [current, ...others];
  }, [billing]);

  const currentPlan = catalog.find((plan) => plan.isCurrent) ?? catalog[0];
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const resolvedSelectedId =
    selectedPlanId && catalog.some((plan) => plan.id === selectedPlanId)
      ? selectedPlanId
      : (currentPlan?.id ?? null);
  const selectedPlan =
    catalog.find((plan) => plan.id === resolvedSelectedId) ?? currentPlan ?? null;

  const invoices = useMemo(() => {
    return billing.invoices.filter((invoice) => {
      if (invoice.provider === "trial") return false;
      if (invoice.status === "void" || invoice.status === "cancelled") return false;
      const amount = Number(invoice.amount);
      if (Number.isFinite(amount) && amount === 0 && invoice.status === "paid") return false;
      return true;
    });
  }, [billing.invoices]);

  if (!billing.plan || !billing.subscription || !currentPlan || !selectedPlan) {
    return (
      <Empty className="min-h-60 gap-3 rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] sm:min-h-72">
        <EmptyHeader className="gap-2.5">
          <span className="text-muted-foreground/80">
            <AppIcons.billing className="size-5" aria-hidden />
          </span>
          <EmptyTitle className="font-medium">{t("billing.unavailable.title")}</EmptyTitle>
          <EmptyDescription className="text-sm leading-relaxed">
            {t("billing.unavailable.description")}
          </EmptyDescription>
        </EmptyHeader>
        {billingPath ? (
          <Button asChild size="sm" variant="outline">
            <Link href={billingPath} prefetch={false}>
              <AppIcons.refresh data-icon="inline-start" />
              {t("billing.unavailable.reload")}
            </Link>
          </Button>
        ) : null}
      </Empty>
    );
  }

  const activePlan = currentPlan;
  const chosenPlan = selectedPlan;
  const subscription = billing.subscription;

  const openInvoice = invoices.find((invoice) => invoice.status === "pending") ?? null;
  const history = invoices.filter((invoice) => invoice.id !== openInvoice?.id);

  const isCurrentFree = activePlan.isFree;
  const selectedIsCurrent = chosenPlan.id === activePlan.id;
  const selectedIsFree = chosenPlan.isFree;
  const periodEndMs = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null;
  const daysToPeriodEnd =
    periodEndMs != null && Number.isFinite(periodEndMs)
      ? (periodEndMs - Date.now()) / (24 * 60 * 60 * 1000)
      : null;
  const inRenewalWindow =
    !isCurrentFree &&
    daysToPeriodEnd != null &&
    daysToPeriodEnd <= 7;

  function returnToBillingUrl() {
    // Build with URLSearchParams only — never HTML-entity-encode (&amp;), which
    // Chapa/return redirects may otherwise preserve and break query parsing.
    const url = new URL(dashboardRoutes.billing, window.location.origin);
    url.searchParams.set("tenantId", tenantId);
    url.searchParams.set("paid", "1");
    return url.href;
  }

  const scheduledPlanId = subscription.scheduledPlanId ?? null;
  const scheduledPlanName = subscription.scheduledPlanName ?? null;
  const scheduledEffectiveAt = subscription.scheduledEffectiveAt ?? null;
  const hasScheduledDowngrade = Boolean(scheduledPlanId);
  const selectedIsScheduledTarget =
    Boolean(scheduledPlanId) && chosenPlan.id === scheduledPlanId;
  const periodStillActive =
    !isCurrentFree &&
    subscription.status !== "past_due" &&
    periodEndMs != null &&
    Number.isFinite(periodEndMs) &&
    periodEndMs > Date.now();

  function runBillingAction(
    body: Record<string, unknown>,
    successMessage = t("billing.toast.invoiceReady"),
  ) {
    startTransition(async () => {
      try {
        const path = getTenantScopedPath("/admin/billing/actions", tenantId);
        const response = await fetch(path, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(toastErrorFromBody(data));
          return;
        }

        if (data?.alreadyPaid === true) {
          toast.success(t("billing.toast.paymentConfirmed"));
          router.refresh();
          return;
        }

        if (typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
          toast.success(t("billing.toast.openingCheckout"));
          window.location.href = data.checkoutUrl;
          return;
        }

        if (data?.scheduled === true) {
          toast.success(
            data.effectiveAt
              ? t("billing.toast.switchesOn", {
                  date: formatBillingDate(String(data.effectiveAt), locale),
                })
              : t("billing.toast.planChangeScheduled"),
          );
          router.refresh();
          return;
        }

        if (data?.applied === true) {
          toast.success(t("billing.toast.nowOnFree"));
          router.refresh();
          return;
        }

        if (data?.cancelled === true) {
          toast.success(t("billing.toast.scheduledCancelled"));
          router.refresh();
          return;
        }

        toast.success(successMessage);
        router.refresh();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function handlePrimaryAction() {
    // Pay only when a paid plan is selected (not while browsing free/current free).
    if (openInvoice && !selectedIsFree) {
      runBillingAction({
        action: "pay",
        invoiceId: openInvoice.id,
        returnUrl: returnToBillingUrl(),
      });
      return;
    }

    // Keep paid plan: cancel scheduled free switch.
    if (
      selectedIsCurrent &&
      !selectedIsFree &&
      hasScheduledDowngrade &&
      !inRenewalWindow &&
      subscription.status !== "past_due"
    ) {
      runBillingAction({ action: "cancel_downgrade" }, t("billing.toast.scheduledCancelled"));
      return;
    }

    if (selectedIsCurrent && selectedIsFree) {
      return;
    }

    // Renew current paid plan (lead window or past due).
    if (selectedIsCurrent && !selectedIsFree && (inRenewalWindow || subscription.status === "past_due")) {
      runBillingAction({
        action: "upgrade",
        planId: chosenPlan.id,
      });
      return;
    }

    if (selectedIsCurrent && !selectedIsFree) {
      return;
    }

    // Free plan: schedule at period end, or switch now if period already ended.
    if (selectedIsFree && !selectedIsCurrent) {
      runBillingAction({
        action: "downgrade",
        planId: chosenPlan.id,
      });
      return;
    }

    if (!selectedIsFree) {
      runBillingAction({
        action: "upgrade",
        planId: chosenPlan.id,
      });
    }
  }

  const primaryLabel = (() => {
    // Pay belongs on paid selection; free selection never shows Pay (open invoice is above).
    if (openInvoice && !selectedIsFree) {
      return t("billing.payment.payAmount", {
        amount: formatMoney(openInvoice.amount, openInvoice.currency, formatNumber),
      });
    }
    if (selectedIsCurrent && selectedIsFree) {
      return t("billing.primary.currentPlan");
    }
    if (
      selectedIsCurrent &&
      !selectedIsFree &&
      hasScheduledDowngrade &&
      !inRenewalWindow &&
      subscription.status !== "past_due"
    ) {
      return t("billing.primary.keepPlan");
    }
    if (
      selectedIsCurrent &&
      !selectedIsFree &&
      (inRenewalWindow || subscription.status === "past_due")
    ) {
      return subscription.status === "past_due"
        ? t("billing.primary.renewPlan")
        : t("billing.primary.renewPeriod");
    }
    if (selectedIsCurrent && !selectedIsFree) {
      return t("billing.primary.currentPlan");
    }
    if (selectedIsFree && !selectedIsCurrent) {
      if (selectedIsScheduledTarget) {
        return t("billing.primary.changeScheduled");
      }
      return periodStillActive && subscription.currentPeriodEnd
        ? t("billing.primary.switchAfter", {
            date: formatBillingDate(subscription.currentPeriodEnd, locale),
          })
        : t("billing.primary.switchTo", { name: chosenPlan.name });
    }
    if (!selectedIsFree) {
      return t("billing.primary.continueWith", { name: chosenPlan.name });
    }
    return t("billing.primary.selectPlan");
  })();

  const primaryDisabled =
    busy ||
    (selectedIsFree && selectedIsScheduledTarget) ||
    (selectedIsCurrent && selectedIsFree) ||
    (selectedIsCurrent &&
      !selectedIsFree &&
      !openInvoice &&
      !hasScheduledDowngrade &&
      !inRenewalWindow &&
      subscription.status !== "past_due");

  const freePlanLabel = t("billing.plan.freePlan");
  const theFreePlanLabel = t("billing.plan.theFreePlan");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* Current plan — single source of truth, one status */}
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("billing.plan.current")}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-medium tracking-tight">{activePlan.name}</h2>
          <Badge variant="secondary">
            {isCurrentFree ? t("billing.plan.free") : formatStatus(subscription.status, t)}
          </Badge>
          {hasScheduledDowngrade ? (
            <Badge variant="outline">
              {t("billing.plan.switchesTo", {
                name: scheduledPlanName ?? freePlanLabel,
              })}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {isCurrentFree
            ? t("billing.plan.noPaymentRequired")
            : subscription.currentPeriodEnd
              ? t("billing.plan.paidThrough", {
                  date: formatBillingDate(subscription.currentPeriodEnd, locale),
                  price: formatPlanPrice(activePlan.price, t, formatNumber),
                  cycle: formatCycle(subscription.billingCycle, t),
                })
              : t("billing.plan.priceCycle", {
                  price: formatPlanPrice(activePlan.price, t, formatNumber),
                  cycle: formatCycle(subscription.billingCycle, t),
                })}
        </p>
        {hasScheduledDowngrade && scheduledEffectiveAt ? (
          <p className="text-sm text-muted-foreground">
            {t("billing.plan.scheduledChange", {
              name: scheduledPlanName ?? theFreePlanLabel,
              date: formatBillingDate(scheduledEffectiveAt, locale),
            })}
          </p>
        ) : null}
      </section>

      {returnedFromPayment && openInvoice ? (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("billing.payment.checkingTitle")}</CardTitle>
            <CardDescription>{t("billing.payment.checkingDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {returnedFromPayment && !openInvoice && !isCurrentFree ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("billing.payment.receivedTitle")}</CardTitle>
            <CardDescription>
              {subscription.currentPeriodEnd
                ? t("billing.payment.receivedThrough", {
                    date: formatBillingDate(subscription.currentPeriodEnd, locale),
                  })
                : t("billing.payment.receivedActive")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Open payment — only when something is actually unpaid */}
      {openInvoice ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("billing.payment.requiredTitle")}</CardTitle>
            <CardDescription>{t("billing.payment.requiredDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{invoiceTitle(openInvoice, t)}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(openInvoice.amount, openInvoice.currency, formatNumber)}
                {openInvoice.dueAt
                  ? ` · ${t("billing.payment.due", {
                      date: formatBillingDate(openInvoice.dueAt, locale),
                    })}`
                  : ""}
              </p>
            </div>
            <Button
              disabled={busy}
              type="button"
              onClick={() =>
                runBillingAction({
                  action: "pay",
                  invoiceId: openInvoice.id,
                  returnUrl: returnToBillingUrl(),
                })
              }
            >
              {t("billing.payment.payWithChapa")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Plan selection — scales with catalog length */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">{t("billing.plan.plansHeading")}</h3>
          <p className="text-sm text-muted-foreground">{t("billing.plan.plansDescription")}</p>
        </div>

        <div
          className={cn(
            "grid gap-3",
            catalog.length === 1 && "grid-cols-1",
            catalog.length === 2 && "sm:grid-cols-2",
            catalog.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {catalog.map((plan) => {
            const copy = planCopy(plan.name, t);
            const selected = plan.id === chosenPlan.id;
            return (
              <button
                key={plan.id}
                type="button"
                disabled={busy}
                onClick={() => setSelectedPlanId(plan.id as string)}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary ring-1 ring-primary/30" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{copy.tagline}</p>
                  </div>
                  {plan.isCurrent ? (
                    <Badge variant="secondary">{t("billing.plan.currentBadge")}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-lg font-semibold tabular-nums">
                  {formatPlanPrice(plan.price, t, formatNumber)}
                  {!plan.isFree ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      {t("billing.plan.perMonth")}
                    </span>
                  ) : null}
                </p>
                {copy.highlights.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {copy.highlights.map((line) => (
                      <li
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        key={line}
                      >
                        <AppIcons.check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedIsCurrent
              ? selectedIsFree
                ? openInvoice
                  ? t("billing.hint.onStarterSelectGrowth")
                  : t("billing.hint.alreadyOnPlan")
                : openInvoice
                  ? t("billing.hint.finishPayment")
                  : hasScheduledDowngrade
                    ? t("billing.hint.scheduledKeep", {
                        name: scheduledPlanName ?? theFreePlanLabel,
                      })
                    : inRenewalWindow
                      ? t("billing.hint.endingSoon")
                      : subscription.status === "past_due"
                        ? t("billing.hint.periodEnded")
                        : t("billing.hint.alreadyOnPlan")
              : selectedIsFree
                ? selectedIsScheduledTarget
                  ? t("billing.hint.alreadyScheduled", {
                      current: activePlan.name,
                      date: formatBillingDate(
                        scheduledEffectiveAt || subscription.currentPeriodEnd || "",
                        locale,
                      ),
                    })
                  : periodStillActive && subscription.currentPeriodEnd
                    ? t("billing.hint.noRefundKeepUntil", {
                        current: activePlan.name,
                        date: formatBillingDate(subscription.currentPeriodEnd, locale),
                        next: chosenPlan.name,
                      })
                    : t("billing.hint.switchNowPeriodEnded", { name: chosenPlan.name })
                : openInvoice
                  ? t("billing.hint.completeOrContinue")
                  : t("billing.hint.chargedForMonth", {
                      price: formatPlanPrice(chosenPlan.price, t, formatNumber),
                    })}
          </p>
          <Button
            className="shrink-0 sm:min-w-[12rem]"
            disabled={primaryDisabled}
            type="button"
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </Button>
        </div>
      </section>

      {/* History — quiet, only when relevant */}
      {history.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold">{t("billing.payment.historyTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("billing.payment.historyDescription")}
            </p>
          </div>
          <ul
            className={cn(
              "flex flex-col gap-2",
              history.length > 6 &&
                "max-h-[min(22rem,45vh)] overflow-y-auto overscroll-contain pr-0.5",
            )}
          >
            {history.map((invoice) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm"
                key={invoice.id}
              >
                <div className="min-w-0">
                  <p className="font-medium">{invoiceTitle(invoice, t)}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.paidAt
                      ? t("billing.payment.paidOn", {
                          date: formatBillingDate(invoice.paidAt, locale),
                        })
                      : t("billing.payment.createdOn", {
                          date: formatBillingDate(invoice.createdAt, locale),
                        })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {formatMoney(invoice.amount, invoice.currency, formatNumber)}
                  </span>
                  <Badge variant="secondary">{invoiceStatusLabel(invoice.status, t)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        <Link
          className="underline-offset-2 hover:underline"
          href={dashboardRoutes.settings}
          prefetch={false}
        >
          {t("billing.footer.shopSettings")}
        </Link>
        {" · "}
        <a
          className="underline-offset-2 hover:underline"
          href={`//${storefrontHostname}`}
          rel="noreferrer"
          target="_blank"
        >
          {t("billing.footer.viewStorefront")}
        </a>
      </p>
    </div>
  );
}

function formatCycle(cycle: string, t: Translate) {
  if (cycle === "monthly") return t("billing.cycle.month");
  if (cycle === "yearly" || cycle === "annual") return t("billing.cycle.year");
  return cycle;
}

function formatStatus(status: string, t: Translate) {
  if (status === "trialing") return t("billing.status.trial");
  if (status === "active") return t("billing.status.active");
  if (status === "past_due") return t("billing.status.pastDue");
  if (status === "canceled" || status === "cancelled") return t("billing.status.cancelled");
  return status;
}

function formatBillingDate(value: string, locale: string) {
  if (!value) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatPlanPrice(
  price: string,
  t: Translate,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return price;
  if (amount === 0) return t("billing.plan.free");
  return formatNumber(amount, {
    currency: "ETB",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function formatMoney(
  amount: string,
  currency: string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency.toUpperCase()}`;
  try {
    return formatNumber(value, {
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    });
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

function invoiceTitle(invoice: InvoiceRow, t: Translate) {
  if (invoice.provider === "chapa" || invoice.status === "paid") return t("billing.invoice.planPayment");
  if (invoice.provider?.startsWith("plan:")) return t("billing.invoice.planUpgrade");
  if (invoice.status === "pending") return t("billing.invoice.open");
  return t("billing.invoice.generic");
}

function invoiceStatusLabel(status: string, t: Translate) {
  if (status === "pending") return t("billing.invoice.unpaid");
  if (status === "paid") return t("billing.invoice.paid");
  if (status === "void" || status === "cancelled") return t("billing.invoice.cancelled");
  return status;
}

/** Prefer explicit API message; never toast raw objects as [object Object]. */
function toastErrorFromBody(data: unknown): string {
  const record =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const error = typeof record.error === "string" ? record.error.trim() : "";
  if (message && message !== "[object Object]") {
    return message;
  }
  if (error && error !== "[object Object]") {
    return mapPlatformErrorMessage(error);
  }
  return mapPlatformErrorMessage("billing_pay_failed");
}
