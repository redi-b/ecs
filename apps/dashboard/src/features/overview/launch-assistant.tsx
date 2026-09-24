"use client";

import {
  type LaunchReadiness,
  launchReadinessSchema,
  type MerchantDashboardAccess,
} from "@ecs/contracts";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n/provider";
import { allows, merchantPolicies } from "@/lib/access-policy";
import {
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getLaunchChecklistItems, type LaunchChecklistItem } from "./launch-assistant-model";

export function LaunchAssistant({
  access,
  initialHidden = false,
  initialReadiness = null,
}: {
  access: MerchantDashboardAccess;
  initialHidden?: boolean;
  initialReadiness?: LaunchReadiness | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [productCountUnavailable, setProductCountUnavailable] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [readiness, setReadiness] = useState<LaunchReadiness | null>(initialReadiness);
  const [refresh, setRefresh] = useState(0);
  const [reviewPending, setReviewPending] = useState(false);
  const initialFetchSkipped = useRef(Boolean(initialReadiness));
  const lastPathname = useRef(pathname);
  const summary = useMemo(
    () => ({ ...access, hasVisitedEditor: false, productCount: null, readiness }),
    [access, readiness],
  );
  const items = useMemo(() => getLaunchChecklistItems(summary, t), [summary, t]);
  const requiredItems = items.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => item.ready).length;
  const launchReady = completedRequired === requiredItems.length;
  const catalogUnknown =
    !readiness || readiness.checks.some((check) => check.status === "unavailable");
  const liveShopHref = `//${access.domain.hostname}`;
  const canCompleteSetup = allows(access.permissions ?? [], merchantPolicies.launchSetup);

  const [hidden, setHidden] = useState(initialHidden);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextHidden = isLaunchAssistantHidden(access.tenant.id);
    if (nextHidden !== hidden) {
      setHidden(nextHidden);
    }

    function handlePreferenceChange(event: Event) {
      const detail = (event as CustomEvent<{ hidden?: boolean; tenantId?: string }>).detail;

      if (detail?.tenantId !== access.tenant.id || typeof detail.hidden !== "boolean") {
        return;
      }

      setHidden(detail.hidden);
      setOpen(!detail.hidden);
    }

    window.addEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);

    return () => {
      window.removeEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);
    };
  }, [access.tenant.id, hidden]);

  // Route changes and the refresh nonce intentionally re-run this request even though they are
  // not read inside the effect body. The assistant lives in the persistent dashboard layout.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh readiness after navigation, publishing, and explicit refreshes.
  useEffect(() => {
    if (hidden) return;

    if (initialFetchSkipped.current && refresh === 0 && lastPathname.current === pathname) {
      initialFetchSkipped.current = false;
      return;
    }
    lastPathname.current = pathname;
    initialFetchSkipped.current = false;

    let cancelled = false;
    setProductCountUnavailable(false);
    setChecksLoading(true);

    void fetch(`/dashboard/setup?tenantId=${encodeURIComponent(access.tenant.id)}`, {
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        setChecksLoading(false);
        const payload =
          data && typeof data === "object" && "readiness" in data
            ? (data as { readiness?: unknown }).readiness
            : undefined;
        const parsed = launchReadinessSchema.safeParse(payload);
        if (parsed.success) {
          setReadiness(parsed.data);
          return;
        }
        setProductCountUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) {
          setProductCountUnavailable(true);
          setChecksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hidden, access.tenant.id, access.storefront.isPublished, refresh, pathname]);

  async function confirmReview() {
    if (!readiness || reviewPending) return;
    setReviewPending(true);
    try {
      const response = await fetch(
        `/dashboard/setup?tenantId=${encodeURIComponent(access.tenant.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewed: true, draftFingerprint: readiness.draftFingerprint }),
        },
      );
      if (!response.ok) throw new Error();
      setRefresh((current) => current + 1);
    } catch {
      toast.error(t("overview.launch.checks.reviewFailed"));
    } finally {
      setReviewPending(false);
    }
  }

  function dismissAssistant() {
    setLaunchAssistantHidden(access.tenant.id, true);
    setHidden(true);
    setOpen(false);
    toast(t("overview.launch.hiddenToast"), {
      description: t("overview.launch.hiddenDesc"),
    });
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  const isOverview = pathname === dashboardRoutes.overview;

  if (!canCompleteSetup || hidden) {
    return null;
  }

  if (!isOverview && (!readiness || launchReady)) {
    return null;
  }

  const panel = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold outline-none"
            id="launch-assistant-title"
            tabIndex={-1}
          >
            {t("overview.launch.title")}
          </p>
          {!launchReady ? (
            <div aria-hidden="true" className="mt-2 flex max-w-40 gap-1">
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
          ) : null}
          {!launchReady ? (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {catalogUnknown
                ? t(
                    productCountUnavailable || !checksLoading
                      ? "overview.launch.checks.unavailable"
                      : "overview.launch.checks.checking",
                  )
                : launchReady
                  ? t("overview.launch.progressReady")
                  : t("overview.launch.progress", {
                      done: completedRequired,
                      total: requiredItems.length,
                    })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("overview.launch.checks.refresh")}
                disabled={checksLoading}
                size="icon"
                className="size-10"
                type="button"
                variant="ghost"
                onClick={() => setRefresh((current) => current + 1)}
              >
                <AppIcons.refresh
                  className={cn("size-4", checksLoading && "animate-spin")}
                  aria-hidden
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("overview.launch.checks.refresh")}</TooltipContent>
          </Tooltip>
          <Button
            aria-label={t("overview.aria.closeLaunch")}
            size="icon"
            className="size-10"
            type="button"
            variant="ghost"
            onClick={() => {
              changeOpen(false);
            }}
          >
            <AppIcons.close className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {launchReady ? (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AppIcons.check className="size-7" aria-hidden />
            </span>
            <h3 className="text-lg font-semibold tracking-tight">
              {t("overview.launch.titleReady")}
            </h3>
            <p className="mt-2 max-w-64 text-sm text-muted-foreground">
              {t("overview.launch.progressReady")}
            </p>
            <Button asChild className="mt-6 w-full">
              <a
                href={liveShopHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => changeOpen(false)}
              >
                {t("overview.launch.viewShop")}
                <AppIcons.externalLink className="size-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link
                href={dashboardRoutes.editor}
                prefetch={false}
                onClick={() => changeOpen(false)}
              >
                {t("overview.launch.openEditor")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {requiredItems.map((item) => (
              <ChecklistRow
                item={item}
                key={item.id}
                loading={checksLoading && !readiness}
                onNavigate={() => changeOpen(false)}
                pending={reviewPending}
                {...(item.id === "review" && !item.ready
                  ? { onConfirm: () => void confirmReview() }
                  : {})}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t p-3">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`${dashboardRoutes.settings}?tab=storefront`}
            prefetch={false}
            onClick={() => changeOpen(false)}
          >
            {t("overview.launch.storefrontSettings")}
          </Link>
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={dismissAssistant}>
          {t("overview.launch.doNotShow")}
        </Button>
      </div>
    </>
  );
  const launcher = (
    <Button
      aria-expanded={open}
      variant="outline"
      className="h-11 gap-2.5 rounded-full border-border bg-popover px-4 text-popover-foreground shadow-[0_6px_24px_-6px_rgb(0_0_0/0.3)] hover:bg-popover"
      type="button"
    >
      <span
        className="relative flex size-6 items-center justify-center text-primary"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-6 -rotate-90" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.15" />
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - (completedRequired / Math.max(1, requiredItems.length)) * 100}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-300 ease-[var(--ease-dashboard)] motion-reduce:transition-none"
          />
        </svg>
        {launchReady ? <AppIcons.check className="size-3.5" /> : null}
      </span>
      {catalogUnknown
        ? t("overview.launch.title")
        : launchReady
          ? t("overview.launch.launchButtonReady")
          : t("overview.launch.launchButton", {
              done: completedRequired,
              total: requiredItems.length,
            })}
    </Button>
  );
  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 max-w-[calc(100vw-2rem)] motion-safe:animate-dashboard-base">
      {isMobile ? (
        <Sheet open={open} onOpenChange={changeOpen}>
          <SheetTrigger asChild>{launcher}</SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("launch-assistant-title")?.focus();
            }}
            className="launch-assistant-surface max-h-[85dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetTitle className="sr-only">{t("overview.launch.title")}</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>{launcher}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={12}
            aria-labelledby="launch-assistant-title"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("launch-assistant-title")?.focus();
            }}
            className="launch-assistant-surface z-40 max-h-[min(640px,var(--radix-popover-content-available-height))] w-[390px] gap-0 overflow-hidden rounded-2xl p-0"
          >
            {panel}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  loading = false,
  onNavigate,
  onConfirm,
  pending = false,
}: {
  item: LaunchChecklistItem;
  loading?: boolean;
  onNavigate?: () => void;
  onConfirm?: () => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const className = cn(
    "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-3.5 text-sm transition-colors",
    item.current && !item.ready
      ? "bg-muted/60 ring-1 ring-inset ring-border hover:bg-muted/80"
      : "hover:bg-muted/50",
  );
  const content = (
    <>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border",
          item.ready
            ? "border-transparent bg-muted text-muted-foreground"
            : item.current
              ? "border-primary bg-background text-primary ring-4 ring-primary/10"
              : "border-border bg-muted text-muted-foreground",
        )}
      >
        {item.ready ? (
          <AppIcons.check className="size-4" aria-hidden />
        ) : item.current ? (
          <span className="size-2 rounded-full bg-current" aria-hidden />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className={cn("block font-medium", item.ready && "text-muted-foreground")}>
          {onConfirm ? (
            <Link
              href={item.href}
              prefetch={false}
              className="underline decoration-border underline-offset-4 hover:decoration-current"
              {...(onNavigate ? { onClick: onNavigate } : {})}
            >
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </span>
        {!item.ready ? (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {loading ? t("overview.launch.checks.checking") : item.description}
          </span>
        ) : null}
      </span>
      {loading ? (
        <Badge variant="outline">
          <AppIcons.loader className="size-3.5 animate-spin" aria-hidden />
          {t("overview.launch.checks.checking")}
        </Badge>
      ) : onConfirm ? (
        <Button
          aria-busy={pending}
          disabled={pending || item.unavailable}
          size="sm"
          className="col-start-2 mt-1 justify-self-start"
          type="button"
          variant="outline"
          onClick={onConfirm}
        >
          <AppIcons.check className="size-4" aria-hidden />
          {t("overview.launch.checks.confirmReview")}
        </Button>
      ) : item.current && !item.ready ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
          {t("overview.launch.go")}
          <AppIcons.arrowRight className="size-3.5 opacity-80" aria-hidden />
        </span>
      ) : item.ready ? null : (
        <Badge variant={item.ready ? "secondary" : item.required ? "outline" : "outline"}>
          {item.unavailable
            ? t("overview.launch.checks.unavailable")
            : item.ready
              ? t("overview.launch.done")
              : item.required
                ? t("overview.launch.open")
                : t("overview.launch.optional")}
        </Badge>
      )}
    </>
  );

  if (onConfirm) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      className={className}
      href={item.href}
      prefetch={false}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      {content}
    </Link>
  );
}
