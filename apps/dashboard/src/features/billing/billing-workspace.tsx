"use client";

import type { MerchantBillingStatus } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CatalogPlan = {
  features: unknown;
  id: string;
  limits: unknown;
  name: string;
  price: string;
  isFree: boolean;
  isCurrent: boolean;
  publicName?: string | null | undefined;
  summary?: string | null | undefined;
  featureList?: string[] | undefined;
  trial?:
    | {
        available: boolean;
        durationDays?: number | undefined;
        versionId?: string | undefined;
      }
    | undefined;
};

type InvoiceRow = MerchantBillingStatus["invoices"][number];

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

function getProductLimit(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const products = Reflect.get(value, "products");
  return typeof products === "number" && Number.isSafeInteger(products) && products >= 0
    ? products
    : null;
}

function getBooleanFeature(value: unknown, key: string): boolean {
  return Boolean(value && typeof value === "object" && Reflect.get(value, key) === true);
}

function planCopy(plan: CatalogPlan, t: Translate) {
  return {
    tagline: plan.summary?.trim() || t("billing.plan.fallbackTagline"),
    highlights: plan.featureList ?? [],
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
  const paymentDestinations = billing.paymentDestinations ?? [];
  const hasPaymentDestinations = paymentDestinations.length > 0;

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
      limits: billing.plan.limits,
      features: billing.plan.features,
    };
    const others = (billing.availablePaidPlans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      isFree: Number(plan.price) === 0,
      isCurrent: false,
      limits: plan.limits,
      features: plan.features,
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
  const customDomainsIncluded = billing.entitlements?.customDomains?.allowed === true;
  const activeProductLimit = getProductLimit(activePlan.limits);

  const openInvoice = invoices.find((invoice) => invoice.status === "pending") ?? null;
  const history = invoices.filter((invoice) => invoice.id !== openInvoice?.id);

  const isCurrentFree = activePlan.isFree;
  const isTrialing = subscription.status === "trialing";
  const selectedIsCurrent = chosenPlan.id === activePlan.id;
  const selectedIsFree = chosenPlan.isFree;
  const periodEndMs = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null;
  const daysToPeriodEnd =
    periodEndMs != null && Number.isFinite(periodEndMs)
      ? (periodEndMs - Date.now()) / (24 * 60 * 60 * 1000)
      : null;
  const inRenewalWindow = !isCurrentFree && daysToPeriodEnd != null && daysToPeriodEnd <= 7;

  const scheduledPlanId = subscription.scheduledPlanId ?? null;
  const scheduledPlanName = subscription.scheduledPlanName ?? null;
  const scheduledEffectiveAt = subscription.scheduledEffectiveAt ?? null;
  const hasScheduledDowngrade = Boolean(scheduledPlanId);
  const selectedIsScheduledTarget = Boolean(scheduledPlanId) && chosenPlan.id === scheduledPlanId;
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
        const path = getTenantScopedPath("/dashboard/billing/actions", tenantId);
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
    if (
      selectedIsCurrent &&
      !selectedIsFree &&
      (inRenewalWindow || subscription.status === "past_due")
    ) {
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

    if (!selectedIsFree && chosenPlan.trial?.available && chosenPlan.trial.versionId) {
      runBillingAction(
        { action: "trial", planId: chosenPlan.trial.versionId },
        t("billing.toast.trialStarted", { days: chosenPlan.trial.durationDays ?? 0 }),
      );
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
    if (!selectedIsFree && chosenPlan.trial?.available) {
      return t("billing.primary.startTrial", { days: chosenPlan.trial.durationDays ?? 0 });
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
        <p className="text-xs font-medium text-muted-foreground">{t("billing.plan.current")}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-medium tracking-tight">{activePlan.name}</h2>
          <Badge variant="secondary">
            {isCurrentFree
              ? t("billing.plan.free")
              : isTrialing
                ? t("billing.plan.trial")
                : formatStatus(subscription.status, t)}
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
          {isTrialing && subscription.trialEndsAt
            ? t("billing.plan.trialEnds", {
                date: formatBillingDate(subscription.trialEndsAt, locale),
              })
            : isCurrentFree
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

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("billing.entitlements.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>{t("billing.entitlements.products")}</span>
            <Badge variant="outline">
              {activeProductLimit == null
                ? t("billing.entitlements.unlimited")
                : t("billing.entitlements.upToProducts", { count: activeProductLimit })}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>{t("billing.entitlements.customDomains")}</span>
            <Badge variant="outline">
              {customDomainsIncluded
                ? t("billing.entitlements.included")
                : t("billing.entitlements.notIncluded")}
            </Badge>
          </div>
        </CardContent>
      </Card>

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
            <CardDescription>
              {hasPaymentDestinations
                ? t("billing.payment.requiredDescription")
                : t("billing.payment.detailsUnavailableDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{invoiceTitle(openInvoice, t)}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(openInvoice.amount, openInvoice.currency, formatNumber)}
                {openInvoice.dueAt
                  ? ` · ${t("billing.payment.due", {
                      date: formatBillingDate(openInvoice.dueAt, locale),
                    })}`
                  : ""}
              </p>
              {openInvoice.paymentEvidence?.status === "rejected" ? (
                <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-destructive">
                    {t("billing.payment.rejectedTitle")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {openInvoice.paymentEvidence.reviewReason ||
                      t("billing.payment.rejectedDescription")}
                  </p>
                </div>
              ) : null}
            </div>
            {!hasPaymentDestinations ? (
              <Badge className="shrink-0" variant="outline">
                {t("billing.payment.detailsUnavailable")}
              </Badge>
            ) : openInvoice.paymentEvidence?.status === "needs_review" ? (
              <Badge className="shrink-0" variant="secondary">
                {t("billing.payment.reviewPending")}
              </Badge>
            ) : (
              <PaymentEvidenceDialog
                amount={formatMoney(openInvoice.amount, openInvoice.currency, formatNumber)}
                invoiceId={openInvoice.id}
                paymentDestinations={paymentDestinations}
                tenantId={tenantId}
              />
            )}
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
            const copy = planCopy(plan, t);
            const productLimit = getProductLimit(plan.limits);
            const includesCustomDomains = getBooleanFeature(plan.features, "customDomains");
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
                    <p className="font-semibold">{plan.publicName || plan.name}</p>
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
                {plan.trial?.available ? (
                  <p className="mt-1 text-xs font-medium text-primary">
                    {t("billing.plan.trialAvailable", { days: plan.trial.durationDays ?? 0 })}
                  </p>
                ) : null}
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
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/70 pt-3">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AppIcons.check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>
                      {productLimit == null
                        ? t("billing.entitlements.unlimitedProducts")
                        : t("billing.entitlements.upToProducts", { count: productLimit })}
                    </span>
                  </li>
                  {includesCustomDomains ? (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AppIcons.check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{t("billing.entitlements.customDomains")}</span>
                    </li>
                  ) : null}
                </ul>
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
          {openInvoice && !selectedIsFree ? (
            !hasPaymentDestinations ? (
              <Button className="shrink-0 sm:min-w-[12rem]" disabled type="button">
                {t("billing.payment.detailsUnavailable")}
              </Button>
            ) : openInvoice.paymentEvidence?.status === "needs_review" ? (
              <Button className="shrink-0 sm:min-w-[12rem]" disabled type="button">
                {t("billing.payment.reviewPending")}
              </Button>
            ) : (
              <PaymentEvidenceDialog
                amount={formatMoney(openInvoice.amount, openInvoice.currency, formatNumber)}
                {...(billingPath ? { billingPath } : {})}
                invoiceId={openInvoice.id}
                paymentDestinations={paymentDestinations}
                tenantId={tenantId}
                triggerLabel={primaryLabel}
              />
            )
          ) : (
            <Button
              className="shrink-0 sm:min-w-[12rem]"
              disabled={primaryDisabled}
              type="button"
              onClick={handlePrimaryAction}
            >
              {primaryLabel}
            </Button>
          )}
        </div>
      </section>

      {/* History — quiet, only when relevant */}
      {history.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold">{t("billing.payment.historyTitle")}</h3>
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

function PaymentEvidenceDialog({
  amount,
  invoiceId,
  paymentDestinations,
  tenantId,
  triggerLabel,
}: {
  amount: string;
  invoiceId: string;
  paymentDestinations: Array<{
    accountName: string;
    accountNumber: string;
    label: string;
    provider: string;
  }>;
  tenantId: string;
  triggerLabel?: string | undefined;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const referenceId = useId();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(paymentDestinations[0]?.provider ?? "telebirr");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const destination = paymentDestinations.find((item) => item.provider === provider) ?? null;
  const referenceValid = isBillingReferenceValid(provider, reference);

  async function submit() {
    setBusy(true);
    try {
      const path = getTenantScopedPath("/dashboard/billing/actions", tenantId);
      const response = await fetch(path, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit_payment",
          invoiceId,
          provider,
          reference: reference.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(toastErrorFromBody(data));
        return;
      }
      const evidenceStatus =
        data && typeof data === "object" && data.evidence && typeof data.evidence === "object"
          ? String(data.evidence.status ?? "")
          : "";
      if (evidenceStatus === "rejected") {
        toast.error(t("billing.toast.paymentRejected"));
        return;
      }
      toast.success(
        evidenceStatus === "verified"
          ? t("billing.toast.paymentConfirmed")
          : t("billing.toast.paymentSubmitted"),
      );
      setOpen(false);
      setReference("");
      startTransition(() => router.refresh());
    } catch {
      toast.error(mapPlatformErrorMessage("platform_request_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerLabel ? "shrink-0 sm:min-w-[12rem]" : undefined} type="button">
          {triggerLabel ?? t("billing.payment.payInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92dvh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5 sm:pr-12">
          <DialogTitle>{t("billing.transfer.title")}</DialogTitle>
          <DialogDescription>{t("billing.transfer.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("billing.transfer.provider")}>
            {paymentDestinations.map((item) => {
              const selected = item.provider === provider;
              const ProviderIcon = item.provider === "telebirr" ? AppIcons.wallet : AppIcons.bank;
              return (
                <button
                  aria-checked={selected}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/8 ring-1 ring-primary/25"
                      : "border-border bg-card hover:border-primary/35",
                  )}
                  key={item.provider}
                  onClick={() => setProvider(item.provider)}
                  role="radio"
                  type="button"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    <ProviderIcon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
          {destination ? (
            <section className="overflow-hidden rounded-2xl border bg-muted/25">
              <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("billing.transfer.amount")}</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{amount}</p>
                </div>
                <CopyPaymentValue label={t("billing.transfer.copyAmount")} value={amount.replace(/[^0-9.]/g, "")} />
              </div>
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t("billing.transfer.sendTo")}</p>
                  <p className="mt-1 truncate font-medium">{destination.accountName}</p>
                  <p className="select-all font-mono text-sm tabular-nums">{destination.accountNumber}</p>
                </div>
                <CopyPaymentValue label={t("billing.transfer.copyAccount")} value={destination.accountNumber} />
              </div>
            </section>
          ) : null}
          <ol className="grid gap-3">
            {["openApp", "sendExact", "copyReference"].map((step, index) => (
              <li className="flex gap-3" key={step}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {t(`billing.transfer.steps.${step}.title` as MessageKey, {
                      amount,
                      provider: destination?.label ?? "",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`billing.transfer.steps.${step}.description` as MessageKey, {
                      amount,
                      provider: destination?.label ?? "",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <details className="rounded-xl border px-3 py-2.5 text-sm">
            <summary className="cursor-pointer font-medium">{t("billing.transfer.findReference")}</summary>
            <p className="mt-2 text-muted-foreground">{t(provider === "telebirr" ? "billing.transfer.telebirrHelp" : "billing.transfer.cbeHelp")}</p>
          </details>
          <Field>
            <FieldLabel htmlFor={referenceId}>{t("billing.transfer.reference")}</FieldLabel>
            <Input
              autoComplete="off"
              id={referenceId}
              maxLength={500}
              onChange={(event) => setReference(event.target.value)}
              placeholder={t("billing.transfer.referencePlaceholder")}
              value={reference}
            />
            <FieldDescription>{t(provider === "cbe" ? "billing.transfer.cbeReferenceHelp" : "billing.transfer.referenceHelp")}</FieldDescription>
          </Field>
          <Alert>
            <AppIcons.time />
            <AlertTitle>{t("billing.transfer.reviewTitle")}</AlertTitle>
            <AlertDescription>{t("billing.transfer.reviewDescription")}</AlertDescription>
          </Alert>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button disabled={busy} onClick={() => setOpen(false)} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={busy || !referenceValid} onClick={() => void submit()}>
            {busy ? t("billing.transfer.submitting") : t("billing.transfer.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isBillingReferenceValid(provider: string, value: string) {
  const reference = value.trim();
  if (provider === "telebirr" && /^[a-z0-9]{8,14}$/i.test(reference)) return true;
  if (provider !== "telebirr" && provider !== "cbe") return reference.length >= 6;
  try {
    const url = new URL(reference);
    if (url.protocol !== "https:") return false;
    const hosts =
      provider === "telebirr"
        ? new Set(["transactioninfo.ethiotelecom.et"])
        : new Set(["apps.cbe.com.et", "mb.cbe.com.et", "mbreciept.cbe.com.et"]);
    return hosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function CopyPaymentValue({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("billing.transfer.copied"));
    } catch {
      toast.error(t("billing.transfer.copyFailed"));
    }
  }
  return (
    <Button className="shrink-0" onClick={() => void copy()} size="sm" type="button" variant="outline">
      <AppIcons.copy data-icon="inline-start" />
      {label}
    </Button>
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
  if (invoice.provider === "chapa" || invoice.status === "paid")
    return t("billing.invoice.planPayment");
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
