"use client";

import type { MerchantDashboardAccess } from "@ecs/contracts";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EcsArtwork } from "@/components/app/ecs-brand";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { allows, merchantPolicies } from "@/lib/access-policy";
import {
  getLaunchAssistantOpenPreference,
  hasVisitedStorefrontEditor,
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
  setLaunchAssistantOpenPreference,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getLaunchChecklistItems, type LaunchChecklistItem } from "./launch-assistant-model";

export function LaunchAssistant({ access }: { access: MerchantDashboardAccess }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [productCount, setProductCount] = useState<number | null>(null);
  const [productCountUnavailable, setProductCountUnavailable] = useState(false);
  const [hasVisitedEditor, setHasVisitedEditor] = useState(false);
  const summary = useMemo(
    () => ({ ...access, hasVisitedEditor, productCount, productCountUnavailable }),
    [access, hasVisitedEditor, productCount, productCountUnavailable],
  );
  const items = useMemo(() => getLaunchChecklistItems(summary, t), [summary, t]);
  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => !item.required);
  const completedRequired = requiredItems.filter((item) => item.ready).length;
  const launchReady = completedRequired === requiredItems.length;
  const catalogUnknown = productCount === null || productCountUnavailable;
  const liveShopHref = `//${access.domain.hostname}`;
  const canCompleteSetup = allows(access.permissions ?? [], merchantPolicies.launchSetup);

  const [hydrated, setHydrated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextHidden = isLaunchAssistantHidden(access.tenant.id);
    const nextOpen = getLaunchAssistantOpenPreference(access.tenant.id);
    setHasVisitedEditor(hasVisitedStorefrontEditor(access.tenant.id));

    setHidden(nextHidden);
    // Keep unfinished setup close at hand, then collapse it once the required work is done.
    setOpen(nextHidden ? false : (nextOpen ?? true));
    setHydrated(true);

    function handlePreferenceChange(event: Event) {
      const detail = (event as CustomEvent<{ hidden?: boolean; tenantId?: string }>).detail;

      if (detail?.tenantId !== access.tenant.id || typeof detail.hidden !== "boolean") {
        return;
      }

      setHidden(detail.hidden);
      setOpen(detail.hidden ? false : (getLaunchAssistantOpenPreference(access.tenant.id) ?? true));
    }

    window.addEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);

    return () => {
      window.removeEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);
    };
  }, [access.tenant.id]);

  useEffect(() => {
    if (!hydrated || hidden) return;

    let cancelled = false;
    setProductCountUnavailable(false);
    setProductCount(null);

    void fetch(`${dashboardRoutes.productListAction}?limit=1&offset=0`, {
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const count =
          data && typeof data === "object" && "count" in data
            ? (data as { count?: unknown }).count
            : undefined;
        if (typeof count === "number" && count >= 0) {
          setProductCount(count);
          return;
        }
        setProductCountUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) setProductCountUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hidden, hydrated, access.tenant.id]);

  function dismissAssistant() {
    setLaunchAssistantHidden(access.tenant.id, true);
    setHidden(true);
    setOpen(false);
    toast(t("overview.launch.hiddenToast"), {
      description: t("overview.launch.hiddenDesc"),
    });
  }

  function toggleOpen() {
    setOpen((value) => {
      const nextOpen = !value;
      setLaunchAssistantOpenPreference(access.tenant.id, nextOpen);
      return nextOpen;
    });
  }

  const isSetupHome =
    pathname === dashboardRoutes.overview || pathname === dashboardRoutes.settings;

  if (!canCompleteSetup || !hydrated || hidden || (launchReady && !isSetupHome)) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <div
        data-slot="launch-assistant"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "absolute bottom-full mb-2 flex max-h-[min(720px,calc(100dvh-6rem))] w-[min(420px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-xl border bg-background dark:bg-popover shadow-lg transition-[opacity,transform] duration-200 ease-[var(--ease-dashboard)] motion-reduce:transition-none",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4">
          <EcsArtwork kind="storefront" size="compact" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {launchReady ? t("overview.launch.titleReady") : t("overview.launch.title")}
            </p>
            <div aria-hidden="true" className="mt-3 flex gap-1.5">
              {requiredItems.map((item) => (
                <span
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    item.ready ? "bg-primary" : item.current ? "bg-primary/30" : "bg-muted",
                  )}
                  key={item.id}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {catalogUnknown
                ? t(
                    productCountUnavailable
                      ? "overview.launch.catalogUnavailable"
                      : "overview.launch.catalogChecking",
                  )
                : launchReady
                  ? t("overview.launch.progressReady")
                  : t("overview.launch.progress", {
                      done: completedRequired,
                      total: requiredItems.length,
                    })}
            </p>
            {launchReady ? (
              <div className="mt-3 flex flex-wrap gap-2">
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
            ) : null}
          </div>
          <Button
            aria-label={t("overview.aria.closeLaunch")}
            className="shrink-0 text-xl leading-none"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => {
              setLaunchAssistantOpenPreference(access.tenant.id, false);
              setOpen(false);
            }}
          >
            <AppIcons.close className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 max-h-[min(360px,50dvh)] flex-col gap-2 overflow-y-auto p-3">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {t("overview.launch.requiredSection")}
          </p>
          {requiredItems.map((item) => (
            <ChecklistRow item={item} key={item.id} />
          ))}
          <p className="mt-2 px-1 text-xs font-medium text-muted-foreground">
            {t("overview.launch.optionalSection")}
          </p>
          {optionalItems.map((item) => (
            <ChecklistRow item={item} key={item.id} />
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t p-3">
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

      <Button aria-expanded={open} className="shadow-lg" type="button" onClick={toggleOpen}>
        {catalogUnknown
          ? t("overview.launch.title")
          : launchReady
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
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
        item.current && !item.ready
          ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/15 hover:bg-primary/10"
          : "bg-background hover:bg-muted/50",
      )}
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
        {item.ready ? (
          <AppIcons.check className="size-4" aria-hidden />
        ) : item.current ? (
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
      </span>
      {item.current && !item.ready ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
          {t("overview.launch.go")}
          <AppIcons.arrowRight className="size-3.5 opacity-80" aria-hidden />
        </span>
      ) : (
        <Badge variant={item.ready ? "secondary" : item.required ? "outline" : "outline"}>
          {item.ready
            ? t("overview.launch.done")
            : item.required
              ? t("overview.launch.open")
              : t("overview.launch.optional")}
        </Badge>
      )}
    </Link>
  );
}
