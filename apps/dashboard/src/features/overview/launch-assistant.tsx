"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import {
  getLaunchAssistantOpenPreference,
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
  setLaunchAssistantOpenPreference,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function formatCount(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export type LaunchChecklistItem = {
  id: string;
  label: string;
  description: string;
  ready: boolean;
  href: string;
  /** Required items gate “shop is launch-ready”. Optional items do not. */
  required: boolean;
  current: boolean;
};

/**
 * Merchant launch path (required):
 * profile → catalog → design → publish.
 * Optional: online payments (COD already works).
 */
export function getLaunchChecklistItems(
  summary: MerchantDashboardSummary,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
): LaunchChecklistItem[] {
  const hasShopProfile = Boolean(
    summary.tenant.name.trim() && summary.tenant.handle.trim() && summary.domain.hostname.trim(),
  );
  const hasSalesBackend = summary.commerce.hasStore && summary.commerce.hasSalesChannel;
  const productCount = summary.operations?.totals.products ?? 0;
  const hasCatalog = productCount > 0;
  const hasStorefrontDraft = Boolean(
    summary.storefront.templateKey ?? summary.storefront.templateId,
  );
  const hasPublishedStorefront = summary.storefront.isPublished;
  // COD works without Chapa; do not block launch on billing/plan.
  const hasCommercePath = hasSalesBackend;

  const requiredStates = [
    hasShopProfile,
    hasCommercePath,
    hasCatalog,
    hasStorefrontDraft,
    hasPublishedStorefront,
  ];
  const nextRequiredIndex = requiredStates.findIndex((state) => !state);

  const required: Omit<LaunchChecklistItem, "current">[] = [
    {
      id: "profile",
      label: t("overview.launch.shopProfile"),
      description: hasShopProfile
        ? summary.domain.hostname
        : t("overview.launch.shopProfileMissing"),
      ready: hasShopProfile,
      href: dashboardRoutes.settings,
      required: true,
    },
    {
      id: "commerce",
      label: t("overview.launch.salesSetup"),
      description: hasCommercePath
        ? t("overview.launch.salesSetupReady")
        : t("overview.launch.salesSetupDesc"),
      ready: hasCommercePath,
      href: dashboardRoutes.settings,
      required: true,
    },
    {
      id: "catalog",
      label: t("overview.launch.catalog"),
      description: hasCatalog
        ? t("overview.launch.catalogDesc", { count: formatCount(productCount) })
        : t("overview.launch.catalogEmpty"),
      ready: hasCatalog,
      href: dashboardRoutes.products,
      required: true,
    },
    {
      id: "design",
      label: t("overview.launch.storefrontDesign"),
      description: hasStorefrontDraft
        ? t("overview.launch.storefrontSelected")
        : t("overview.launch.chooseStorefront"),
      ready: hasStorefrontDraft,
      href: hasStorefrontDraft ? dashboardRoutes.editor : `${dashboardRoutes.settings}?tab=storefront`,
      required: true,
    },
    {
      id: "publish",
      label: t("overview.launch.publishStorefront"),
      description: hasPublishedStorefront
        ? t("overview.launch.customersCanAccess")
        : t("overview.launch.reviewAndPublish"),
      ready: hasPublishedStorefront,
      href: `${dashboardRoutes.settings}?tab=storefront`,
      required: true,
    },
  ];

  const optional: Omit<LaunchChecklistItem, "current">[] = [
    {
      id: "fulfillment",
      label: t("overview.launch.fulfillment"),
      description: t("overview.launch.fulfillmentDesc"),
      // Soft: commerce path means checkout can load; merchant should still confirm methods/fee.
      ready: hasCommercePath && hasPublishedStorefront,
      href: `${dashboardRoutes.settings}?tab=fulfillment`,
      required: false,
    },
    {
      id: "payments",
      label: t("overview.launch.payments"),
      description: t("overview.launch.paymentsDesc"),
      ready: true,
      href: `${dashboardRoutes.settings}?tab=payments`,
      required: false,
    },
  ];

  const firstOptionalOpen = optional.findIndex((item) => !item.ready);

  return [
    ...required.map((item, index) => ({
      ...item,
      current: index === nextRequiredIndex,
    })),
    ...optional.map((item, index) => ({
      ...item,
      current: nextRequiredIndex === -1 && index === firstOptionalOpen,
    })),
  ];
}

export function LaunchAssistant({ summary }: { summary: MerchantDashboardSummary }) {
  const { t } = useI18n();
  const items = useMemo(() => getLaunchChecklistItems(summary, t), [summary, t]);
  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => !item.required);
  const completedRequired = requiredItems.filter((item) => item.ready).length;
  const launchReady = completedRequired === requiredItems.length;
  const nextItem = items.find((item) => item.current) ?? null;
  const liveShopHref = `//${summary.domain.hostname}`;

  const [hydrated, setHydrated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextHidden = isLaunchAssistantHidden(summary.tenant.id);
    const nextOpen = getLaunchAssistantOpenPreference(summary.tenant.id);

    setHidden(nextHidden);
    // Default open when not launch-ready; stay collapsed when complete unless user opened it.
    setOpen(nextHidden ? false : (nextOpen ?? !launchReady));
    setHydrated(true);

    function handlePreferenceChange(event: Event) {
      const detail = (event as CustomEvent<{ hidden?: boolean; tenantId?: string }>).detail;

      if (detail?.tenantId !== summary.tenant.id || typeof detail.hidden !== "boolean") {
        return;
      }

      setHidden(detail.hidden);
      setOpen(
        detail.hidden
          ? false
          : (getLaunchAssistantOpenPreference(summary.tenant.id) ?? !launchReady),
      );
    }

    window.addEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);

    return () => {
      window.removeEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);
    };
  }, [launchReady, summary.tenant.id]);

  function dismissAssistant() {
    setLaunchAssistantHidden(summary.tenant.id, true);
    setHidden(true);
    setOpen(false);
    toast(t("overview.launch.hiddenToast"), {
      description: t("overview.launch.hiddenDesc"),
    });
  }

  function toggleOpen() {
    setOpen((value) => {
      const nextOpen = !value;
      setLaunchAssistantOpenPreference(summary.tenant.id, nextOpen);
      return nextOpen;
    });
  }

  if (!hydrated || hidden) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <div
        aria-hidden={!open}
        className={cn(
          "w-[min(420px,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-xl border bg-background shadow-lg transition-all duration-200 ease-out",
          open
            ? "max-h-[min(720px,calc(100dvh-6rem))] translate-y-0 scale-100 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 scale-95 opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {launchReady ? t("overview.launch.titleReady") : t("overview.launch.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {launchReady
                ? t("overview.launch.progressReady")
                : t("overview.launch.progress", {
                    done: completedRequired,
                    total: requiredItems.length,
                  })}
            </p>
          </div>
          <Button
            aria-label={t("overview.aria.closeLaunch")}
            className="shrink-0 text-xl leading-none"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => {
              setLaunchAssistantOpenPreference(summary.tenant.id, false);
              setOpen(false);
            }}
          >
            ×
          </Button>
        </div>

        {launchReady ? (
          <div className="space-y-3 border-b p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("overview.launch.readyBody")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={liveShopHref} rel="noreferrer" target="_blank">
                  <AppIcons.externalLink data-icon="inline-start" />
                  {t("overview.launch.viewShop")}
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={dashboardRoutes.editor} prefetch={false}>
                  {t("overview.launch.openEditor")}
                </Link>
              </Button>
            </div>
          </div>
        ) : nextItem ? (
          <div className="border-b p-3">
            <Button asChild className="w-full justify-between gap-2" size="sm">
              <Link href={nextItem.href} prefetch={false}>
                <span className="truncate">
                  {t("overview.launch.continueNext", { label: nextItem.label })}
                </span>
                <AppIcons.arrowRight className="size-4 shrink-0 opacity-80" />
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="flex max-h-[min(360px,50dvh)] flex-col gap-2 overflow-y-auto p-3">
          <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("overview.launch.requiredSection")}
          </p>
          {requiredItems.map((item) => (
            <ChecklistRow item={item} key={item.id} />
          ))}
          <p className="mt-2 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("overview.launch.optionalSection")}
          </p>
          {optionalItems.map((item) => (
            <ChecklistRow item={item} key={item.id} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button asChild size="sm" variant="outline">
            <Link href={`${dashboardRoutes.settings}?tab=storefront`} prefetch={false}>
              {t("overview.launch.storefrontSettings")}
            </Link>
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={dismissAssistant}>
            {t("overview.launch.doNotShow")}
          </Button>
        </div>
      </div>

      <Button
        aria-expanded={open}
        className="shadow-lg transition-transform duration-150 hover:-translate-y-0.5"
        type="button"
        onClick={toggleOpen}
      >
        {launchReady
          ? t("overview.launch.launchButtonReady")
          : t("overview.launch.launchButton", {
              done: completedRequired,
              total: requiredItems.length,
            })}
      </Button>
    </div>
  );
}

function ChecklistRow({ item }: { item: LaunchChecklistItem }) {
  const { t } = useI18n();
  return (
    <Link
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
      href={item.href}
      prefetch={false}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold",
          item.ready
            ? "border-primary bg-primary text-primary-foreground"
            : item.current
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted text-muted-foreground",
        )}
      >
        {item.ready ? "✓" : item.current ? "•" : ""}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
      </span>
      <Badge
        variant={
          item.ready ? "secondary" : item.current ? "default" : "outline"
        }
      >
        {item.ready
          ? t("overview.launch.done")
          : item.current
            ? t("overview.launch.next")
            : item.required
              ? t("overview.launch.open")
              : t("overview.launch.optional")}
      </Badge>
    </Link>
  );
}
